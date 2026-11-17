-- KPIs : exécution en security definer (contrôle d'accès explicite) + série calculée en une passe
create index if not exists reservations_hotel_dates on reservations (hotel_id, check_in, check_out) where status in ('confirmed','checked_in','checked_out');

create or replace function public.night_series(p_hotels uuid[], d1 date, d2 date)
returns table (d date, rooms_sold bigint, revenue numeric)
language sql stable security definer set search_path = public as $$
  select g.d::date, count(r.id), coalesce(sum(r.total_amount / r.nights), 0)
  from generate_series(d1, d2, interval '1 day') g(d)
  left join reservations r
    on r.hotel_id = any(p_hotels)
   and r.status in ('confirmed', 'checked_in', 'checked_out')
   and r.check_in <= g.d::date and r.check_out > g.d::date
   and r.check_in <= d2 and r.check_out > d1
  group by g.d
$$;
revoke execute on function public.night_series(uuid[], date, date) from anon, authenticated;

create or replace function public.dashboard_kpis(p_hotels uuid[], p_date date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hotels uuid[];
  v_rooms int;
  v_ly date := (p_date - interval '1 year')::date;
  v_m1 date := date_trunc('month', p_date)::date;
  v_m1_ly date := date_trunc('month', p_date - interval '1 year')::date;
  v_days int := p_date - date_trunc('month', p_date)::date + 1;
  t record; tly record; m record; mly record;
  v_series jsonb;
begin
  -- Ne garder que les hôtels accessibles (propriétaire / réception)
  select array_agg(h) into v_hotels from unnest(p_hotels) h where has_hotel_role(h, '{owner,reception}');
  if v_hotels is null then return '{}'::jsonb; end if;
  select count(*) into v_rooms from rooms where hotel_id = any(v_hotels);
  if v_rooms = 0 then return '{}'::jsonb; end if;

  select count(*) rooms_sold, coalesce(sum(total_amount / nights), 0) revenue into t
    from reservations where hotel_id = any(v_hotels) and status in ('confirmed','checked_in','checked_out') and check_in <= p_date and check_out > p_date;
  select count(*) rooms_sold, coalesce(sum(total_amount / nights), 0) revenue into tly
    from reservations where hotel_id = any(v_hotels) and status in ('confirmed','checked_in','checked_out') and check_in <= v_ly and check_out > v_ly;
  select coalesce(sum(rooms_sold), 0) rooms_sold, coalesce(sum(revenue), 0) revenue into m from night_series(v_hotels, v_m1, p_date);
  select coalesce(sum(rooms_sold), 0) rooms_sold, coalesce(sum(revenue), 0) revenue into mly from night_series(v_hotels, v_m1_ly, v_ly);

  select jsonb_agg(jsonb_build_object(
           'date', c.d, 'occupancy', round(100.0 * c.rooms_sold / v_rooms, 1), 'revenue', round(c.revenue),
           'occupancy_ly', round(100.0 * l.rooms_sold / v_rooms, 1), 'revenue_ly', round(l.revenue)) order by c.d)
    into v_series
    from night_series(v_hotels, p_date - 29, p_date + 14) c
    join night_series(v_hotels, (p_date - 29 - interval '1 year')::date, (p_date + 14 - interval '1 year')::date) l
      on l.d = (c.d - interval '1 year')::date;

  return jsonb_build_object(
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
    'arrivals',       (select count(*) from reservations where hotel_id = any(v_hotels) and check_in = p_date and status in ('confirmed','checked_in','pending')),
    'arrivals_done',  (select count(*) from reservations where hotel_id = any(v_hotels) and check_in = p_date and status = 'checked_in'),
    'departures',      (select count(*) from reservations where hotel_id = any(v_hotels) and check_out = p_date and status in ('checked_in','checked_out')),
    'departures_done', (select count(*) from reservations where hotel_id = any(v_hotels) and check_out = p_date and status = 'checked_out'),
    'rooms_ready',    (select count(*) from rooms where hotel_id = any(v_hotels) and hk_status in ('clean','inspected')),
    'rooms_dirty',    (select count(*) from rooms where hotel_id = any(v_hotels) and hk_status in ('dirty','in_progress')),
    'rooms_ooo',      (select count(*) from rooms where hotel_id = any(v_hotels) and hk_status = 'out_of_order'),
    'calls_today',      (select count(*) from calls where hotel_id = any(v_hotels) and started_at::date = p_date),
    'calls_ai_today',   (select count(*) from calls where hotel_id = any(v_hotels) and started_at::date = p_date and handled_by = 'ai'),
    'calls_month',      (select count(*) from calls where hotel_id = any(v_hotels) and started_at::date between v_m1 and p_date),
    'calls_ai_month',   (select count(*) from calls where hotel_id = any(v_hotels) and started_at::date between v_m1 and p_date and handled_by = 'ai'),
    'calls_bookings_month', (select count(*) from calls where hotel_id = any(v_hotels) and started_at::date between v_m1 and p_date and outcome = 'Réservation prise'),
    'direct_share',    (select round(100.0 * count(*) filter (where channel in ('direct','phone','walk_in')) / nullif(count(*), 0), 1)
                          from reservations where hotel_id = any(v_hotels) and created_at >= v_m1 and created_at < p_date + 1 and status <> 'waitlist'),
    'direct_share_ly', (select round(100.0 * count(*) filter (where channel in ('direct','phone','walk_in')) / nullif(count(*), 0), 1)
                          from reservations where hotel_id = any(v_hotels) and created_at >= v_m1_ly and created_at < v_ly + 1 and status <> 'waitlist'),
    'channel_mix', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'count', n, 'revenue', rev) order by n desc), '[]'::jsonb)
                      from (select channel, count(*) n, round(sum(total_amount), 0) rev from reservations
                             where hotel_id = any(v_hotels) and created_at >= v_m1 and created_at < p_date + 1
                               and status <> 'waitlist' group by channel) x),
    'stock_alerts',   (select count(*) from inventory_items where hotel_id = any(v_hotels) and quantity <= threshold),
    'tickets_open',   (select count(*) from maintenance_tickets where hotel_id = any(v_hotels) and status <> 'resolved'),
    'tickets_urgent', (select count(*) from maintenance_tickets where hotel_id = any(v_hotels) and status <> 'resolved' and priority in ('high','urgent')),
    'rating',    (select round(avg(rating), 2) from reviews where hotel_id = any(v_hotels) and published_at >= p_date - 89 and published_at < p_date + 1),
    'rating_ly', (select round(avg(rating), 2) from reviews where hotel_id = any(v_hotels) and published_at >= v_ly - 89 and published_at < v_ly + 1),
    'reviews_count', (select count(*) from reviews where hotel_id = any(v_hotels) and published_at >= p_date - 89 and published_at < p_date + 1),
    'low_reviews_pending', (select count(*) from reviews where hotel_id = any(v_hotels) and rating <= 3 and response_status <> 'published' and published_at > now() - interval '30 days'),
    'series', v_series,
    'by_hotel', (
      select jsonb_agg(jsonb_build_object(
        'hotel_id', h.id, 'name', h.name, 'rooms', rc.n,
        'occupancy', round(100.0 * ns.rooms_sold / nullif(rc.n, 0), 1),
        'revenue_day', round(ns.revenue)) order by h.name)
      from hotels h
      cross join lateral (select count(*) n from rooms where hotel_id = h.id) rc
      cross join lateral night_series(array[h.id], p_date, p_date) ns
      where h.id = any(v_hotels)
    )
  );
end $$;
grant execute on function public.dashboard_kpis(uuid[], date) to authenticated;
revoke execute on function public.dashboard_kpis(uuid[], date) from anon;

-- Dates de création plus réalistes pour les réservations « récentes » du jeu de démo
create or replace function public.seed_spread_recent()
returns void language sql security definer set search_path = public as $$
  update reservations
     set created_at = now() - make_interval(mins => (30 + random() * 60 * 24 * 4)::int),
         updated_at = now() - interval '10 minutes'
   where created_at > now() - interval '40 minutes';
$$;

create or replace function public.seed_demo()
returns void language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  perform set_config('app.seeding', 'on', true);
  perform setseed(0.4242);
  delete from automation_runs; delete from notifications; delete from tasks; delete from shifts;
  delete from housekeeping_tasks; delete from maintenance_tickets; delete from reviews;
  delete from messages; delete from conversations; delete from calls;
  delete from invoices; delete from payments; delete from reservations; delete from guests;
  delete from daily_rates; delete from competitor_rates; delete from stock_movements;
  delete from purchase_order_lines; delete from purchase_orders;
  update automations set runs_count = 0, errors_count = 0, last_run_at = null;

  foreach h in array array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[] loop
    perform seed_demo_hotel(h);
    perform seed_demo_activity(h);
  end loop;
  perform seed_spread_recent();
  perform set_config('app.seeding', 'off', true);
  foreach h in array array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[] loop
    perform seed_demo_runs(h);
  end loop;
end $$;
revoke execute on function public.seed_demo() from anon, authenticated;
revoke execute on function public.seed_spread_recent() from anon, authenticated;

-- (0009) étale aussi les dates d'annulation récentes
create or replace function public.seed_spread_recent()
returns void language sql security definer set search_path = public as $$
  update reservations
     set created_at = now() - make_interval(mins => (30 + random() * 60 * 24 * 4)::int),
         updated_at = now() - interval '10 minutes'
   where created_at > now() - interval '40 minutes';
  update reservations
     set cancelled_at = greatest(created_at + interval '2 hours', now() - make_interval(mins => (45 + random() * 60 * 24 * 20)::int))
   where cancelled_at > now() - interval '40 minutes';
  update reservations set cancelled_at = now() - make_interval(mins => (45 + random() * 600)::int)
   where cancelled_at > now();
$$;
