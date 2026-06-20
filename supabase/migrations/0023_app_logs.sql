-- Logs de aplicação acessíveis fora do Easypanel (lidos no /superadmin e via REST).
create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  level text not null default 'info',          -- info | warn | error
  source text not null default 'app',          -- webhook | chatbot | ai | sgp | send | ...
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_logs_created on public.app_logs(created_at desc);
create index if not exists idx_app_logs_level on public.app_logs(level, created_at desc);

alter table public.app_logs enable row level security;
-- Sem policies: só o service role (servidor) escreve/lê.
