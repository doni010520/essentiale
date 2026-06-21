-- ─────────────────────────────────────────────────────────────────────────────
-- contacts.updated_at — o código (registrar_cliente, registrar_optout, criar_pedido)
-- atualiza esta coluna ao enriquecer o CRM. Sem ela, esses updates falhavam em
-- silêncio (coluna inexistente) e o CRM do contato ficava vazio. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
alter table contacts add column if not exists updated_at timestamptz not null default now();
