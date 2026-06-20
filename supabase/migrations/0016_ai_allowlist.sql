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
