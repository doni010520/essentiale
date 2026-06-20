-- Variáveis coletadas durante o fluxo de automação (nós "input") e merge fields.
alter table conversations
  add column if not exists variables jsonb not null default '{}'::jsonb;
