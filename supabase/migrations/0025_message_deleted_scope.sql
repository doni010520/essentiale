-- Escopo da exclusão: 'me' (só na plataforma) ou 'everyone' (revogada no cliente).
-- A mensagem permanece no banco (faded na UI) para auditoria/admin.
alter table public.messages
  add column if not exists deleted_scope text;
