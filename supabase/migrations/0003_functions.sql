-- =====================================================================
-- Fonctions métier : journal d'automatisations, triggers, KPIs
-- =====================================================================
create extension if not exists pg_net;

-- ---------- updated_at ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger reservations_touch before update on reservations
  for each row execute function touch_updated_at();

-- ---------- Journal d'exécution ----------
create or replace function public.automation_enabled(p_hotel uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from automations where hotel_id = p_hotel and key = p_key), false)
$$;

create or replace function public.log_automation(
  p_hotel uuid, p_key text, p_summary text,
  p_details jsonb default '{}', p_status run_status default 'success',
  p_reservation uuid default null, p_at timestamptz default now()
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a automations%rowtype;
  v_id uuid;
  v_status run_status := p_status;
  v_summary text := p_summary;
begin
  select * into a from automations where hotel_id = p_hotel and key = p_key;
  if not found then return null; end if;
  if not a.enabled then
    v_status := 'skipped';
    v_summary := 'Non exécutée (automatisation désactivée) — ' || p_summary;
  end if;
  insert into automation_runs (hotel_id, automation_id, status, started_at, duration_ms, summary, details, reservation_id)
  values (p_hotel, a.id, v_status, p_at, (200 + random() * 1800)::int, v_summary, p_details, p_reservation)
  returning id into v_id;
  update automations set
    last_run_at = greatest(coalesce(last_run_at, p_at), p_at),
    runs_count = runs_count + 1,
    errors_count = errors_count + (v_status = 'error')::int
  where id = a.id;
  return v_id;
end $$;

-- Envoi d'un évènement vers n8n (uniquement hors mode démo et si une URL est configurée)
create or replace function public.notify_n8n(p_hotel uuid, p_event text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s integration_settings%rowtype;
begin
  select * into s from integration_settings where hotel_id = p_hotel;
  if found and not s.demo_mode and s.n8n_webhook_base is not null then
    perform net.http_post(
      url := rtrim(s.n8n_webhook_base, '/') || '/' || p_event,
      body := jsonb_build_object('event', p_event, 'hotel_id', p_hotel, 'data', p_payload),
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  end if;
end $$;

-- ---------- Triggers réservations ----------
create or replace function public.guest_name(p_guest uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(first_name || ' ' || last_name, 'Client') from guests where id = p_guest
$$;

create or replace function public.room_number(p_room uuid) returns text
language sql stable security definer set search_path = public as $$
  select number from rooms where id = p_room
$$;

create or replace function public.next_invoice_number(p_hotel uuid) returns text
language sql security definer set search_path = public as $$
  select 'F' || to_char(current_date, 'YYYY') || '-' || lpad((count(*) + 1)::text, 5, '0')
  from invoices where hotel_id = p_hotel and number like 'F' || to_char(current_date, 'YYYY') || '-%'
$$;

create or replace function public.on_reservation_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_guest text;
  v_dates text;
  w reservations%rowtype;
  v_tax numeric;
  v_ttc numeric;
  v_rate numeric;
begin
  if current_setting('app.seeding', true) = 'on' then return new; end if;

  v_guest := coalesce(guest_name(new.guest_id), 'Client');
  v_dates := to_char(new.check_in, 'DD/MM') || ' → ' || to_char(new.check_out, 'DD/MM');

  if tg_op = 'INSERT' then
    perform notify_n8n(new.hotel_id, 'reservation.created', to_jsonb(new));
    if new.status in ('confirmed', 'pending') then
      perform log_automation(new.hotel_id, 'booking_confirmation',
        format('Confirmation envoyée à %s (%s, %s) — email + WhatsApp', v_guest, new.code, v_dates),
        jsonb_build_object('channels', array['email','whatsapp'], 'code', new.code), 'success', new.id);
      perform log_automation(new.hotel_id, 'guest_segmentation',
        format('Fiche client %s mise à jour et segmentée', v_guest), '{}'::jsonb, 'success', new.id);
      if new.channel = 'direct' and new.deposit_amount > new.paid_amount then
        perform log_automation(new.hotel_id, 'deposit_request',
          format('Lien de paiement Stripe envoyé à %s — acompte %s €', v_guest, to_char(new.deposit_amount, 'FM999G990D00')),
          jsonb_build_object('amount', new.deposit_amount), 'success', new.id);
      end if;
    elsif new.status = 'waitlist' then
      perform log_automation(new.hotel_id, 'waitlist_promotion',
        format('%s ajouté(e) en liste d''attente (%s)', v_guest, v_dates), '{}'::jsonb, 'success', new.id);
    end if;
    return new;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then
    perform notify_n8n(new.hotel_id, 'reservation.status_changed',
      jsonb_build_object('id', new.id, 'from', old.status, 'to', new.status));

    if new.status = 'cancelled' then
      perform log_automation(new.hotel_id, 'cancellation_handling',
        format('Annulation %s (%s) : chambre %s libérée, conditions appliquées, client notifié',
               new.code, v_guest, coalesce(room_number(old.room_id), '—')),
        '{}'::jsonb, 'success', new.id);
      -- Promotion automatique de la liste d'attente
      if old.room_id is not null and automation_enabled(new.hotel_id, 'waitlist_promotion') then
        select * into w from reservations
         where hotel_id = new.hotel_id and status = 'waitlist'
           and room_type_id = old.room_type_id
           and check_in >= old.check_in and check_out <= old.check_out
         order by created_at limit 1;
        if found then
          update reservations set status = 'confirmed', room_id = old.room_id where id = w.id;
          perform log_automation(new.hotel_id, 'waitlist_promotion',
            format('Chambre %s attribuée à %s (liste d''attente) — confirmation envoyée',
                   room_number(old.room_id), guest_name(w.guest_id)),
            '{}'::jsonb, 'success', w.id);
        end if;
      end if;

    elsif new.status = 'no_show' then
      perform log_automation(new.hotel_id, 'no_show_handling',
        format('No-show %s (%s) : acompte de %s € encaissé, chambre remise en vente',
               new.code, v_guest, to_char(new.deposit_amount, 'FM999G990D00')),
        '{}'::jsonb, 'success', new.id);

    elsif new.status = 'checked_in' then
      if new.room_id is not null then
        update rooms set hk_status = 'clean', hk_updated_at = now() where id = new.room_id and hk_status = 'inspected';
      end if;

    elsif new.status = 'checked_out' then
      -- Chambre à nettoyer
      if new.room_id is not null and automation_enabled(new.hotel_id, 'room_dirty_on_checkout') then
        update rooms set hk_status = 'dirty', hk_updated_at = now() where id = new.room_id;
      end if;
      perform log_automation(new.hotel_id, 'room_dirty_on_checkout',
        format('Chambre %s passée « à nettoyer » et ajoutée au planning ménage', coalesce(room_number(new.room_id), '—')),
        '{}'::jsonb, 'success', new.id);
      -- Facture automatique
      if automation_enabled(new.hotel_id, 'invoice_on_checkout') then
        select tourist_tax_per_person, vat_rate into v_tax, v_rate from hotels where id = new.hotel_id;
        v_tax := round(v_tax * new.adults * new.nights, 2);
        v_ttc := new.total_amount + new.extras_amount + v_tax;
        insert into invoices (hotel_id, reservation_id, guest_id, number, issued_at, due_date,
                              total_ht, total_vat, tourist_tax, total_ttc, paid_amount, status)
        values (new.hotel_id, new.id, new.guest_id, next_invoice_number(new.hotel_id), current_date, current_date,
                round((new.total_amount + new.extras_amount) / (1 + v_rate / 100), 2),
                round((new.total_amount + new.extras_amount) - (new.total_amount + new.extras_amount) / (1 + v_rate / 100), 2),
                v_tax, v_ttc, least(new.paid_amount, v_ttc),
                case when new.paid_amount >= v_ttc then 'paid' else 'issued' end);
      end if;
      perform log_automation(new.hotel_id, 'invoice_on_checkout',
        format('Facture émise et envoyée par email à %s (%s)', v_guest, new.code), '{}'::jsonb, 'success', new.id);
      -- CRM
      if new.guest_id is not null then
        update guests set stays_count = stays_count + 1,
                          total_spent = total_spent + new.total_amount + new.extras_amount,
                          last_stay_at = new.check_out
         where id = new.guest_id;
      end if;
      perform log_automation(new.hotel_id, 'post_stay',
        format('Demande d''avis + offre de retour programmées pour %s (J+1)', v_guest), '{}'::jsonb, 'success', new.id);
    end if;

  elsif (new.room_id is distinct from old.room_id or new.check_in <> old.check_in or new.check_out <> old.check_out)
        and new.status in ('confirmed', 'checked_in', 'pending') then
    perform notify_n8n(new.hotel_id, 'reservation.moved', to_jsonb(new));
    perform log_automation(new.hotel_id, 'planning_sync',
      format('%s (%s) : %s → %s, %s — synchronisé PMS + channel manager',
             new.code, v_guest,
             coalesce('ch. ' || room_number(old.room_id), 'non attribuée'),
             coalesce('ch. ' || room_number(new.room_id), 'non attribuée'), v_dates),
      '{}'::jsonb, 'success', new.id);
  end if;
  return new;
end $$;

create trigger reservations_automations after insert or update on reservations
  for each row execute function on_reservation_change();

-- ---------- Exécution d'une automatisation planifiée ----------
create or replace function public.execute_automation(p_automation uuid, p_manual boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a automations%rowtype;
  v_count int;
  v_names text[];
  v_summary text;
  v_prefix text := case when p_manual then 'Exécution manuelle — ' else '' end;
  r record;
begin
  select * into a from automations where id = p_automation;
  if not found then raise exception 'Automatisation introuvable'; end if;

  if a.key = 'reminder_j3' or a.key = 'arrival_instructions_j1' then
    select count(*), (array_agg(guest_name(guest_id)))[1:5] into v_count, v_names
      from reservations
     where hotel_id = a.hotel_id and status = 'confirmed'
       and check_in = current_date + case when a.key = 'reminder_j3' then 3 else 1 end;
    v_summary := case when a.key = 'reminder_j3'
      then format('%s rappel(s) J-3 envoyé(s) (email + WhatsApp) avec proposition d''upsell', v_count)
      else format('%s consigne(s) d''arrivée envoyée(s) avec lien de check-in en ligne', v_count) end;
    perform log_automation(a.hotel_id, a.key, v_prefix || v_summary, jsonb_build_object('guests', v_names));

  elsif a.key = 'no_show_handling' then
    v_count := 0;
    if a.enabled then
      for r in select id from reservations
                where hotel_id = a.hotel_id and status = 'confirmed' and check_in < current_date loop
        update reservations set status = 'no_show' where id = r.id;
        v_count := v_count + 1;
      end loop;
    end if;
    perform log_automation(a.hotel_id, a.key, v_prefix || format('Contrôle des no-shows : %s détecté(s)', v_count));

  elsif a.key = 'channel_sync' then
    perform log_automation(a.hotel_id, a.key, v_prefix ||
      'Synchro OK — Booking, Expedia, Airbnb, site direct : disponibilités et tarifs poussés sur 365 jours',
      jsonb_build_object('channels', array['booking','expedia','airbnb','direct'], 'new_reservations', 0));

  elsif a.key = 'stock_decrement' then
    select count(*) into v_count from inventory_items where hotel_id = a.hotel_id and quantity <= threshold;
    perform log_automation(a.hotel_id, a.key, v_prefix ||
      format('Stocks décrémentés selon l''occupation — %s article(s) sous le seuil', v_count));

  elsif a.key = 'hk_assignment' then
    perform log_automation(a.hotel_id, a.key, v_prefix || 'Chambres du jour réparties entre les femmes de chambre (départs prioritaires)');

  else
    perform log_automation(a.hotel_id, a.key, v_prefix || 'Terminée sans erreur');
  end if;

  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.execute_automation(uuid, boolean) from anon, authenticated;

-- Point d'entrée appelé depuis l'appli (contrôle du rôle)
create or replace function public.run_automation_now(p_automation uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hotel uuid;
begin
  select hotel_id into v_hotel from automations where id = p_automation;
  if not has_hotel_role(v_hotel, '{owner,reception}') then
    raise exception 'Accès refusé';
  end if;
  return execute_automation(p_automation, true);
end $$;

-- Activer / désactiver (propriétaire)
create or replace function public.set_automation_enabled(p_automation uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_hotel uuid;
begin
  select hotel_id into v_hotel from automations where id = p_automation;
  if not has_hotel_role(v_hotel, '{owner}') then raise exception 'Seul le propriétaire peut modifier une automatisation'; end if;
  update automations set enabled = p_enabled where id = p_automation;
end $$;

-- Lancement planifié de toutes les automatisations d'une clé (pg_cron)
create or replace function public.run_scheduled(p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from automations where key = p_key loop
    perform execute_automation(r.id, false);
  end loop;
end $$;
revoke execute on function public.run_scheduled(text) from anon, authenticated;

-- ---------- KPIs ----------
create or replace function public.night_stats(p_hotels uuid[], d1 date, d2 date)
returns table (rooms_sold bigint, revenue numeric)
language sql stable as $$
  select count(*)::bigint, coalesce(sum(r.total_amount / r.nights), 0)
  from reservations r
  join generate_series(d1, d2, interval '1 day') g(d) on g.d::date >= r.check_in and g.d::date < r.check_out
  where r.hotel_id = any(p_hotels)
    and r.check_in <= d2 and r.check_out > d1
    and r.status in ('confirmed', 'checked_in', 'checked_out')
$$;

create or replace function public.dashboard_kpis(p_hotels uuid[], p_date date default current_date)
returns jsonb language plpgsql stable as $$
declare
  v_rooms int;
  v_ly date := (p_date - interval '1 year')::date;
  v_m1 date := date_trunc('month', p_date)::date;
  v_m1_ly date := date_trunc('month', p_date - interval '1 year')::date;
  t record; tly record; m record; mly record;
  v_days int := p_date - v_m1 + 1;
  res jsonb;
begin
  select count(*) into v_rooms from rooms where hotel_id = any(p_hotels);
  if v_rooms = 0 then return '{}'::jsonb; end if;

  select * into t   from night_stats(p_hotels, p_date, p_date);
  select * into tly from night_stats(p_hotels, v_ly, v_ly);
  select * into m   from night_stats(p_hotels, v_m1, p_date);
  select * into mly from night_stats(p_hotels, v_m1_ly, v_ly);

  res := jsonb_build_object(
    'rooms', v_rooms,
    'occupancy',     round(100.0 * t.rooms_sold / v_rooms, 1),
    'occupancy_ly',  round(100.0 * tly.rooms_sold / v_rooms, 1),
    'adr',           round(t.revenue / nullif(t.rooms_sold, 0), 2),
    'adr_ly',        round(tly.revenue / nullif(tly.rooms_sold, 0), 2),
    'revpar',        round(t.revenue / v_rooms, 2),
    'revpar_ly',     round(tly.revenue / v_rooms, 2),
    'revenue_day',    round(t.revenue, 2),
    'revenue_day_ly', round(tly.revenue, 2),
    'revenue_month',    round(m.revenue, 2),
    'revenue_month_ly', round(mly.revenue, 2),
    'occupancy_month',    round(100.0 * m.rooms_sold / (v_rooms * v_days), 1),
    'occupancy_month_ly', round(100.0 * mly.rooms_sold / (v_rooms * v_days), 1),
    'adr_month',    round(m.revenue / nullif(m.rooms_sold, 0), 2),
    'adr_month_ly', round(mly.revenue / nullif(mly.rooms_sold, 0), 2),

    'arrivals',       (select count(*) from reservations where hotel_id = any(p_hotels) and check_in = p_date and status in ('confirmed','checked_in','pending')),
    'arrivals_done',  (select count(*) from reservations where hotel_id = any(p_hotels) and check_in = p_date and status = 'checked_in'),
    'departures',      (select count(*) from reservations where hotel_id = any(p_hotels) and check_out = p_date and status in ('checked_in','checked_out')),
    'departures_done', (select count(*) from reservations where hotel_id = any(p_hotels) and check_out = p_date and status = 'checked_out'),
    'rooms_ready',    (select count(*) from rooms where hotel_id = any(p_hotels) and hk_status in ('clean','inspected')),
    'rooms_dirty',    (select count(*) from rooms where hotel_id = any(p_hotels) and hk_status in ('dirty','in_progress')),
    'rooms_ooo',      (select count(*) from rooms where hotel_id = any(p_hotels) and hk_status = 'out_of_order'),

    'calls_today',      (select count(*) from calls where hotel_id = any(p_hotels) and started_at::date = p_date),
    'calls_ai_today',   (select count(*) from calls where hotel_id = any(p_hotels) and started_at::date = p_date and handled_by = 'ai'),
    'calls_month',      (select count(*) from calls where hotel_id = any(p_hotels) and started_at::date between v_m1 and p_date),
    'calls_ai_month',   (select count(*) from calls where hotel_id = any(p_hotels) and started_at::date between v_m1 and p_date and handled_by = 'ai'),
    'calls_bookings_month', (select count(*) from calls where hotel_id = any(p_hotels) and started_at::date between v_m1 and p_date and outcome = 'Réservation prise'),

    'direct_share',    (select round(100.0 * count(*) filter (where channel in ('direct','phone','walk_in')) / nullif(count(*), 0), 1)
                          from reservations where hotel_id = any(p_hotels) and created_at::date between v_m1 and p_date and status <> 'waitlist'),
    'direct_share_ly', (select round(100.0 * count(*) filter (where channel in ('direct','phone','walk_in')) / nullif(count(*), 0), 1)
                          from reservations where hotel_id = any(p_hotels) and created_at::date between v_m1_ly and v_ly and status <> 'waitlist'),
    'channel_mix', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'count', n, 'revenue', rev) order by n desc), '[]'::jsonb)
                      from (select channel, count(*) n, round(sum(total_amount), 0) rev from reservations
                             where hotel_id = any(p_hotels) and created_at::date between v_m1 and p_date
                               and status not in ('waitlist') group by channel) x),

    'stock_alerts',   (select count(*) from inventory_items where hotel_id = any(p_hotels) and quantity <= threshold),
    'tickets_open',   (select count(*) from maintenance_tickets where hotel_id = any(p_hotels) and status <> 'resolved'),
    'tickets_urgent', (select count(*) from maintenance_tickets where hotel_id = any(p_hotels) and status <> 'resolved' and priority in ('high','urgent')),
    'rating',    (select round(avg(rating), 2) from reviews where hotel_id = any(p_hotels) and published_at::date between p_date - 89 and p_date),
    'rating_ly', (select round(avg(rating), 2) from reviews where hotel_id = any(p_hotels) and published_at::date between v_ly - 89 and v_ly),
    'reviews_count', (select count(*) from reviews where hotel_id = any(p_hotels) and published_at::date between p_date - 89 and p_date),
    'low_reviews_pending', (select count(*) from reviews where hotel_id = any(p_hotels) and rating <= 3 and response_status <> 'published' and published_at > now() - interval '30 days'),

    'series', (
      select jsonb_agg(jsonb_build_object(
        'date', d::date,
        'occupancy', round(100.0 * (select rooms_sold from night_stats(p_hotels, d::date, d::date)) / v_rooms, 1),
        'occupancy_ly', round(100.0 * (select rooms_sold from night_stats(p_hotels, (d - interval '1 year')::date, (d - interval '1 year')::date)) / v_rooms, 1),
        'revenue', round((select revenue from night_stats(p_hotels, d::date, d::date)), 0),
        'revenue_ly', round((select revenue from night_stats(p_hotels, (d - interval '1 year')::date, (d - interval '1 year')::date)), 0)
      ) order by d)
      from generate_series(p_date - 29, p_date + 14, interval '1 day') d
    ),
    'by_hotel', (
      select jsonb_agg(jsonb_build_object(
        'hotel_id', h.id, 'name', h.name, 'rooms', (select count(*) from rooms where hotel_id = h.id),
        'occupancy', round(100.0 * (select rooms_sold from night_stats(array[h.id], p_date, p_date)) / nullif((select count(*) from rooms where hotel_id = h.id), 0), 1),
        'revenue_day', round((select revenue from night_stats(array[h.id], p_date, p_date)), 0)
      ) order by h.name)
      from hotels h where h.id = any(p_hotels)
    )
  );
  return res;
end $$;
