-- Marca de superadmin (acesso ao painel /superadmin).
alter table public.profiles
  add column if not exists super_admin boolean not null default false;
