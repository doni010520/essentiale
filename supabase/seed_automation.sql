-- ─────────────────────────────────────────────────────────────────────────────
-- Automação "Atendimento Caroline": flow start → nó de IA → agente ativo (Caroline).
-- Sem isto, mensagens recebidas ficam na fila e a Caroline não responde.
-- Idempotente: só cria se ainda não existir uma com esse nome na org.
-- ─────────────────────────────────────────────────────────────────────────────
insert into automations (organization_id, name, flow, active)
select
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Atendimento Caroline',
  $$ {"nodes":[{"id":"start","data":{"kind":"start"}},{"id":"ai1","data":{"kind":"ai","content":"Continue o atendimento como Caroline, consultora da Essentiale."}}],"edges":[{"id":"e1","source":"start","target":"ai1"}]} $$::jsonb,
  true
where not exists (
  select 1 from automations
  where organization_id = 'aaaaaaaa-0000-0000-0000-000000000001' and name = 'Atendimento Caroline'
);
