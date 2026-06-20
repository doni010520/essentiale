-- Encerramento por inatividade: marca quando o aviso foi enviado (pra não repetir).
alter table public.conversations
  add column if not exists inactivity_warned_at timestamptz;

-- Índice pra o cron achar conversas ociosas de forma barata.
create index if not exists idx_conversations_org_status_lastmsg
  on public.conversations(organization_id, status, last_message_at);
