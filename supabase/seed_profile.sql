-- ─────────────────────────────────────────────────────────────────────────────
-- RODE ISTO DEPOIS de criar seu usuário de login no projeto novo
-- (Authentication → Users → Add user, ou cadastrando-se pela tela de login do app).
-- Mapeia TODO usuário do Auth para a organização Essentiale como admin.
-- Sem isto, current_org_id() devolve NULL e o app não enxerga nada (RLS bloqueia).
-- ─────────────────────────────────────────────────────────────────────────────
insert into profiles (id, organization_id, name, role)
select
  u.id,
  'aaaaaaaa-0000-0000-0000-000000000001',
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'Essentiale Admin'),
  'admin'
from auth.users u
on conflict (id) do update
  set organization_id = excluded.organization_id,
      role = 'admin';
