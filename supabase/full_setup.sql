-- ============================================================================
-- ESSENTIALE — SETUP COMPLETO DO BANCO (rodar UMA vez no SQL Editor do Supabase)
-- Schema base (0001-0020) + domínio Essentiale (0021) + seeds (org, agente,
-- 36 produtos, 17 fragrâncias). Depois rode seed_profile.sql ao criar seu login.
-- ============================================================================


-- ===== migrations/0001_init.sql =====
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


-- ===== migrations/0002_rls.sql =====
-- =====================================================================
-- RLS + onboarding
-- =====================================================================

-- Cria automaticamente um profile quando um usuário se cadastra no Auth.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Onboarding: cria a organização e vincula o usuário atual como admin.
create or replace function create_organization(org_name text, org_document text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org uuid;
begin
  if (select organization_id from profiles where id = auth.uid()) is not null then
    raise exception 'Usuário já pertence a uma organização';
  end if;

  insert into organizations (name, document) values (org_name, org_document)
  returning id into new_org;

  update profiles
     set organization_id = new_org, role = 'admin'
   where id = auth.uid();

  return new_org;
end;
$$;

-- ---------------------------------------------------------------------
-- Habilita RLS e aplica políticas por organização.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  org_tables text[] := array[
    'organizations','profiles','departments','channels','contacts','conversations',
    'messages','tags','quick_replies','wa_templates','automations','campaigns',
    'plans','api_keys','integrations','ai_agents','audit_logs'
  ];
begin
  foreach t in array org_tables loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- organizations: o usuário enxerga/edita a própria org.
create policy org_select on organizations for select using (id = current_org_id());
create policy org_update on organizations for update using (id = current_org_id() and current_role_is('admin'));

-- profiles: enxerga colegas da mesma org; edita o próprio (admin edita todos).
create policy profiles_select on profiles for select
  using (organization_id = current_org_id() or id = auth.uid());
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());
create policy profiles_update on profiles for update
  using (id = auth.uid() or (organization_id = current_org_id() and current_role_is('admin')));

-- Demais tabelas: tudo restrito à org do usuário.
do $$
declare
  t text;
  scoped text[] := array[
    'departments','channels','contacts','conversations','messages','tags',
    'quick_replies','wa_templates','automations','campaigns','plans',
    'api_keys','integrations','ai_agents','audit_logs'
  ];
begin
  foreach t in array scoped loop
    execute format($f$
      create policy %1$s_all on %1$I
        for all
        using (organization_id = current_org_id())
        with check (organization_id = current_org_id());
    $f$, t);
  end loop;
end $$;

-- Tabelas de junção: herdam a org pela entidade pai.
alter table conversation_tags enable row level security;
alter table contact_tags enable row level security;

create policy conversation_tags_all on conversation_tags for all
  using (exists (select 1 from conversations c
                  where c.id = conversation_id and c.organization_id = current_org_id()))
  with check (exists (select 1 from conversations c
                  where c.id = conversation_id and c.organization_id = current_org_id()));

create policy contact_tags_all on contact_tags for all
  using (exists (select 1 from contacts c
                  where c.id = contact_id and c.organization_id = current_org_id()))
  with check (exists (select 1 from contacts c
                  where c.id = contact_id and c.organization_id = current_org_id()));


-- ===== migrations/0003_realtime.sql =====
-- Habilita Realtime (broadcast de mudanças) para o chat ao vivo e o board Kanban.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;


-- ===== migrations/0004_views.sql =====
-- View para a inbox de atendimento: junta conversa + contato + canal + última mensagem.
-- security_invoker = true faz a view respeitar a RLS das tabelas para o usuário que consulta.
create view conversation_overview
with (security_invoker = true)
as
select
  c.id,
  c.organization_id,
  c.status,
  c.assigned_user_id,
  c.department_id,
  c.channel_id,
  c.contact_id,
  c.protocol,
  c.last_message_at,
  c.opened_at,
  c.closed_at,
  c.created_at,
  ct.name        as contact_name,
  ct.phone       as contact_phone,
  ct.avatar_url  as contact_avatar,
  ch.name        as channel_name,
  ch.type        as channel_type,
  lm.body         as last_message_body,
  lm.content_type as last_message_type,
  lm.direction    as last_message_direction
from conversations c
join contacts ct on ct.id = c.contact_id
join channels ch on ch.id = c.channel_id
left join lateral (
  select body, content_type, direction
  from messages m
  where m.conversation_id = c.id
  order by m.created_at desc
  limit 1
) lm on true;


-- ===== migrations/0005_avatars_bucket.sql =====
-- Bucket público para fotos de perfil dos contatos (sincronizadas da UAZAPI).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Leitura pública das imagens do bucket avatars.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_public_read'
  ) then
    create policy "avatars_public_read" on storage.objects
      for select using (bucket_id = 'avatars');
  end if;
end $$;


-- ===== migrations/0006_groups_mute.sql =====
-- Suporte a conversas de GRUPO e a silenciar (mute) conversas.
alter table contacts add column if not exists is_group boolean not null default false;
alter table conversations add column if not exists is_muted boolean not null default false;
alter table messages add column if not exists author_name text; -- quem enviou (participante do grupo)

-- Recria a view da inbox expondo is_group, is_muted e o autor da última mensagem.
drop view if exists conversation_overview;
create view conversation_overview
with (security_invoker = true)
as
select
  c.id,
  c.organization_id,
  c.status,
  c.assigned_user_id,
  c.department_id,
  c.channel_id,
  c.contact_id,
  c.protocol,
  c.last_message_at,
  c.opened_at,
  c.closed_at,
  c.created_at,
  c.is_muted,
  ct.name        as contact_name,
  ct.phone       as contact_phone,
  ct.avatar_url  as contact_avatar,
  ct.is_group    as is_group,
  ch.name        as channel_name,
  ch.type        as channel_type,
  lm.body         as last_message_body,
  lm.content_type as last_message_type,
  lm.direction    as last_message_direction,
  lm.author_name  as last_message_author
from conversations c
join contacts ct on ct.id = c.contact_id
join channels ch on ch.id = c.channel_id
left join lateral (
  select body, content_type, direction, author_name
  from messages m
  where m.conversation_id = c.id
  order by m.created_at desc
  limit 1
) lm on true;


-- ===== migrations/0007_media_bucket.sql =====
-- Bucket público para mídia das conversas (recebida e enviada).
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Leitura pública dos arquivos de mídia.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'media_public_read'
  ) then
    create policy "media_public_read" on storage.objects
      for select using (bucket_id = 'media');
  end if;
end $$;


-- ===== migrations/0008_message_interactions.sql =====
-- Interações de mensagem: responder (quote), reações, editar, apagar.
alter table messages add column if not exists reply_to_external text;   -- id externo da msg citada
alter table messages add column if not exists reply_excerpt text;        -- trecho da msg citada (cache)
alter table messages add column if not exists reply_author text;         -- autor da msg citada
alter table messages add column if not exists reactions jsonb not null default '[]'; -- [{emoji, by}]
alter table messages add column if not exists is_deleted boolean not null default false;
alter table messages add column if not exists edited boolean not null default false;

create index if not exists messages_external_id_idx on messages (external_id);


-- ===== migrations/0009_bot_state.sql =====
-- Estado do chatbot por conversa (qual automação e em que nó parou aguardando resposta).
alter table conversations add column if not exists bot_automation_id uuid references automations (id) on delete set null;
alter table conversations add column if not exists bot_node_id text;


-- ===== migrations/0010_author_phone.sql =====
-- Telefone real do autor de mensagens de grupo (para abrir conversa 1:1 ao clicar no nome).
alter table messages add column if not exists author_phone text;


-- ===== migrations/0011_group_jid_lid.sql =====
-- JID completo do grupo (preserva traço de jids antigos) e LID do autor (p/ resolver 1:1).
alter table contacts add column if not exists chat_jid text;
alter table messages add column if not exists author_lid text;

-- Recria a view expondo o JID do contato/grupo.
drop view if exists conversation_overview;
create view conversation_overview
with (security_invoker = true)
as
select
  c.id, c.organization_id, c.status, c.assigned_user_id, c.department_id,
  c.channel_id, c.contact_id, c.protocol, c.last_message_at, c.opened_at,
  c.closed_at, c.created_at, c.is_muted,
  ct.name as contact_name, ct.phone as contact_phone, ct.avatar_url as contact_avatar,
  ct.is_group as is_group, ct.chat_jid as contact_jid,
  ch.name as channel_name, ch.type as channel_type,
  lm.body as last_message_body, lm.content_type as last_message_type,
  lm.direction as last_message_direction, lm.author_name as last_message_author
from conversations c
join contacts ct on ct.id = c.contact_id
join channels ch on ch.id = c.channel_id
left join lateral (
  select body, content_type, direction, author_name
  from messages m where m.conversation_id = c.id
  order by m.created_at desc limit 1
) lm on true;


-- ===== migrations/0012_avatar_src.sql =====
-- Impressão digital da foto-fonte (caminho da URL do WhatsApp, sem query de expiração).
-- Quando muda, sabemos que a pessoa trocou a foto e re-hospedamos a nova.
alter table contacts add column if not exists avatar_src text;


-- ===== migrations/0013_protocol_close.sql =====
-- =====================================================================
-- Fase 1 — Protocolo de atendimento, encerramento e notas internas
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Protocolo: contador diário por organização + trigger de atribuição.
--    Formato: AAAAMMDD + sequência diária (4 dígitos). Ex.: 202606040001
-- ---------------------------------------------------------------------
create table if not exists protocol_counters (
  organization_id uuid not null references organizations (id) on delete cascade,
  day             date not null,
  seq             int  not null default 0,
  primary key (organization_id, day)
);

create or replace function assign_protocol()
returns trigger
language plpgsql
as $$
declare
  n     int;
  today date := (now() at time zone 'America/Bahia')::date;
begin
  if new.protocol is null or new.protocol = '' then
    insert into protocol_counters (organization_id, day, seq)
      values (new.organization_id, today, 1)
      on conflict (organization_id, day)
        do update set seq = protocol_counters.seq + 1
      returning seq into n;
    new.protocol := to_char(today, 'YYYYMMDD') || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_protocol on conversations;
create trigger trg_assign_protocol
  before insert on conversations
  for each row execute function assign_protocol();

-- Backfill: numera conversas existentes sem protocolo (por org+dia, ordem de criação).
with numbered as (
  select
    id,
    to_char((created_at at time zone 'America/Bahia')::date, 'YYYYMMDD') as ymd,
    row_number() over (
      partition by organization_id, (created_at at time zone 'America/Bahia')::date
      order by created_at
    ) as rn
  from conversations
  where protocol is null or protocol = ''
)
update conversations c
   set protocol = n.ymd || lpad(n.rn::text, 4, '0')
  from numbered n
 where n.id = c.id;

-- Sincroniza o contador com o que já existe (evita colisão com novos do mesmo dia).
insert into protocol_counters (organization_id, day, seq)
  select organization_id, (created_at at time zone 'America/Bahia')::date, count(*)
    from conversations
   group by 1, 2
  on conflict (organization_id, day)
    do update set seq = greatest(protocol_counters.seq, excluded.seq);

-- ---------------------------------------------------------------------
-- 2) Encerramento: motivo de encerramento (classificação via conversation_tags).
-- ---------------------------------------------------------------------
alter table conversations add column if not exists close_reason text;
-- Aguardando resposta da pesquisa de satisfação (captura a nota na próxima resposta do cliente).
alter table conversations add column if not exists awaiting_satisfaction boolean not null default false;

-- ---------------------------------------------------------------------
-- 3) Notas internas: mensagens visíveis só aos atendentes (não vão ao cliente).
-- ---------------------------------------------------------------------
alter table messages add column if not exists is_internal boolean not null default false;

-- ---------------------------------------------------------------------
-- 4) Recria a view da inbox expondo satisfação, motivo, atendente e depto.
-- ---------------------------------------------------------------------
drop view if exists conversation_overview;
create view conversation_overview
with (security_invoker = true)
as
select
  c.id, c.organization_id, c.status, c.assigned_user_id, c.department_id,
  c.channel_id, c.contact_id, c.protocol, c.last_message_at, c.opened_at,
  c.closed_at, c.created_at, c.is_muted, c.satisfaction, c.close_reason,
  c.bot_automation_id,
  ct.name as contact_name, ct.phone as contact_phone, ct.avatar_url as contact_avatar,
  ct.is_group as is_group, ct.chat_jid as contact_jid,
  ch.name as channel_name, ch.type as channel_type,
  pr.name as assigned_name,
  dp.name as department_name, dp.color as department_color,
  lm.body as last_message_body, lm.content_type as last_message_type,
  lm.direction as last_message_direction, lm.author_name as last_message_author,
  coalesce(ur.cnt, 0)::int as unread_count
from conversations c
join contacts ct on ct.id = c.contact_id
join channels ch on ch.id = c.channel_id
left join profiles pr on pr.id = c.assigned_user_id
left join departments dp on dp.id = c.department_id
left join lateral (
  select body, content_type, direction, author_name
  from messages m
  where m.conversation_id = c.id and coalesce(m.is_internal, false) = false
  order by m.created_at desc
  limit 1
) lm on true
left join lateral (
  select count(*) as cnt
  from messages m2
  where m2.conversation_id = c.id and m2.direction = 'in' and m2.status <> 'read'
) ur on true;


-- ===== migrations/0014_full_parity.sql =====
-- =====================================================================
-- 0014 — Paridade total com Chatmix: todas as tabelas/colunas faltantes
-- =====================================================================

-- =========================== CSAT (Pesquisa de Satisfação) ===========================
create table if not exists satisfaction_surveys (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  active          boolean not null default false,
  scale_type      text not null default 'stars' check (scale_type in ('stars','buttons')),
  scale_max       int not null default 5,
  question        text not null default 'De 1 a 5, como você avalia o nosso atendimento?',
  channels        uuid[] not null default '{}',   -- vazio = todos
  close_after_min int not null default 30,        -- encerra se cliente não responder
  created_at      timestamptz not null default now()
);

-- =========================== HORÁRIO DE ATENDIMENTO ===========================
create table if not exists business_hours (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  department_id   uuid references departments (id) on delete cascade, -- null = global da org
  day_of_week     int not null check (day_of_week between 0 and 6),   -- 0=domingo
  start_time      time not null default '08:00',
  end_time        time not null default '18:00',
  active          boolean not null default true,
  unique (organization_id, department_id, day_of_week)
);

-- =========================== MENSAGENS AUTOMÁTICAS POR EVENTO ===========================
create table if not exists auto_messages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  event           text not null check (event in (
    'welcome','away','out_of_hours','close','queue_wait','agent_assign'
  )),
  channel_id      uuid references channels (id) on delete cascade, -- null = todos
  department_id   uuid references departments (id) on delete cascade, -- null = todos
  body            text not null,
  active          boolean not null default true,
  interval_min    int,  -- para queue_wait: reenvia a cada N min
  created_at      timestamptz not null default now()
);

-- =========================== CONFIGURAÇÕES DA ORGANIZAÇÃO ===========================
-- Expansão: organizations.settings JSONB já existe; vamos usá-lo com chaves bem-definidas.
-- Nada a criar em schema; os defaults ficam no código.

-- =========================== RECORRÊNCIA DE ATENDIMENTO ===========================
-- Campo na conversa para exibir badge Baixa/Média/Alta
-- (calculado on-the-fly; configuração em organizations.settings)

-- =========================== COLUNAS ADICIONAIS ===========================

-- Conversations: survey_id (qual pesquisa foi enviada)
alter table conversations add column if not exists survey_id uuid references satisfaction_surveys (id) on delete set null;

-- Conversations: closed_by (quem encerrou)
alter table conversations add column if not exists closed_by uuid references profiles (id) on delete set null;

-- Messages: forwarded (encaminhada)
alter table messages add column if not exists forwarded boolean not null default false;

-- Conversations: pinned (fixada)
alter table conversations add column if not exists pinned boolean not null default false;

-- Conversations: archived
alter table conversations add column if not exists archived boolean not null default false;

-- Contacts: campos CRM extras
alter table contacts add column if not exists email text;
alter table contacts add column if not exists birthday date;
alter table contacts add column if not exists city text;
alter table contacts add column if not exists address text;

-- Profiles: 2FA
alter table profiles add column if not exists totp_secret text;
alter table profiles add column if not exists totp_enabled boolean not null default false;

-- Profiles: avatar (foto de perfil do atendente)
-- já existe avatar_url

-- API keys: canal amarrado
alter table api_keys add column if not exists channel_id uuid references channels (id) on delete set null;

-- Campaigns: campos de disparo real
alter table campaigns add column if not exists channel_id uuid references channels (id) on delete set null;
alter table campaigns add column if not exists contact_filter jsonb not null default '{}';
alter table campaigns add column if not exists started_at timestamptz;
alter table campaigns add column if not exists finished_at timestamptz;
alter table campaigns add column if not exists total_contacts int not null default 0;
alter table campaigns add column if not exists sent_count int not null default 0;
alter table campaigns add column if not exists failed_count int not null default 0;

-- =========================== RLS nas tabelas novas ===========================
alter table satisfaction_surveys enable row level security;
create policy "org_surveys" on satisfaction_surveys using (organization_id = current_org_id());

alter table business_hours enable row level security;
create policy "org_hours" on business_hours using (organization_id = current_org_id());

alter table auto_messages enable row level security;
create policy "org_auto_msgs" on auto_messages using (organization_id = current_org_id());

-- =========================== VIEW ATUALIZADA ===========================
drop view if exists conversation_overview;
create view conversation_overview
with (security_invoker = true)
as
select
  c.id, c.organization_id, c.status, c.assigned_user_id, c.department_id,
  c.channel_id, c.contact_id, c.protocol, c.last_message_at, c.opened_at,
  c.closed_at, c.created_at, c.is_muted, c.satisfaction, c.close_reason,
  c.bot_automation_id, c.survey_id, c.pinned, c.archived,
  c.awaiting_satisfaction, c.closed_by,
  ct.name as contact_name, ct.phone as contact_phone, ct.avatar_url as contact_avatar,
  ct.is_group as is_group, ct.chat_jid as contact_jid,
  ct.email as contact_email, ct.city as contact_city,
  ch.name as channel_name, ch.type as channel_type,
  pr.name as assigned_name,
  dp.name as department_name, dp.color as department_color,
  lm.body as last_message_body, lm.content_type as last_message_type,
  lm.direction as last_message_direction, lm.author_name as last_message_author,
  lm.created_at as last_message_created_at,
  coalesce(ur.cnt, 0)::int as unread_count
from conversations c
join contacts ct on ct.id = c.contact_id
join channels ch on ch.id = c.channel_id
left join profiles pr on pr.id = c.assigned_user_id
left join departments dp on dp.id = c.department_id
left join lateral (
  select body, content_type, direction, author_name, created_at
  from messages m
  where m.conversation_id = c.id and coalesce(m.is_internal, false) = false
  order by m.created_at desc
  limit 1
) lm on true
left join lateral (
  select count(*) as cnt
  from messages m2
  where m2.conversation_id = c.id and m2.direction = 'in' and m2.status <> 'read'
) ur on true;

-- =========================== REALTIME nas tabelas novas ===========================
alter publication supabase_realtime add table satisfaction_surveys;
alter publication supabase_realtime add table auto_messages;


-- ===== migrations/0015_conversation_ai.sql =====
-- =====================================================================
-- 0015 — Controle por conversa do atendimento por IA (pausar/reativar)
-- Equivalente ao "assumir / devolver para a automação" + block_return_to_bot
-- do Chatmix, mas no nível da conversa.
-- =====================================================================

-- true (padrão) = a IA pode atuar nesta conversa.
-- false = atendente pausou a IA; o chatbot NÃO reengaja, mesmo em conversa nova.
alter table conversations add column if not exists ai_enabled boolean not null default true;

-- Recria a view expondo ai_enabled. MANTÉM unread_count (não remover!).
drop view if exists conversation_overview;
create view conversation_overview
with (security_invoker = true)
as
select
  c.id, c.organization_id, c.status, c.assigned_user_id, c.department_id,
  c.channel_id, c.contact_id, c.protocol, c.last_message_at, c.opened_at,
  c.closed_at, c.created_at, c.is_muted, c.satisfaction, c.close_reason,
  c.bot_automation_id, c.survey_id, c.pinned, c.archived,
  c.awaiting_satisfaction, c.closed_by, c.ai_enabled,
  ct.name as contact_name, ct.phone as contact_phone, ct.avatar_url as contact_avatar,
  ct.is_group as is_group, ct.chat_jid as contact_jid,
  ct.email as contact_email, ct.city as contact_city,
  ch.name as channel_name, ch.type as channel_type,
  pr.name as assigned_name,
  dp.name as department_name, dp.color as department_color,
  lm.body as last_message_body, lm.content_type as last_message_type,
  lm.direction as last_message_direction, lm.author_name as last_message_author,
  lm.created_at as last_message_created_at,
  coalesce(ur.cnt, 0)::int as unread_count
from conversations c
join contacts ct on ct.id = c.contact_id
join channels ch on ch.id = c.channel_id
left join profiles pr on pr.id = c.assigned_user_id
left join departments dp on dp.id = c.department_id
left join lateral (
  select body, content_type, direction, author_name, created_at
  from messages m
  where m.conversation_id = c.id and coalesce(m.is_internal, false) = false
  order by m.created_at desc
  limit 1
) lm on true
left join lateral (
  select count(*) as cnt
  from messages m2
  where m2.conversation_id = c.id and m2.direction = 'in' and m2.status <> 'read'
) ur on true;


-- ===== migrations/0016_ai_allowlist.sql =====
-- Allowlist de números autorizados a receber atendimento por IA.
-- Rollout controlado: quando o agente está com restrict_to_allowlist=true,
-- só os números desta lista (active) recebem resposta da IA; os demais vão
-- direto para a fila humana.

create table if not exists ai_allowed_numbers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  phone           text not null,                 -- só dígitos (ex.: 5573999998888)
  label           text,                          -- nome/observação
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, phone)
);

create index if not exists ai_allowed_numbers_org_phone_idx
  on ai_allowed_numbers (organization_id, phone);

alter table ai_allowed_numbers enable row level security;

-- Acesso restrito à própria organização (mesma convenção das demais tabelas: current_org_id()).
drop policy if exists ai_allowed_numbers_all on ai_allowed_numbers;
create policy ai_allowed_numbers_all on ai_allowed_numbers for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());


-- ===== migrations/0017_automation_integration_schedule.sql =====
-- Vincula cada automação a uma integração SGP específica (opcional).
-- Quando preenchido, o pipeline usa esse SGP em vez de buscar o primeiro da org.
alter table automations
  add column if not exists integration_id uuid references integrations(id) on delete set null;

-- Horário de execução por automação.
-- Formato: {"sun":[],"mon":[["08:00","18:00"]],...}
-- null ou objeto vazio = sem restrição (roda 24/7).
alter table automations
  add column if not exists schedule jsonb;


-- ===== migrations/0018_campaign_message.sql =====
-- Texto de disparo da campanha (usado quando não há fluxo, ou como override
-- da 1ª mensagem do fluxo de automação vinculado).
alter table campaigns
  add column if not exists message text;


-- ===== migrations/0020_conversation_variables.sql =====
-- Variáveis coletadas durante o fluxo de automação (nós "input") e merge fields.
alter table conversations
  add column if not exists variables jsonb not null default '{}'::jsonb;


-- ===== migrations/0021_essentiale.sql =====
-- ─────────────────────────────────────────────────────────────────────────────
-- 0021 — Domínio Essentiale: catálogo, fragrâncias, pedidos, follow-ups, LGPD
-- Depende de: 0001 (organizations, contacts, conversations), 0002 (current_org_id()).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Catálogo de produtos ────────────────────────────────────────────────────
create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  nome             text not null,
  slug             text not null,
  categoria        text not null,
  preco_centavos   integer not null default 0,
  url_produto      text,
  descricao        text,
  caracteristicas  jsonb not null default '[]',
  exemplos_de_uso  jsonb not null default '[]',
  cuidados         text,
  fragrancia       text,
  foto_arquivo     text,
  foto_url         text,
  galeria          jsonb not null default '[]',
  ativo            boolean not null default true,
  estoque          integer not null default 999,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_products_org on products (organization_id);
create index if not exists idx_products_categoria on products (organization_id, categoria);
create unique index if not exists uq_products_org_slug on products (organization_id, slug);

-- ── Fragrâncias ─────────────────────────────────────────────────────────────
create table if not exists fragrances (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  nome             text not null,
  perfil           text,
  indicar_para     text,
  notas            jsonb not null default '{}',
  confirmada       boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists idx_fragrances_org on fragrances (organization_id);
create unique index if not exists uq_fragrances_org_nome on fragrances (organization_id, nome);

-- ── Pedidos ─────────────────────────────────────────────────────────────────
create table if not exists orders (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations (id) on delete cascade,
  conversation_id    uuid references conversations (id) on delete set null,
  contact_id         uuid references contacts (id) on delete set null,
  nome_completo      text,
  cpf                text,
  email              text,
  telefone           text,
  endereco           text,
  cep                text,
  tipo_entrega       text default 'entrega',
  quem_recebe        text,
  subtotal_centavos  integer not null default 0,
  frete_centavos     integer not null default 0,
  desconto_centavos  integer not null default 0,
  total_centavos     integer not null default 0,
  payment_method     text default 'pix',
  payment_status     text default 'pending',
  checkout_url       text,
  pix_code           text,
  status             text not null default 'novo',
  tracking_code      text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_orders_org on orders (organization_id, created_at desc);
create index if not exists idx_orders_status on orders (organization_id, status);

-- ── Itens do pedido ─────────────────────────────────────────────────────────
create table if not exists order_items (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references orders (id) on delete cascade,
  product_id               uuid references products (id) on delete set null,
  nome                     text not null,
  fragrancia               text,
  quantidade               integer not null default 1,
  preco_unitario_centavos  integer not null default 0,
  subtotal_centavos        integer not null default 0,
  personalizacao           text,
  created_at               timestamptz not null default now()
);
create index if not exists idx_order_items_order on order_items (order_id);

-- ── Follow-ups (réguas de relacionamento / pós-venda) ───────────────────────
create table if not exists followups (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  contact_id       uuid references contacts (id) on delete set null,
  conversation_id  uuid references conversations (id) on delete set null,
  order_id         uuid references orders (id) on delete set null,
  tipo             text not null,
  status           text not null default 'pendente',
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  message_body     text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_followups_due on followups (organization_id, status, scheduled_at);

-- ── Registro de consentimento (LGPD) ────────────────────────────────────────
create table if not exists consent_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  contact_id       uuid references contacts (id) on delete set null,
  tipo             text not null,
  canal            text,
  mensagem_ref     text,
  ip               text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_consent_contact on consent_log (organization_id, contact_id);

-- ── Colunas de CRM em contacts (Guia §8.4) ──────────────────────────────────
alter table contacts add column if not exists birthday               date;
alter table contacts add column if not exists city                   text;
alter table contacts add column if not exists address                text;
alter table contacts add column if not exists data_aniversario       date;
alter table contacts add column if not exists origem_lead            text;
alter table contacts add column if not exists tipo_cliente           text;
alter table contacts add column if not exists status_funil           text;
alter table contacts add column if not exists consentimento_marketing boolean default false;
alter table contacts add column if not exists interesses             jsonb default '[]';
alter table contacts add column if not exists cpf                    text;
alter table contacts add column if not exists historico_pedidos      jsonb default '[]';

-- ── RLS: cada org só enxerga os próprios registros (current_org_id()) ───────
alter table products    enable row level security;
alter table fragrances  enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table followups   enable row level security;
alter table consent_log enable row level security;

drop policy if exists products_all on products;
create policy products_all on products for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

drop policy if exists fragrances_all on fragrances;
create policy fragrances_all on fragrances for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

drop policy if exists orders_all on orders;
create policy orders_all on orders for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

drop policy if exists order_items_all on order_items;
create policy order_items_all on order_items for all
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.organization_id = current_org_id()));

drop policy if exists followups_all on followups;
create policy followups_all on followups for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

drop policy if exists consent_all on consent_log;
create policy consent_all on consent_log for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());


-- ===== seed_essentiale.sql =====
-- ─────────────────────────────────────────────────────────────────────────────
-- Seed Essentiale — organização + agente Caroline.
-- Rodar DEPOIS das migrations (0001..0021). Idempotente.
-- Os produtos e fragrâncias estão em seed_products.sql e seed_fragrances.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- Organização Essentiale (single-tenant nesta instalação).
insert into organizations (id, name, document)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Essentiale Fragrance', null)
on conflict (id) do nothing;

-- Agente Caroline (OpenAI gpt-4.1-mini). Só cria se ainda não existir um para a org.
insert into ai_agents (organization_id, channel_id, name, prompt, model, config, active)
select
  'aaaaaaaa-0000-0000-0000-000000000001',
  null,
  'Caroline',
  '',
  'gpt-4.1-mini',
  '{
    "temperature": 0.4,
    "use_emojis": true,
    "single_message": false,
    "execute_actions": true,
    "restrict_to_allowlist": false,
    "tone": "Calorosa, consultiva e próxima — voz recifense da Essentiale",
    "greeting": "Olá! Tudo bem? Meu nome eh Caroline 🌷 Como posso ajudar você hoje?"
  }'::jsonb,
  true
where not exists (
  select 1 from ai_agents where organization_id = 'aaaaaaaa-0000-0000-0000-000000000001'
);


-- ===== seed_products.sql =====
INSERT INTO products (organization_id,nome,slug,categoria,preco_centavos,url_produto,descricao,caracteristicas,exemplos_de_uso,cuidados,foto_arquivo,ativo,estoque) VALUES
('aaaaaaaa-0000-0000-0000-000000000001','Home Spray Felicità 250ml','home-spray-felicita-250ml','Home Spray',8900,'https://www.essentialefragrance.com.br/produtos/home-spray-felicita-250ml/','Spray de ambiente da fragrância Felicità (herbal/cítrica), a mais vendida da Essentiale. Refrescante e revigorante, perfuma o ambiente na hora e ainda pode ser usado em tecidos. Acompanha lindo saquinho de veludo para presentear.','["250ml — frasco de vidro (17cm alt. x 5,5cm diâm.), ~515g com embalagem", "Família: Herbal/Cítrico — saída Bamboo, Alecrim, Lavanda; corpo Limão Siciliano, Menta; fundo Flor de Maracujá, Verbena", "Composição: álcool de cereais, água e essência premium", "Artesanal, vegano, não testado em animais, embalagem reutilizável"]'::jsonb,'["Borrife no ar para perfumar a sala/quarto na hora", "Aplique a 30cm em cortinas, almofadas, cama e toalhas para o aroma durar mais", "Para perfume mais intenso, 2 a 3x ao dia", "Combine com o difusor de varetas da mesma fragrância para potencializar"]'::jsonb,'Destrave o gatilho e aplique a quantidade necessária para aromatizar o ambiente. Em tecidos, aplique a 30cm de distância. Para perfume mais intenso, 2 a 3x ao dia. Borrife em cortinas, almofadas, tapetes, cama e toalhas para o aroma durar mais. Evite contato com superfícies sensíveis (álcool/óleo podem manchar). Não ingerir nem aplicar na pele.','home-spray-felicita-250ml.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Home Spray Poésie 250ml','home-spray-poesie-250ml','Home Spray',8900,'https://www.essentialefragrance.com.br/produtos/home-spray-poesie-250ml-frh05/','Spray de ambiente Poésie (floral): romântica e atemporal, docinha sem ser enjoativa. Transforma o espaço num cenário de aconchego e conexão. Acompanha saquinho de veludo.','["250ml — frasco de vidro, ~515g com embalagem", "Família: Floral — saída Pimenta Rosa, Bergamota; corpo Rosas, Jasmim Sambac, Gardênia; fundo Patchouli, Almíscar, Sândalo, Baunilha", "Composição: álcool de cereais, água e essência premium", "Artesanal, vegano, não testado em animais"]'::jsonb,'["Ideal para quarto, living e cantos de acolhimento", "Borrife no ambiente e em tecidos a 30cm", "Combine com a vela ou o difusor Poésie"]'::jsonb,'Destrave o gatilho e aplique a quantidade necessária para aromatizar o ambiente. Em tecidos, aplique a 30cm de distância. Para perfume mais intenso, 2 a 3x ao dia. Borrife em cortinas, almofadas, tapetes, cama e toalhas para o aroma durar mais. Evite contato com superfícies sensíveis (álcool/óleo podem manchar). Não ingerir nem aplicar na pele.','home-spray-poesie-250ml.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Home Spray Delicata 250ml','home-spray-delicata-250ml','Home Spray',8900,'https://www.essentialefragrance.com.br/produtos/home-spray-delicata-250ml/','Spray de ambiente na fragrância Delicata. Notas no site. Acompanha saquinho de veludo.','["250ml — frasco de vidro", "Fragrância Delicata (ficha completa no site)", "Composição: álcool de cereais, água e essência premium"]'::jsonb,'["Perfume o ambiente e tecidos", "Combine com difusor/vela Delicata"]'::jsonb,'Destrave o gatilho e aplique a quantidade necessária para aromatizar o ambiente. Em tecidos, aplique a 30cm de distância. Para perfume mais intenso, 2 a 3x ao dia. Borrife em cortinas, almofadas, tapetes, cama e toalhas para o aroma durar mais. Evite contato com superfícies sensíveis (álcool/óleo podem manchar). Não ingerir nem aplicar na pele.','home-spray-delicata-250ml.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Home Spray Iluminatè 250ml','home-spray-iluminate-250ml','Home Spray',8900,'https://www.essentialefragrance.com.br/produtos/home-spray-iluminate-250ml/','Spray de ambiente na fragrância Iluminatè. Notas no site. Acompanha saquinho de veludo.','["250ml — frasco de vidro", "Fragrância Iluminatè (ficha no site)"]'::jsonb,'["Perfume ambientes e tecidos"]'::jsonb,'Destrave o gatilho e aplique a quantidade necessária para aromatizar o ambiente. Em tecidos, aplique a 30cm de distância. Para perfume mais intenso, 2 a 3x ao dia. Borrife em cortinas, almofadas, tapetes, cama e toalhas para o aroma durar mais. Evite contato com superfícies sensíveis (álcool/óleo podem manchar). Não ingerir nem aplicar na pele.','home-spray-iluminate-250ml.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Difusor de Varetas para Ambientes Felicità 250ml','difusor-de-varetas-para-ambientes-felicita-250ml','Difusor',9900,'https://www.essentialefragrance.com.br/produtos/difusor-de-varetas-para-ambientes-felicita-250ml/','Difusor de varetas Felicità: aroma contínuo e elegante para casa ou trabalho. Essências de alto padrão e excelente fixação. Lindo vidro com refil e varetas.','["250ml com varetas", "Fragrância Felicità (herbal/cítrica)", "Aromatização constante e silenciosa, sem chama nem eletricidade"]'::jsonb,'["No 1º uso, coloque o líquido, insira as varetas e inverta-as para umedecer", "Inverta as varetas a cada poucos dias para reativar o perfume", "Deixe em local de pouca ventilação para o aroma se concentrar", "Ao acabar, higienize o vidro e reponha com refil de 1L"]'::jsonb,'No primeiro uso, coloque o líquido no vidro, insira as varetas e inverta-as algumas vezes para umedecer. Inverta as varetas periodicamente para intensificar o perfume. Mantenha em local de menos ventilação e não muito alto, para o aroma se concentrar. Ao trocar de refil, higienize o vidro com água e sabão, seque bem e use sempre varetas novas.','difusor-de-varetas-para-ambientes-felicita-250ml.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Difusor Elétrico de Porcelana','difusor-eletrico-de-porcelana','Difusor',6990,'https://www.essentialefragrance.com.br/produtos/difusor-eletrico-de-porcelana/','Difusor elétrico de porcelana: aromatização eficiente e praticamente imediata. Mantém temperatura constante ligado à tomada — alternativa segura para quem prefere evitar chamas, ideal para exalação por longos períodos. Use com as essências concentradas.','["Porcelana + sistema elétrico (tomada)", "Sem chama — seguro para quartos e escritórios", "Funciona com as essências concentradas Essentiale", "Parcelável em até 3x"]'::jsonb,'["Pingue de 10 a 15 gotas de essência concentrada no prato", "Ligue na tomada; o calor constante dissipa o aroma por horas", "Ótimo para ambientes onde não se pode acender vela"]'::jsonb,'Mantenha os produtos longe de crianças, pets e objetos inflamáveis, ao abrigo de luz e calor. Não usar perto de fonte de calor. Não ingerir nem colocar em contato com olhos e pele. Em caso de contato com os olhos, lave com água em abundância.','difusor-eletrico-de-porcelana.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Aromatizador para Carro Felicità','aromatizador-para-carro-felicita','Difusor',3800,'https://www.essentialefragrance.com.br/produtos/aromatizador-para-carro-felicita/','Aromatizador para carro na fragrância Felicità — perfume o trajeto com frescor.','["Para automóvel", "Fragrância Felicità", "Também disponível em Delicata, Explosie e Luxus"]'::jsonb,'["Fixe no carro e regule a intensidade conforme o modelo"]'::jsonb,'Mantenha os produtos longe de crianças, pets e objetos inflamáveis, ao abrigo de luz e calor. Não usar perto de fonte de calor. Não ingerir nem colocar em contato com olhos e pele. Em caso de contato com os olhos, lave com água em abundância.','aromatizador-para-carro-felicita.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Essência Concentrada Felicità 18ml','essencia-concentrada-felicita-18ml','Essência',4000,'https://www.essentialefragrance.com.br/produtos/essencia-concentrada-felicita-18ml/','Essência concentrada Felicità para usar no difusor elétrico. Alta concentração e fixação — rende muitas aplicações com poucas gotas.','["18ml concentrado", "Para difusor elétrico", "Fragrância Felicità"]'::jsonb,'["10 a 15 gotinhas no difusor elétrico", "Não aplicar na pele"]'::jsonb,'Use de 10 a 15 gotinhas no difusor elétrico ou conforme o aparelho. Não aplicar na pele. Mantenha longe de crianças, pets, olhos e fontes de calor.','essencia-concentrada-felicita-18ml.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Refil Home Spray 1000ml','refil-home-spray-1000ml','Refil',16000,'https://www.essentialefragrance.com.br/search/?q=Refil','Refil de 1 litro para home spray. Rende cerca de 4 reposições de 250ml — aproveita a embalagem e sai muito mais em conta. Disponível em várias fragrâncias (Delicata, Iluminatè, Luxus, etc.).','["1000ml (1 litro)", "Rende ~4x um frasco de 250ml", "Várias fragrâncias"]'::jsonb,'["Complete o frasco do home spray já usado", "Ótimo custo-benefício para quem já tem o produto"]'::jsonb,'Destrave o gatilho e aplique a quantidade necessária para aromatizar o ambiente. Em tecidos, aplique a 30cm de distância. Para perfume mais intenso, 2 a 3x ao dia. Borrife em cortinas, almofadas, tapetes, cama e toalhas para o aroma durar mais. Evite contato com superfícies sensíveis (álcool/óleo podem manchar). Não ingerir nem aplicar na pele.','refil-home-spray-1000ml.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Refil Difusor 1000ml','refil-difusor-1000ml','Refil',16000,'https://www.essentialefragrance.com.br/search/?q=Refil','Refil de 1 litro para difusor de varetas. Rende ~4 reposições. Em promoção recorrente.','["1000ml", "Rende ~4 reposições do difusor 250ml", "Use sempre varetas novas"]'::jsonb,'["Higienize o vidro, complete com o refil e troque as varetas"]'::jsonb,'No primeiro uso, coloque o líquido no vidro, insira as varetas e inverta-as algumas vezes para umedecer. Inverta as varetas periodicamente para intensificar o perfume. Mantenha em local de menos ventilação e não muito alto, para o aroma se concentrar. Ao trocar de refil, higienize o vidro com água e sabão, seque bem e use sempre varetas novas.','refil-difusor-1000ml.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Sabonete Líquido Felicità 250ml','sabonete-liquido-felicita-250ml','Sabonete',7900,'https://www.essentialefragrance.com.br/produtos/sabonete-liquido-felicita-250ml/','Sabonete líquido perfumado na fragrância Felicità — cuidado e aroma para o lavabo e banheiro.','["250ml", "Fragrância Felicità", "Compõe kits de casa/banho"]'::jsonb,'["Use nas mãos e corpo", "Combine com home spray e difusor da mesma fragrância no lavabo"]'::jsonb,'Mantenha os produtos longe de crianças, pets e objetos inflamáveis, ao abrigo de luz e calor. Não usar perto de fonte de calor. Não ingerir nem colocar em contato com olhos e pele. Em caso de contato com os olhos, lave com água em abundância.','sabonete-liquido-felicita-250ml.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Felicità 145g','vela-aromatica-felicita-145g','Vela',7600,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-felicita-145g/','Vela aromática artesanal Felicità 145g. Cera vegetal, pavio de algodão e queima limpa. Perfuma e traz conforto e bem-estar ao ambiente.','["145g (tamanho P)", "Cera vegetal sem corante, essência premium, pavio de algodão", "Fragrância Felicità (herbal/cítrica)", "Feita à mão"]'::jsonb,'["Na 1ª queima, deixe a cera derreter até a borda (evita túnel)", "Não passe de 2h acesa (tamanho P)", "Apare o pavio a 0,5cm antes de cada uso"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-felicita-145g.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Poésie 200g','vela-aromatica-poesie-200g','Vela',8900,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-poesie-200g/','Vela aromática Poésie 200g (floral, romântica). Maior duração de queima.','["200g (tamanho G)", "Cera vegetal, pavio de algodão", "Fragrância Poésie"]'::jsonb,'["1ª queima até a borda derreter", "Não passe de 3h acesa (tamanho G)", "Apare o pavio a 0,5cm"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-poesie-200g.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Jardim de Flores','vela-aromatica-jardim-de-flores','Vela',14900,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-jardim-de-flores/','Vela aromática decorada com flores — peça presente, lindíssima na mesa. Disponível nas fragrâncias Poesie, Avelinè e Felicità.','["Edição decorada (flores)", "Fragrâncias: Poesie / Avelinè / Felicità", "Presente premium"]'::jsonb,'["Ideal para presentear e decorar", "Siga os cuidados de queima das velas"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-jardim-de-flores.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Tulipa','vela-aromatica-tulipa','Vela',7900,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-tulipa/','Vela aromática com decoração de tulipa. Fragrâncias Felicità ou Poesie.','["Decoração tulipa", "Fragrâncias: Felicità / Poesie"]'::jsonb,'["Presente e decoração", "Cuidados de queima padrão"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-tulipa.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Buquê Floral','vela-aromatica-buque-floral','Vela',10900,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-buque-floral-s-caixa/','Vela aromática em formato de buquê floral. Fragrâncias Poesie ou Avelinè.','["Formato buquê", "Fragrâncias: Poesie / Avelinè"]'::jsonb,'["Presente especial e decoração"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-buque-floral.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Buquê de Hortênsia','vela-aromatica-buque-de-hortensia','Vela',10900,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-hortensia-14riy/','Vela aromática buquê de hortênsia. Fragrâncias Poesie, Avelinè ou Felicità.','["Formato hortênsia", "Fragrâncias: Poesie / Avelinè / Felicità"]'::jsonb,'["Presente e decoração"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-buque-de-hortensia.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Laço de Afeto','vela-aromatica-laco-de-afeto','Vela',18900,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-laco-afeto/','Vela aromática premium ''Laço de Afeto''. Fragrâncias Avelinè, Poesie ou Felicità.','["Linha presente premium", "Fragrâncias: Avelinè / Poesie / Felicità"]'::jsonb,'["Presente marcante para datas especiais"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-laco-de-afeto.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Amorelle','vela-aromatica-amorelle','Vela',21900,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-amorelle/','Vela aromática Amorelle — peça presente de alto padrão.','["Linha premium"]'::jsonb,'["Presente premium"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-amorelle.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Corações','vela-aromatica-coracoes','Vela',11900,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-coracoes/','Vela aromática decorada com corações — perfeita para Namorados e datas afetivas.','["Decoração corações", "Tema romântico"]'::jsonb,'["Presente para Namorados/aniversários"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-coracoes.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática Avós','vela-aromatica-avos','Vela',8900,'https://www.essentialefragrance.com.br/produtos/vela-aromatica-avos/','Vela aromática tema ''Avós'' — presente afetivo para homenagear.','["Tema afetivo (avós)"]'::jsonb,'["Presente para os avós"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-avos.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Mini Vela Aromática Latinha','mini-vela-aromatica-latinha','Mini Vela / Lembrancinha',1400,'https://www.essentialefragrance.com.br/produtos/mini-vela-aromatica-latinha-fumee/','Mini vela aromática na latinha — lembrancinha campeã de vendas. Tampa dourada ou prata. Pode ser personalizada para festas e eventos.','["Latinha ~20g", "Cor: dourada ou prata", "Personalizável", "Ótima para lembrancinha"]'::jsonb,'["Lembrancinha de casamento, batizado, 15 anos, aniversário", "Cuidados de queima padrão"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','mini-vela-aromatica-latinha.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Mini Vela Aromática Latinha (10 unidades)','mini-vela-aromatica-latinha-10-unidades','Mini Vela / Lembrancinha',13000,'https://www.essentialefragrance.com.br/produtos/10-mini-velas-aromaticas-latinha/','Kit com 10 mini velas na latinha (dourada ou prata) — ideal para lembrancinhas em quantidade.','["10 unidades", "Cor: prata ou dourada", "Valor por volume"]'::jsonb,'["Lembrancinhas de eventos", "Consultar atacado para 20+ unidades"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','mini-vela-aromatica-latinha-10-unidades.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Mini Vela no Envelope de Algodão Cru (10 unidades)','mini-vela-no-envelope-de-algodao-cru-10-unidades','Mini Vela / Lembrancinha',14300,'https://www.essentialefragrance.com.br/produtos/mini-vela-no-envelope-de-algodao-cru-1vx11/','Mini vela em envelope de algodão cru reutilizável — lembrancinha sofisticada e sustentável. Fragrâncias Felicità, Avelinè, Poesie ou Delicata; tampa dourada ou prata.','["10 ou 15 unidades", "Envelope de algodão cru (reutilizável)", "Fragrâncias variadas", "Personalizável"]'::jsonb,'["Lembrancinha premium para eventos", "Envelope vira mimo extra"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','mini-vela-no-envelope-de-algodao-cru-10-unidades.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Mini Vela Aromática (Lembrancinhas)','mini-vela-aromatica-lembrancinhas','Mini Vela / Lembrancinha',1400,'https://www.essentialefragrance.com.br/produtos/mini-vela-aromatica-lembrancinhas-17hou/','Mini vela aromática para lembrancinhas — unidade avulsa, personalizável.','["Unidade", "Personalizável"]'::jsonb,'["Lembrancinha de festa"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','mini-vela-aromatica-lembrancinhas.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Mini Vela Envelope de Afeto','mini-vela-envelope-de-afeto','Mini Vela / Lembrancinha',1490,'https://www.essentialefragrance.com.br/produtos/mini-vela-envelope-de-afeto-1rl08/','Mini vela no envelope de afeto com rótulos temáticos (Dia das Mulheres, Páscoa, Dia das Mães). Fragrâncias Felicità, Poesie ou Avelinè.','["Envelope com mensagem", "Rótulos temáticos por data", "Fragrâncias variadas"]'::jsonb,'["Lembrancinha de data comemorativa", "Brinde afetivo para clientes"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','mini-vela-envelope-de-afeto.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Mini Vela Mensageira Envelope do Amor','mini-vela-mensageira-envelope-do-amor','Mini Vela / Lembrancinha',1590,'https://www.essentialefragrance.com.br/produtos/mini-vela-envelope-do-amor-1aryb/','Mini vela mensageira no ''Envelope do Amor'' — rótulos ''Eu Te Amo'' / ''Meu Amor Todinho Seu''. Fragrâncias Avelinè ou Dolcè. Perfeita para Namorados.','["Envelope romântico", "Rótulos: Eu Te Amo / Meu Amor Todinho Seu", "Fragrâncias: Avelinè / Dolcè"]'::jsonb,'["Mimo de Namorados", "Lembrancinha afetiva"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','mini-vela-mensageira-envelope-do-amor.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática 30g (10 unidades)','vela-aromatica-30g-10-unidades','Vela (atacado)',18990,'https://www.essentialefragrance.com.br/produtos/10-velas-aromaticas-30g-1fuzy/','Caixa com 10 velas de 30g — tampa dourada ou prata. Para presentes e revenda.','["10 unidades de 30g", "Tampa dourada ou prata"]'::jsonb,'["Lembrancinhas/revenda"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-30g-10-unidades.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Vela Aromática 200g (10 unidades)','vela-aromatica-200g-10-unidades','Vela (atacado)',70000,'https://www.essentialefragrance.com.br/produtos/10-velas-aromaticas-200g-1842n/','Caixa com 10 velas de 200g — fragrâncias variadas; tampa dourada, prata ou madeira pinus.','["10 unidades de 200g", "Fragrâncias: Avelinè, Delicata, Felicità, Poesie, Vivaqua", "Tampas: dourada / prata / madeira pinus"]'::jsonb,'["Revenda e presentes em volume"]'::jsonb,'A primeira queima determina a memória da vela: ao acender, espere a cera derretida atingir toda a borda do frasco, evitando a formação de túnel e garantindo queima uniforme. Não ultrapasse 3h (velas G) ou 2h (velas P) acesa. Antes de cada uso, apare o pavio deixando cerca de 0,5cm. Mantenha longe de corrente de ar, superfícies instáveis e materiais inflamáveis. Pare de usar quando restar 1/4 da cera. Pequenas variações de cor/manchas no vidro são normais em produto artesanal e não afetam o desempenho.','vela-aromatica-200g-10-unidades.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Caixa com Home Spray (10 unidades)','caixa-com-home-spray-10-unidades','Atacado/Kit',83000,'https://www.essentialefragrance.com.br/produtos/caixa-com-home-spray-100ml-j5dtr/','Caixa com 10 home sprays — para revenda e brindes corporativos. Quantidades 10/20/30.','["10, 20 ou 30 unidades", "Para lojista/empresa"]'::jsonb,'["Revenda / brinde corporativo"]'::jsonb,'Destrave o gatilho e aplique a quantidade necessária para aromatizar o ambiente. Em tecidos, aplique a 30cm de distância. Para perfume mais intenso, 2 a 3x ao dia. Borrife em cortinas, almofadas, tapetes, cama e toalhas para o aroma durar mais. Evite contato com superfícies sensíveis (álcool/óleo podem manchar). Não ingerir nem aplicar na pele.','caixa-com-home-spray-10-unidades.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Caixa com Difusor de Varetas (10 unidades)','caixa-com-difusor-de-varetas-10-unidades','Atacado/Kit',93000,'https://www.essentialefragrance.com.br/produtos/caixa-com-difusor-de-varetas-250ml-1wbwb/','Caixa com 10 difusores de varetas — revenda e brindes. Quantidades 10/20/30.','["10, 20 ou 30 unidades"]'::jsonb,'["Revenda / brinde corporativo"]'::jsonb,'No primeiro uso, coloque o líquido no vidro, insira as varetas e inverta-as algumas vezes para umedecer. Inverta as varetas periodicamente para intensificar o perfume. Mantenha em local de menos ventilação e não muito alto, para o aroma se concentrar. Ao trocar de refil, higienize o vidro com água e sabão, seque bem e use sempre varetas novas.','caixa-com-difusor-de-varetas-10-unidades.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Escalda Pés Relaxante','escalda-pes-relaxante','Bem-estar',1800,'https://www.essentialefragrance.com.br/produtos/escaldas-pes-relaxante-4c46m/','Escalda-pés relaxante — autocuidado e relaxamento; compõe kits de bem-estar.','["Unidade", "Também em caixa com 10/20/30/40"]'::jsonb,'["Dissolva na água morna para escaldar os pés", "Combine com vela aromática para um ritual relaxante"]'::jsonb,'Mantenha os produtos longe de crianças, pets e objetos inflamáveis, ao abrigo de luz e calor. Não usar perto de fonte de calor. Não ingerir nem colocar em contato com olhos e pele. Em caso de contato com os olhos, lave com água em abundância.','escalda-pes-relaxante.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Escalda Pés Relaxante (10 unidades)','escalda-pes-relaxante-10-unidades','Bem-estar',17500,'https://www.essentialefragrance.com.br/produtos/escalda-pes-relaxante-copia-1ib9c/','Kit com 10 escalda-pés — para revenda e kits de autocuidado. Quantidades 10/20/30/40.','["10 a 40 unidades"]'::jsonb,'["Kits de bem-estar / revenda"]'::jsonb,'Mantenha os produtos longe de crianças, pets e objetos inflamáveis, ao abrigo de luz e calor. Não usar perto de fonte de calor. Não ingerir nem colocar em contato com olhos e pele. Em caso de contato com os olhos, lave com água em abundância.','escalda-pes-relaxante-10-unidades.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Mini Tábua Afetiva','mini-tabua-afetiva','Personalizado',3490,'https://www.essentialefragrance.com.br/produtos/mini-tabua-afetiva/','Mini tábua afetiva personalizada com frase — lembrancinha e presente charmoso (10x15).','["~10x15cm", "Frase personalizável"]'::jsonb,'["Lembrancinha de evento", "Presente afetivo"]'::jsonb,'Mantenha os produtos longe de crianças, pets e objetos inflamáveis, ao abrigo de luz e calor. Não usar perto de fonte de calor. Não ingerir nem colocar em contato com olhos e pele. Em caso de contato com os olhos, lave com água em abundância.','mini-tabua-afetiva.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Mini Tábua Afetiva (20 unidades)','mini-tabua-afetiva-20-unidades','Personalizado',62800,'https://www.essentialefragrance.com.br/produtos/mini-tabua-afetiva-khffi/','Kit com 20 mini tábuas afetivas personalizadas — quantidades 20/40/60.','["20, 40 ou 60 unidades", "Personalização de frase"]'::jsonb,'["Lembrancinhas em volume"]'::jsonb,'Mantenha os produtos longe de crianças, pets e objetos inflamáveis, ao abrigo de luz e calor. Não usar perto de fonte de calor. Não ingerir nem colocar em contato com olhos e pele. Em caso de contato com os olhos, lave com água em abundância.','mini-tabua-afetiva-20-unidades.webp',true,999),
('aaaaaaaa-0000-0000-0000-000000000001','Cartão Afetivo Floral “Eu te Amo”','cartao-afetivo-floral-eu-te-amo','Acessório',2000,'https://www.essentialefragrance.com.br/produtos/cartao-afetivo-floral-eu-te-amo/','Cartão afetivo floral ''Eu te Amo'' — complemento perfeito para acompanhar presentes.','["Cartão decorado"]'::jsonb,'["Acompanha velas, home sprays e kits"]'::jsonb,'Mantenha os produtos longe de crianças, pets e objetos inflamáveis, ao abrigo de luz e calor. Não usar perto de fonte de calor. Não ingerir nem colocar em contato com olhos e pele. Em caso de contato com os olhos, lave com água em abundância.','cartao-afetivo-floral-eu-te-amo.webp',true,999)
ON CONFLICT (organization_id,slug) DO UPDATE SET
  nome=EXCLUDED.nome, categoria=EXCLUDED.categoria, preco_centavos=EXCLUDED.preco_centavos,
  url_produto=EXCLUDED.url_produto, descricao=EXCLUDED.descricao,
  caracteristicas=EXCLUDED.caracteristicas, exemplos_de_uso=EXCLUDED.exemplos_de_uso,
  cuidados=EXCLUDED.cuidados, foto_arquivo=EXCLUDED.foto_arquivo,
  ativo=EXCLUDED.ativo, updated_at=now();

-- ===== seed_fragrances.sql =====
INSERT INTO fragrances (organization_id,nome,perfil,indicar_para,notas,confirmada) VALUES
('aaaaaaaa-0000-0000-0000-000000000001','Felicità','','','{}'::jsonb,true),
('aaaaaaaa-0000-0000-0000-000000000001','Poésie','','','{}'::jsonb,true),
('aaaaaaaa-0000-0000-0000-000000000001','Avelinè','','','{}'::jsonb,true),
('aaaaaaaa-0000-0000-0000-000000000001','Delicata','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Explosie','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Iluminatè','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Luxus','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Uniquè','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Vivace','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Serène','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Vollutà','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Vivaqua','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Speziata','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Solarie','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Voluttà','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Mièlle','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Dolcè','','','{}',false)
ON CONFLICT (organization_id,nome) DO UPDATE SET
  perfil=EXCLUDED.perfil, indicar_para=EXCLUDED.indicar_para,
  notas=EXCLUDED.notas, confirmada=EXCLUDED.confirmada;
