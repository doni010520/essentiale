-- =====================================================================
-- Fase 1 — Protocolo de atendimento, encerramento e notas internas
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Protocolo: contador diário por organização + trigger de atribuição.
--    Formato: AAAAMMDD + sequência diária (4 dígitos). Ex.: 202606040001
-- ---------------------------------------------------------------------
create table if not exists protocol_counters (
  organization_id uuid not null references organizations (id) on delete cascade,
  day             date not null,
  seq             int  not null default 0,
  primary key (organization_id, day)
);

create or replace function assign_protocol()
returns trigger
language plpgsql
as $$
declare
  n     int;
  today date := (now() at time zone 'America/Bahia')::date;
begin
  if new.protocol is null or new.protocol = '' then
    insert into protocol_counters (organization_id, day, seq)
      values (new.organization_id, today, 1)
      on conflict (organization_id, day)
        do update set seq = protocol_counters.seq + 1
      returning seq into n;
    new.protocol := to_char(today, 'YYYYMMDD') || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_protocol on conversations;
create trigger trg_assign_protocol
  before insert on conversations
  for each row execute function assign_protocol();

-- Backfill: numera conversas existentes sem protocolo (por org+dia, ordem de criação).
with numbered as (
  select
    id,
    to_char((created_at at time zone 'America/Bahia')::date, 'YYYYMMDD') as ymd,
    row_number() over (
      partition by organization_id, (created_at at time zone 'America/Bahia')::date
      order by created_at
    ) as rn
  from conversations
  where protocol is null or protocol = ''
)
update conversations c
   set protocol = n.ymd || lpad(n.rn::text, 4, '0')
  from numbered n
 where n.id = c.id;

-- Sincroniza o contador com o que já existe (evita colisão com novos do mesmo dia).
insert into protocol_counters (organization_id, day, seq)
  select organization_id, (created_at at time zone 'America/Bahia')::date, count(*)
    from conversations
   group by 1, 2
  on conflict (organization_id, day)
    do update set seq = greatest(protocol_counters.seq, excluded.seq);

-- ---------------------------------------------------------------------
-- 2) Encerramento: motivo de encerramento (classificação via conversation_tags).
-- ---------------------------------------------------------------------
alter table conversations add column if not exists close_reason text;
-- Aguardando resposta da pesquisa de satisfação (captura a nota na próxima resposta do cliente).
alter table conversations add column if not exists awaiting_satisfaction boolean not null default false;

-- ---------------------------------------------------------------------
-- 3) Notas internas: mensagens visíveis só aos atendentes (não vão ao cliente).
-- ---------------------------------------------------------------------
alter table messages add column if not exists is_internal boolean not null default false;

-- ---------------------------------------------------------------------
-- 4) Recria a view da inbox expondo satisfação, motivo, atendente e depto.
-- ---------------------------------------------------------------------
drop view if exists conversation_overview;
create view conversation_overview
with (security_invoker = true)
as
select
  c.id, c.organization_id, c.status, c.assigned_user_id, c.department_id,
  c.channel_id, c.contact_id, c.protocol, c.last_message_at, c.opened_at,
  c.closed_at, c.created_at, c.is_muted, c.satisfaction, c.close_reason,
  c.bot_automation_id,
  ct.name as contact_name, ct.phone as contact_phone, ct.avatar_url as contact_avatar,
  ct.is_group as is_group, ct.chat_jid as contact_jid,
  ch.name as channel_name, ch.type as channel_type,
  pr.name as assigned_name,
  dp.name as department_name, dp.color as department_color,
  lm.body as last_message_body, lm.content_type as last_message_type,
  lm.direction as last_message_direction, lm.author_name as last_message_author,
  coalesce(ur.cnt, 0)::int as unread_count
from conversations c
join contacts ct on ct.id = c.contact_id
join channels ch on ch.id = c.channel_id
left join profiles pr on pr.id = c.assigned_user_id
left join departments dp on dp.id = c.department_id
left join lateral (
  select body, content_type, direction, author_name
  from messages m
  where m.conversation_id = c.id and coalesce(m.is_internal, false) = false
  order by m.created_at desc
  limit 1
) lm on true
left join lateral (
  select count(*) as cnt
  from messages m2
  where m2.conversation_id = c.id and m2.direction = 'in' and m2.status <> 'read'
) ur on true;
