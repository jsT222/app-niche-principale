-- =====================================================================
-- Moteur de réservation (disponibilités, création), tâches planifiées pg_cron
-- =====================================================================

-- Prix d'une nuit pour un type de chambre (tarif du jour, sinon prix de base)
create or replace function public.night_price(p_type uuid, p_date date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select price from daily_rates where room_type_id = p_type and date = p_date),
                  (select base_price from room_types where id = p_type))
$$;

-- Chambre libre d'un type pour une période
create or replace function public.find_free_room(p_type uuid, p_in date, p_out date)
returns uuid language sql stable security definer set search_path = public as $$
  select r.id from rooms r
   where r.room_type_id = p_type and r.hk_status <> 'out_of_order'
     and not exists (select 1 from reservations s
                      where s.room_id = r.id
                        and s.status in ('pending','confirmed','checked_in','checked_out')
                        and daterange(s.check_in, s.check_out, '[)') && daterange(p_in, p_out, '[)'))
   order by r.number limit 1
$$;

-- Disponibilités publiques (moteur de réservation)
create or replace function public.public_availability(p_slug text, p_in date, p_out date, p_guests int default 2)
returns table (room_type_id uuid, code text, name text, capacity int, available int, total numeric, nightly numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_hotel uuid;
begin
  if p_out <= p_in or p_in < current_date or p_out - p_in > 30 then return; end if;
  select id into v_hotel from hotels where slug = p_slug;
  if v_hotel is null then return; end if;
  return query
  select t.id, t.code, t.name, t.capacity::int,
         (select count(*)::int from rooms r
           where r.room_type_id = t.id and r.hk_status <> 'out_of_order'
             and not exists (select 1 from reservations s where s.room_id = r.id
                              and s.status in ('pending','confirmed','checked_in','checked_out')
                              and daterange(s.check_in, s.check_out, '[)') && daterange(p_in, p_out, '[)'))),
         (select round(sum(night_price(t.id, d::date)) * 0.95) from generate_series(p_in, p_out - 1, interval '1 day') d),
         (select round(avg(night_price(t.id, d::date)) * 0.95) from generate_series(p_in, p_out - 1, interval '1 day') d)
    from room_types t
   where t.hotel_id = v_hotel and t.capacity >= p_guests
   order by t.sort;
end $$;
grant execute on function public.public_availability(text, date, date, int) to anon, authenticated;

-- Création d'une réservation (interne)
create or replace function public.create_booking(
  p_hotel uuid, p_type uuid, p_in date, p_out date, p_adults int, p_children int,
  p_first text, p_last text, p_email text, p_phone text, p_lang text,
  p_channel booking_channel, p_status reservation_status, p_requests text, p_paid numeric default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_room uuid; v_guest uuid; v_total numeric; v_code text; v_id uuid; v_prefix text; v_dep numeric; v_n int;
  v_status reservation_status := p_status;
begin
  if p_out <= p_in then raise exception 'Dates invalides'; end if;
  v_room := find_free_room(p_type, p_in, p_out);
  if v_room is null then
    if v_status = 'waitlist' then null; else raise exception 'Plus de chambre disponible pour ces dates'; end if;
  end if;
  if v_status = 'waitlist' then v_room := null; end if;

  select round(sum(night_price(p_type, d::date)) * case when p_channel = 'direct' then 0.95 else 1 end)
    into v_total from generate_series(p_in, p_out - 1, interval '1 day') d;

  -- Fiche client : réutilisée si l'email existe déjà
  select id into v_guest from guests where hotel_id = p_hotel and p_email is not null and lower(email) = lower(p_email) limit 1;
  if v_guest is null then
    insert into guests (hotel_id, first_name, last_name, email, phone, language)
    values (p_hotel, p_first, p_last, nullif(p_email, ''), nullif(p_phone, ''), coalesce(p_lang, 'fr'))
    returning id into v_guest;
  end if;

  v_prefix := case when p_hotel = '11111111-1111-4111-8111-111111111111' then 'TIL'
                   when p_hotel = '22222222-2222-4222-8222-222222222222' then 'MSC' else 'RES' end;
  select coalesce(max(substring(code from '\d+$')::int), 0) + 1 into v_n from reservations where hotel_id = p_hotel;
  v_code := v_prefix || '-' || lpad(v_n::text, 5, '0');
  v_dep := case when p_channel in ('direct', 'phone') then round(v_total * (select deposit_percent from hotels where id = p_hotel) / 100) else 0 end;

  insert into reservations (hotel_id, code, guest_id, room_type_id, room_id, check_in, check_out, adults, children,
                            status, channel, total_amount, deposit_amount, paid_amount, special_requests)
  values (p_hotel, v_code, v_guest, p_type, v_room, p_in, p_out, p_adults, p_children,
          v_status, p_channel, v_total, v_dep, least(p_paid, v_total), p_requests)
  returning id into v_id;

  if p_paid > 0 then
    insert into payments (hotel_id, reservation_id, kind, method, amount)
    values (p_hotel, v_id, 'deposit', 'stripe', p_paid);
  end if;

  return jsonb_build_object('id', v_id, 'code', v_code, 'total', v_total, 'deposit', v_dep,
                            'room', room_number(v_room));
end $$;
revoke execute on function public.create_booking(uuid, uuid, date, date, int, int, text, text, text, text, text, booking_channel, reservation_status, text, numeric) from anon, authenticated, public;

-- Réception / propriétaire
create or replace function public.staff_create_booking(
  p_hotel uuid, p_type uuid, p_in date, p_out date, p_adults int, p_children int,
  p_first text, p_last text, p_email text, p_phone text, p_lang text,
  p_channel booking_channel, p_status reservation_status, p_requests text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not has_hotel_role(p_hotel, '{owner,reception}') then raise exception 'Accès refusé'; end if;
  return create_booking(p_hotel, p_type, p_in, p_out, p_adults, p_children, p_first, p_last, p_email, p_phone,
                        p_lang, p_channel, p_status, p_requests, 0);
end $$;
grant execute on function public.staff_create_booking(uuid, uuid, date, date, int, int, text, text, text, text, text, booking_channel, reservation_status, text) to authenticated;

-- Moteur de réservation public (acompte payé via Stripe ou simulé en mode démo)
create or replace function public.public_book(
  p_slug text, p_type uuid, p_in date, p_out date, p_adults int, p_children int,
  p_first text, p_last text, p_email text, p_phone text, p_lang text, p_requests text, p_deposit_paid boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hotel uuid; v_res jsonb; v_dep numeric;
begin
  select id into v_hotel from hotels where slug = p_slug;
  if v_hotel is null or not exists (select 1 from room_types where id = p_type and hotel_id = v_hotel) then
    raise exception 'Hôtel ou chambre introuvable';
  end if;
  if p_in < current_date or p_out - p_in > 30 or coalesce(trim(p_email), '') = '' or coalesce(trim(p_last), '') = '' then
    raise exception 'Informations incomplètes';
  end if;
  v_res := create_booking(v_hotel, p_type, p_in, p_out, greatest(1, least(p_adults, 6)), greatest(0, least(p_children, 4)),
                          left(p_first, 60), left(p_last, 60), left(p_email, 120), left(p_phone, 30), left(p_lang, 2),
                          'direct', case when p_deposit_paid then 'confirmed' else 'pending' end, left(p_requests, 500), 0);
  if p_deposit_paid then
    v_dep := (v_res->>'deposit')::numeric;
    update reservations set paid_amount = v_dep where id = (v_res->>'id')::uuid;
    insert into payments (hotel_id, reservation_id, kind, method, amount)
    values (v_hotel, (v_res->>'id')::uuid, 'deposit', 'stripe', v_dep);
    perform log_automation(v_hotel, 'deposit_request',
      format('Acompte de %s € encaissé via Stripe (%s)', v_dep, v_res->>'code'), '{}'::jsonb, 'success', (v_res->>'id')::uuid);
  end if;
  return v_res;
end $$;
grant execute on function public.public_book(text, uuid, date, date, int, int, text, text, text, text, text, text, boolean) to anon, authenticated;

-- Infos publiques de l'hôtel (moteur de réservation)
create or replace function public.public_hotel(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name, 'city', city, 'address', address, 'stars', stars,
                            'deposit_percent', deposit_percent, 'check_in_time', check_in_time, 'check_out_time', check_out_time,
                            'phone', phone, 'email', email)
  from hotels where slug = p_slug
$$;
grant execute on function public.public_hotel(text) to anon, authenticated;

-- ---------- Tâches planifiées (heures UTC ≈ heure de Paris - 1) ----------
create extension if not exists pg_cron;
select cron.schedule('demo-reset',            '30 2 * * *',   $$select public.seed_demo()$$);
select cron.schedule('auto-reminder-j3',      '0 8 * * *',    $$select public.run_scheduled('reminder_j3')$$);
select cron.schedule('auto-arrival-j1',       '0 9 * * *',    $$select public.run_scheduled('arrival_instructions_j1')$$);
select cron.schedule('auto-no-show',          '30 22 * * *',  $$select public.run_scheduled('no_show_handling')$$);
select cron.schedule('auto-channel-sync',     '1 */2 * * *',  $$select public.run_scheduled('channel_sync')$$);
select cron.schedule('auto-hk-assignment',    '0 6 * * *',    $$select public.run_scheduled('hk_assignment')$$);
select cron.schedule('auto-stock-decrement',  '0 1 * * *',    $$select public.run_scheduled('stock_decrement')$$);
