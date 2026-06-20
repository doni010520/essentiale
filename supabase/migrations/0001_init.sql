-- =====================================================================
-- Chatmix clone — schema inicial (multi-tenant + RLS)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Organizações (inquilinos / tenants)
-- ---------------------------------------------------------------------
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  document    text,                       -- CNPJ
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Perfis (atendentes / usuários) — 1:1 com auth.users
-- ---------------------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references organizations (id) on delete cascade,
  name            text not null default '',
  email           text,
  role            text not null default 'agent' check (role in ('admin','supervisor','agent')),
  department_id   uuid,
  avatar_url      text,
  status          text not null default 'offline' check (status in ('online','away','offline')),
  whatsapp        text,
  notify          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Função helper: org do usuário autenticado (SECURITY DEFINER evita recursão de RLS).
create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function current_role_is(target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = target);
$$;

-- ---------------------------------------------------------------------
-- Departamentos
-- ---------------------------------------------------------------------
create table departments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  color           text default '#00a8ff',
  created_at      timestamptz not null default now()
);
alter table profiles
  add constraint profiles_department_fk
  foreign key (department_id) references departments (id) on delete set null;

-- ---------------------------------------------------------------------
-- Canais (conexões WhatsApp)
-- ---------------------------------------------------------------------
create table channels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('meta_cloud','uazapi')),
  phone           text,
  status          text not null default 'pending'
                    check (status in ('pending','connecting','connected','disconnected','error')),
  external_id     text,                    -- phone_number_id (Meta) ou instance (UAZAPI)
  credentials     jsonb not null default '{}',  -- tokens/segredos (criptografar em camada de app)
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Contatos (clientes)
-- ---------------------------------------------------------------------
create table contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text,
  phone           text not null,
  avatar_url      text,
  custom_fields   jsonb not null default '{}',
  notes           text,
  created_at      timestamptz not null default now(),
  unique (organization_id, phone)
);

-- ---------------------------------------------------------------------
-- Conversas (atendimentos)
-- ---------------------------------------------------------------------
create table conversations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  channel_id       uuid not null references channels (id) on delete cascade,
  contact_id       uuid not null references contacts (id) on delete cascade,
  status           text not null default 'queued'
                     check (status in ('bot','queued','open','closed')),
  assigned_user_id uuid references profiles (id) on delete set null,
  department_id    uuid references departments (id) on delete set null,
  protocol         text,
  last_message_at  timestamptz,
  opened_at        timestamptz default now(),
  closed_at        timestamptz,
  satisfaction     int,
  created_at       timestamptz not null default now()
);
create index on conversations (organization_id, status, last_message_at desc);

-- ---------------------------------------------------------------------
-- Mensagens
-- ---------------------------------------------------------------------
create table messages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  conversation_id uuid not null references conversations (id) on delete cascade,
  direction       text not null check (direction in ('in','out')),
  sender_type     text not null check (sender_type in ('contact','agent','bot','system')),
  sender_id       uuid,                    -- profile id se agente
  content_type    text not null default 'text'
                    check (content_type in ('text','image','audio','video','document','location','contact','template','sticker')),
  body            text,
  media_url       text,
  status          text not null default 'sent'
                    check (status in ('pending','sent','delivered','read','failed')),
  external_id     text,                    -- id da mensagem no provedor
  created_at      timestamptz not null default now()
);
create index on messages (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- Tags / classificações (atendimento, cliente, status)
-- ---------------------------------------------------------------------
create table tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  color           text default '#00a8ff',
  scope           text not null default 'conversation'
                    check (scope in ('conversation','contact','status')),
  created_at      timestamptz not null default now()
);
create table conversation_tags (
  conversation_id uuid not null references conversations (id) on delete cascade,
  tag_id          uuid not null references tags (id) on delete cascade,
  primary key (conversation_id, tag_id)
);
create table contact_tags (
  contact_id uuid not null references contacts (id) on delete cascade,
  tag_id     uuid not null references tags (id) on delete cascade,
  primary key (contact_id, tag_id)
);

-- ---------------------------------------------------------------------
-- Mensagens rápidas / modelos / macros
-- ---------------------------------------------------------------------
create table quick_replies (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  title           text not null,
  content         text not null,
  shortcut        text,
  kind            text not null default 'model' check (kind in ('model','macro','auto')),
  created_at      timestamptz not null default now()
);

-- Templates Meta (HSM)
create table wa_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  channel_id      uuid references channels (id) on delete cascade,
  name            text not null,
  language        text not null default 'pt_BR',
  category        text,
  status          text default 'pending',
  components      jsonb not null default '[]',
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Automações (fluxos de chatbot) e campanhas
-- ---------------------------------------------------------------------
create table automations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  channel_id      uuid references channels (id) on delete set null,
  name            text not null,
  trigger         text,
  flow            jsonb not null default '{"nodes":[],"edges":[]}',
  active          boolean not null default false,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create table campaigns (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  automation_id   uuid references automations (id) on delete set null,
  name            text not null,
  status          text not null default 'draft'
                    check (status in ('draft','scheduled','running','paused','done','failed')),
  audience        jsonb not null default '[]',
  scheduled_at    timestamptz,
  progress        int not null default 0,
  stats           jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Planos de serviço (do provedor), API keys, integrações, IA, logs
-- ---------------------------------------------------------------------
create table plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  price           numeric(12,2),
  description     text,
  created_at      timestamptz not null default now()
);
create table api_keys (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  key_hash        text not null,
  scopes          text[] not null default '{}',
  last_used_at    timestamptz,
  created_at      timestamptz not null default now()
);
create table integrations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  type            text not null,           -- ex: 'sgp'
  config          jsonb not null default '{}',
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create table ai_agents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  channel_id      uuid references channels (id) on delete set null,
  name            text not null,
  prompt          text,
  model           text default 'claude-sonnet-4-6',
  config          jsonb not null default '{}',
  active          boolean not null default false,
  created_at      timestamptz not null default now()
);
create table audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid references profiles (id) on delete set null,
  action          text not null,
  entity          text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
