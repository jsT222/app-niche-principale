-- =====================================================================
-- RLS : chaque utilisateur ne voit que ses hôtels, droits d'écriture par rôle
-- =====================================================================

create or replace function public.my_hotel_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select hotel_id from user_hotel_roles where user_id = auth.uid() $$;

create or replace function public.has_hotel_role(p_hotel uuid, p_roles app_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from user_hotel_roles
    where user_id = auth.uid() and hotel_id = p_hotel and role = any(p_roles)
  )
$$;

revoke execute on function public.my_hotel_ids() from anon;
revoke execute on function public.has_hotel_role(uuid, app_role[]) from anon;

-- Tables de référence
alter table organizations enable row level security;
alter table hotels enable row level security;
alter table profiles enable row level security;
alter table user_hotel_roles enable row level security;

create policy "org visible aux membres" on organizations for select to authenticated
  using (id in (select organization_id from hotels where id in (select my_hotel_ids())));
create policy "hôtels visibles aux membres" on hotels for select to authenticated
  using (id in (select my_hotel_ids()));
create policy "propriétaire modifie l'hôtel" on hotels for update to authenticated
  using (has_hotel_role(id, '{owner}')) with check (has_hotel_role(id, '{owner}'));
create policy "profil visible collègues" on profiles for select to authenticated
  using (id = auth.uid() or id in (select user_id from user_hotel_roles where hotel_id in (select my_hotel_ids())));
create policy "profil modifiable par soi" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "rôles visibles" on user_hotel_roles for select to authenticated
  using (hotel_id in (select my_hotel_ids()));

-- Tables opérationnelles : lecture = membres de l'hôtel, écriture = rôles listés
do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- table,                 rôles lecture,                                  rôles écriture
      ('room_types',            '{owner,reception,housekeeping,maintenance}', '{owner}'),
      ('rooms',                 '{owner,reception,housekeeping,maintenance}', '{owner,reception,housekeeping,maintenance}'),
      ('guests',                '{owner,reception}',                          '{owner,reception}'),
      ('reservations',          '{owner,reception,housekeeping}',             '{owner,reception}'),
      ('payments',              '{owner,reception}',                          '{owner,reception}'),
      ('invoices',              '{owner,reception}',                          '{owner,reception}'),
      ('calls',                 '{owner,reception}',                          '{owner,reception}'),
      ('conversations',         '{owner,reception}',                          '{owner,reception}'),
      ('messages',              '{owner,reception}',                          '{owner,reception}'),
      ('suppliers',             '{owner,reception}',                          '{owner}'),
      ('inventory_items',       '{owner,reception,housekeeping}',             '{owner,reception,housekeeping}'),
      ('purchase_orders',       '{owner,reception}',                          '{owner}'),
      ('purchase_order_lines',  '{owner,reception}',                          '{owner}'),
      ('stock_movements',       '{owner,reception,housekeeping}',             '{owner,reception,housekeeping}'),
      ('staff',                 '{owner,reception,housekeeping,maintenance}', '{owner}'),
      ('shifts',                '{owner,reception,housekeeping,maintenance}', '{owner}'),
      ('tasks',                 '{owner,reception,housekeeping,maintenance}', '{owner,reception,housekeeping,maintenance}'),
      ('notifications',         '{owner,reception,housekeeping,maintenance}', '{owner,reception,housekeeping,maintenance}'),
      ('housekeeping_tasks',    '{owner,reception,housekeeping}',             '{owner,reception,housekeeping}'),
      ('maintenance_tickets',   '{owner,reception,housekeeping,maintenance}', '{owner,reception,housekeeping,maintenance}'),
      ('preventive_plans',      '{owner,maintenance}',                        '{owner,maintenance}'),
      ('daily_rates',           '{owner,reception}',                          '{owner}'),
      ('pricing_rules',         '{owner,reception}',                          '{owner}'),
      ('local_events',          '{owner,reception}',                          '{owner}'),
      ('competitor_rates',      '{owner,reception}',                          '{owner}'),
      ('reviews',               '{owner,reception}',                          '{owner,reception}'),
      ('automations',           '{owner,reception,housekeeping,maintenance}', '{owner}'),
      ('automation_runs',       '{owner,reception,housekeeping,maintenance}', '{owner,reception}'),
      ('integration_settings',  '{owner}',                                    '{owner}')
    ) as t(tbl, read_roles, write_roles)
  loop
    execute format('alter table %I enable row level security', r.tbl);
    execute format(
      'create policy "lecture membres" on %I for select to authenticated using (has_hotel_role(hotel_id, %L::app_role[]))',
      r.tbl, r.read_roles);
    execute format(
      'create policy "insertion par rôle" on %I for insert to authenticated with check (has_hotel_role(hotel_id, %L::app_role[]))',
      r.tbl, r.write_roles);
    execute format(
      'create policy "modification par rôle" on %I for update to authenticated using (has_hotel_role(hotel_id, %L::app_role[])) with check (has_hotel_role(hotel_id, %L::app_role[]))',
      r.tbl, r.write_roles, r.write_roles);
    execute format(
      'create policy "suppression propriétaire" on %I for delete to authenticated using (has_hotel_role(hotel_id, ''{owner}''::app_role[]))',
      r.tbl);
  end loop;
end $$;
