-- Telefone real do autor de mensagens de grupo (para abrir conversa 1:1 ao clicar no nome).
alter table messages add column if not exists author_phone text;
