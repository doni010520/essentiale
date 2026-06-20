-- View para a inbox de atendimento: junta conversa + contato + canal + última mensagem.
-- security_invoker = true faz a view respeitar a RLS das tabelas para o usuário que consulta.
create view conversation_overview
with (security_invoker = true)
as
select
  c.id,
  c.organization_id,
  c.status,
  c.assigned_user_id,
  c.department_id,
  c.channel_id,
  c.contact_id,
  c.protocol,
  c.last_message_at,
  c.opened_at,
  c.closed_at,
  c.created_at,
  ct.name        as contact_name,
  ct.phone       as contact_phone,
  ct.avatar_url  as contact_avatar,
  ch.name        as channel_name,
  ch.type        as channel_type,
  lm.body         as last_message_body,
  lm.content_type as last_message_type,
  lm.direction    as last_message_direction
from conversations c
join contacts ct on ct.id = c.contact_id
join channels ch on ch.id = c.channel_id
left join lateral (
  select body, content_type, direction
  from messages m
  where m.conversation_id = c.id
  order by m.created_at desc
  limit 1
) lm on true;
