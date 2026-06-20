-- Interações de mensagem: responder (quote), reações, editar, apagar.
alter table messages add column if not exists reply_to_external text;   -- id externo da msg citada
alter table messages add column if not exists reply_excerpt text;        -- trecho da msg citada (cache)
alter table messages add column if not exists reply_author text;         -- autor da msg citada
alter table messages add column if not exists reactions jsonb not null default '[]'; -- [{emoji, by}]
alter table messages add column if not exists is_deleted boolean not null default false;
alter table messages add column if not exists edited boolean not null default false;

create index if not exists messages_external_id_idx on messages (external_id);
