-- Vincula cada automação a uma integração SGP específica (opcional).
-- Quando preenchido, o pipeline usa esse SGP em vez de buscar o primeiro da org.
alter table automations
  add column if not exists integration_id uuid references integrations(id) on delete set null;

-- Horário de execução por automação.
-- Formato: {"sun":[],"mon":[["08:00","18:00"]],...}
-- null ou objeto vazio = sem restrição (roda 24/7).
alter table automations
  add column if not exists schedule jsonb;
