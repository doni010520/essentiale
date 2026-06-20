-- Mensagens internas entre atendentes: menções + notificações (sino).

-- Menções em mensagens internas: array de { id, name } dos atendentes marcados.
alter table public.messages
  add column if not exists mentions jsonb not null default '[]'::jsonb;

-- Notificações de menção interna (para o sino/badge por atendente).
create table if not exists public.internal_mentions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  mentioned_user_id uuid not null,
  created_by uuid,
  author_name text,
  excerpt text,
  contact_name text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_mentions_user
  on public.internal_mentions(mentioned_user_id, read_at);
create index if not exists idx_internal_mentions_conv
  on public.internal_mentions(conversation_id);

alter table public.internal_mentions enable row level security;

-- Cada atendente vê e marca como lida apenas as próprias menções.
drop policy if exists internal_mentions_select on public.internal_mentions;
create policy internal_mentions_select on public.internal_mentions
  for select using (mentioned_user_id = auth.uid());

drop policy if exists internal_mentions_update on public.internal_mentions;
create policy internal_mentions_update on public.internal_mentions
  for update using (mentioned_user_id = auth.uid());

-- Realtime para o sino.
alter publication supabase_realtime add table public.internal_mentions;
