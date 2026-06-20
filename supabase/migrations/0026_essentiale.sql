-- ─────────────────────────────────────────────────────────────────────────────
-- 0021 — Domínio Essentiale: catálogo, fragrâncias, pedidos, follow-ups, LGPD
-- Depende de: 0001 (organizations, contacts, conversations), 0002 (current_org_id()).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Catálogo de produtos ────────────────────────────────────────────────────
create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  nome             text not null,
  slug             text not null,
  categoria        text not null,
  preco_centavos   integer not null default 0,
  url_produto      text,
  descricao        text,
  caracteristicas  jsonb not null default '[]',
  exemplos_de_uso  jsonb not null default '[]',
  cuidados         text,
  fragrancia       text,
  foto_arquivo     text,
  foto_url         text,
  galeria          jsonb not null default '[]',
  ativo            boolean not null default true,
  estoque          integer not null default 999,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_products_org on products (organization_id);
create index if not exists idx_products_categoria on products (organization_id, categoria);
create unique index if not exists uq_products_org_slug on products (organization_id, slug);

-- ── Fragrâncias ─────────────────────────────────────────────────────────────
create table if not exists fragrances (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  nome             text not null,
  perfil           text,
  indicar_para     text,
  notas            jsonb not null default '{}',
  confirmada       boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists idx_fragrances_org on fragrances (organization_id);
create unique index if not exists uq_fragrances_org_nome on fragrances (organization_id, nome);

-- ── Pedidos ─────────────────────────────────────────────────────────────────
create table if not exists orders (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations (id) on delete cascade,
  conversation_id    uuid references conversations (id) on delete set null,
  contact_id         uuid references contacts (id) on delete set null,
  nome_completo      text,
  cpf                text,
  email              text,
  telefone           text,
  endereco           text,
  cep                text,
  tipo_entrega       text default 'entrega',
  quem_recebe        text,
  subtotal_centavos  integer not null default 0,
  frete_centavos     integer not null default 0,
  desconto_centavos  integer not null default 0,
  total_centavos     integer not null default 0,
  payment_method     text default 'pix',
  payment_status     text default 'pending',
  checkout_url       text,
  pix_code           text,
  status             text not null default 'novo',
  tracking_code      text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_orders_org on orders (organization_id, created_at desc);
create index if not exists idx_orders_status on orders (organization_id, status);

-- ── Itens do pedido ─────────────────────────────────────────────────────────
create table if not exists order_items (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references orders (id) on delete cascade,
  product_id               uuid references products (id) on delete set null,
  nome                     text not null,
  fragrancia               text,
  quantidade               integer not null default 1,
  preco_unitario_centavos  integer not null default 0,
  subtotal_centavos        integer not null default 0,
  personalizacao           text,
  created_at               timestamptz not null default now()
);
create index if not exists idx_order_items_order on order_items (order_id);

-- ── Follow-ups (réguas de relacionamento / pós-venda) ───────────────────────
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
create index if not exists idx_followups_due on followups (organization_id, status, scheduled_at);

-- ── Registro de consentimento (LGPD) ────────────────────────────────────────
create table if not exists consent_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  contact_id       uuid references contacts (id) on delete set null,
  tipo             text not null,
  canal            text,
  mensagem_ref     text,
  ip               text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_consent_contact on consent_log (organization_id, contact_id);

-- ── Colunas de CRM em contacts (Guia §8.4) ──────────────────────────────────
alter table contacts add column if not exists birthday               date;
alter table contacts add column if not exists city                   text;
alter table contacts add column if not exists address                text;
alter table contacts add column if not exists data_aniversario       date;
alter table contacts add column if not exists origem_lead            text;
alter table contacts add column if not exists tipo_cliente           text;
alter table contacts add column if not exists status_funil           text;
alter table contacts add column if not exists consentimento_marketing boolean default false;
alter table contacts add column if not exists interesses             jsonb default '[]';
alter table contacts add column if not exists cpf                    text;
alter table contacts add column if not exists historico_pedidos      jsonb default '[]';

-- ── RLS: cada org só enxerga os próprios registros (current_org_id()) ───────
alter table products    enable row level security;
alter table fragrances  enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table followups   enable row level security;
alter table consent_log enable row level security;

drop policy if exists products_all on products;
create policy products_all on products for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

drop policy if exists fragrances_all on fragrances;
create policy fragrances_all on fragrances for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

drop policy if exists orders_all on orders;
create policy orders_all on orders for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

drop policy if exists order_items_all on order_items;
create policy order_items_all on order_items for all
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.organization_id = current_org_id()));

drop policy if exists followups_all on followups;
create policy followups_all on followups for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

drop policy if exists consent_all on consent_log;
create policy consent_all on consent_log for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());
