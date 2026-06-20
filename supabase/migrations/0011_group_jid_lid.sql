-- JID completo do grupo (preserva traço de jids antigos) e LID do autor (p/ resolver 1:1).
alter table contacts add column if not exists chat_jid text;
alter table messages add column if not exists author_lid text;

-- Recria a view expondo o JID do contato/grupo.
drop view if exists conversation_overview;
create view conversation_overview
with (security_invoker = true)
as
select
  c.id, c.organization_id, c.status, c.assigned_user_id, c.department_id,
  c.channel_id, c.contact_id, c.protocol, c.last_message_at, c.opened_at,
  c.closed_at, c.created_at, c.is_muted,
  ct.name as contact_name, ct.phone as contact_phone, ct.avatar_url as contact_avatar,
  ct.is_group as is_group, ct.chat_jid as contact_jid,
  ch.name as channel_name, ch.type as channel_type,
  lm.body as last_message_body, lm.content_type as last_message_type,
  lm.direction as last_message_direction, lm.author_name as last_message_author
from conversations c
join contacts ct on ct.id = c.contact_id
join channels ch on ch.id = c.channel_id
left join lateral (
  select body, content_type, direction, author_name
  from messages m where m.conversation_id = c.id
  order by m.created_at desc limit 1
) lm on true;
