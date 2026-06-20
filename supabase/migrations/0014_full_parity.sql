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
