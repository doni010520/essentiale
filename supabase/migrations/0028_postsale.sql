-- ─────────────────────────────────────────────────────────────────────────────
-- 0028 — Pós-venda automático (Guia §12: status de pedido + réguas de relacionamento)
-- Depende de: 0026_essentiale.sql (tabela followups, colunas em contacts).
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Nenhuma coluna nova é necessária: `followups.status` é TEXT, então os novos
-- valores usados pelo código ('enviado', 'aguardando_template') já cabem sem
-- alteração de schema. Esta migração apenas garante a existência da tabela e
-- adiciona índices que aceleram as consultas do cron de pós-venda.
-- ─────────────────────────────────────────────────────────────────────────────

-- Garante a tabela followups (no-op se 0026 já a criou).
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

-- Índice principal usado por processDueFollowups (status + scheduled_at).
create index if not exists idx_followups_due on followups (organization_id, status, scheduled_at);

-- Evita reprocessar/duplicar réguas: lookups por (order_id, tipo) e (contact_id, tipo).
create index if not exists idx_followups_order_tipo on followups (organization_id, order_id, tipo);
create index if not exists idx_followups_contact_tipo on followups (organization_id, contact_id, tipo);

-- Acelera a régua de aniversário (varredura de contacts.data_aniversario).
create index if not exists idx_contacts_aniversario on contacts (organization_id, data_aniversario)
  where data_aniversario is not null;
