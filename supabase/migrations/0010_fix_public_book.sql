-- Conversions de type explicites pour l'appel à create_booking
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
                          'direct'::booking_channel,
                          (case when p_deposit_paid then 'confirmed' else 'pending' end)::reservation_status,
                          left(p_requests, 500), 0::numeric);
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

create or replace function public.staff_create_booking(
  p_hotel uuid, p_type uuid, p_in date, p_out date, p_adults int, p_children int,
  p_first text, p_last text, p_email text, p_phone text, p_lang text,
  p_channel booking_channel, p_status reservation_status, p_requests text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not has_hotel_role(p_hotel, '{owner,reception}') then raise exception 'Accès refusé'; end if;
  return create_booking(p_hotel, p_type, p_in, p_out, p_adults, p_children, p_first, p_last, p_email, p_phone,
                        p_lang, p_channel, p_status, p_requests, 0::numeric);
end $$;
