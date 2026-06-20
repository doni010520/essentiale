-- ─────────────────────────────────────────────────────────────────────────────
-- GRANTs para os roles do Supabase (anon, authenticated, service_role).
-- O Supabase normalmente aplica isso automaticamente, mas quando o schema é
-- provisionado via SQL cru (Management API / SQL Editor), os grants podem faltar
-- e tudo dá "permission denied" mesmo com RLS correto. A segurança continua por
-- conta do RLS (já habilitado nas tabelas) — o grant só permite o role TENTAR.
-- Rodar por último, depois de todas as tabelas criadas. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Tabelas/sequências/funções criadas no futuro herdam os mesmos grants.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
