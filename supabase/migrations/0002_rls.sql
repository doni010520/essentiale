-- =====================================================================
-- RLS + onboarding
-- =====================================================================

-- Cria automaticamente um profile quando um usuário se cadastra no Auth.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Onboarding: cria a organização e vincula o usuário atual como admin.
create or replace function create_organization(org_name text, org_document text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org uuid;
begin
  if (select organization_id from profiles where id = auth.uid()) is not null then
    raise exception 'Usuário já pertence a uma organização';
  end if;

  insert into organizations (name, document) values (org_name, org_document)
  returning id into new_org;

  update profiles
     set organization_id = new_org, role = 'admin'
   where id = auth.uid();

  return new_org;
end;
$$;

-- ---------------------------------------------------------------------
-- Habilita RLS e aplica políticas por organização.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  org_tables text[] := array[
    'organizations','profiles','departments','channels','contacts','conversations',
    'messages','tags','quick_replies','wa_templates','automations','campaigns',
    'plans','api_keys','integrations','ai_agents','audit_logs'
  ];
begin
  foreach t in array org_tables loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- organizations: o usuário enxerga/edita a própria org.
create policy org_select on organizations for select using (id = current_org_id());
create policy org_update on organizations for update using (id = current_org_id() and current_role_is('admin'));

-- profiles: enxerga colegas da mesma org; edita o próprio (admin edita todos).
create policy profiles_select on profiles for select
  using (organization_id = current_org_id() or id = auth.uid());
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());
create policy profiles_update on profiles for update
  using (id = auth.uid() or (organization_id = current_org_id() and current_role_is('admin')));

-- Demais tabelas: tudo restrito à org do usuário.
do $$
declare
  t text;
  scoped text[] := array[
    'departments','channels','contacts','conversations','messages','tags',
    'quick_replies','wa_templates','automations','campaigns','plans',
    'api_keys','integrations','ai_agents','audit_logs'
  ];
begin
  foreach t in array scoped loop
    execute format($f$
      create policy %1$s_all on %1$I
        for all
        using (organization_id = current_org_id())
        with check (organization_id = current_org_id());
    $f$, t);
  end loop;
end $$;

-- Tabelas de junção: herdam a org pela entidade pai.
alter table conversation_tags enable row level security;
alter table contact_tags enable row level security;

create policy conversation_tags_all on conversation_tags for all
  using (exists (select 1 from conversations c
                  where c.id = conversation_id and c.organization_id = current_org_id()))
  with check (exists (select 1 from conversations c
                  where c.id = conversation_id and c.organization_id = current_org_id()));

create policy contact_tags_all on contact_tags for all
  using (exists (select 1 from contacts c
                  where c.id = contact_id and c.organization_id = current_org_id()))
  with check (exists (select 1 from contacts c
                  where c.id = contact_id and c.organization_id = current_org_id()));
