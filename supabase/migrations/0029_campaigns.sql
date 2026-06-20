-- ─────────────────────────────────────────────────────────────────────────────
-- 0029 — Campanhas e disparos (Essentiale, Guia §11)
-- Depende de: 0001 (campaigns, contacts, channels, conversations, messages),
--             0002 (current_org_id() + RLS genérica de campaigns),
--             0018 (campaigns.message), 0026 (contacts CRM: city, tipo_cliente,
--                   interesses, status_funil, consentimento_marketing).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- NÃO EXECUTAR automaticamente — apenas versionar.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Colunas que o app já espera em `campaigns` (type Campaign) mas que a
--    tabela base (0001) não tinha. Tudo com `if not exists` p/ ser idempotente.
alter table campaigns add column if not exists channel_id     uuid references channels (id) on delete set null;
alter table campaigns add column if not exists contact_filter jsonb       not null default '{}';
alter table campaigns add column if not exists started_at      timestamptz;
alter table campaigns add column if not exists finished_at     timestamptz;
alter table campaigns add column if not exists total_contacts  integer     not null default 0;
alter table campaigns add column if not exists sent_count      integer     not null default 0;
alter table campaigns add column if not exists failed_count    integer     not null default 0;

-- A tabela base já restringe status a um CHECK fixo. Acrescentamos o estado
-- 'sending' (em disparo) sem quebrar os valores antigos, recriando o CHECK.
alter table campaigns drop constraint if exists campaigns_status_check;
alter table campaigns add  constraint campaigns_status_check
  check (status in ('draft','scheduled','running','sending','paused','done','failed'));

create index if not exists idx_campaigns_org_created on campaigns (organization_id, created_at desc);

-- ── Log de envios por destinatário (Guia §11.3 — status por contato) ─────────
-- Uma linha por (campanha, contato). Guarda o resultado individual do disparo,
-- a janela de 24h respeitada e a referência da mensagem no provedor.
create table if not exists campaign_recipients (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  campaign_id      uuid not null references campaigns (id) on delete cascade,
  contact_id       uuid references contacts (id) on delete set null,
  phone            text,
  name             text,
  -- pending: na fila | sent: enviado (texto livre, janela 24h aberta)
  -- failed: erro no envio
  -- aguardando_template: disparo proativo fora da janela 24h → exige HSM aprovado
  -- skipped_opt_out: contato sem consentimento_marketing (não deveria ocorrer p/ filtro, mas registra)
  status           text not null default 'pending'
                     check (status in ('pending','sent','failed','aguardando_template','skipped_opt_out')),
  channel          text,                 -- type do canal (meta_cloud / uazapi)
  external_id      text,                 -- id da mensagem no provedor
  error            text,                 -- mensagem de erro quando status='failed'
  in_window_24h    boolean,              -- true se havia inbound do contato < 24h
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_campaign_recipients_campaign on campaign_recipients (campaign_id, status);
create index if not exists idx_campaign_recipients_org on campaign_recipients (organization_id);
create unique index if not exists uq_campaign_recipients_unique on campaign_recipients (campaign_id, contact_id);

-- ── RLS: cada org só enxerga os próprios destinatários ───────────────────────
alter table campaign_recipients enable row level security;
drop policy if exists campaign_recipients_all on campaign_recipients;
create policy campaign_recipients_all on campaign_recipients for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());
