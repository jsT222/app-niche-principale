-- =====================================================================
-- Hôtelis — schéma principal (multi-établissements)
-- =====================================================================
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------- Types ----------
create type app_role as enum ('owner', 'reception', 'housekeeping', 'maintenance');
create type hk_status as enum ('dirty', 'in_progress', 'clean', 'inspected', 'out_of_order');
create type booking_channel as enum ('direct', 'booking', 'expedia', 'airbnb', 'phone', 'walk_in');
create type reservation_status as enum ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'waitlist');
create type msg_channel as enum ('email', 'whatsapp', 'sms', 'booking', 'expedia', 'airbnb');
create type run_status as enum ('running', 'success', 'error', 'skipped');
create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
create type ticket_status as enum ('open', 'in_progress', 'waiting_parts', 'resolved');

-- ---------- Organisation & accès ----------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table hotels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  slug text not null unique,
  name text not null,
  city text not null,
  address text,
  stars smallint,
  timezone text not null default 'Europe/Paris',
  currency text not null default 'EUR',
  tourist_tax_per_person numeric(6,2) not null default 1.65,  -- €/pers./nuit (adulte)
  vat_rate numeric(5,2) not null default 10.0,
  deposit_percent numeric(5,2) not null default 30.0,
  check_in_time time not null default '15:00',
  check_out_time time not null default '11:00',
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table user_hotel_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  hotel_id uuid not null references hotels(id) on delete cascade,
  role app_role not null,
  primary key (user_id, hotel_id)
);

-- ---------- Chambres ----------
create table room_types (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  code text not null,
  name text not null,
  capacity smallint not null default 2,
  base_price numeric(10,2) not null,
  sort smallint not null default 0,
  unique (hotel_id, code)
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  room_type_id uuid not null references room_types(id),
  number text not null,
  floor smallint not null default 1,
  hk_status hk_status not null default 'clean',
  hk_updated_at timestamptz not null default now(),
  out_of_order_reason text,
  unique (hotel_id, number)
);

-- ---------- Clients (CRM) ----------
create table guests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  language text not null default 'fr',
  country text default 'FR',
  company text,
  segments text[] not null default '{}',    -- vip, affaires, famille, habitue
  preferences jsonb not null default '{}',
  notes text,
  total_spent numeric(12,2) not null default 0,
  stays_count int not null default 0,
  last_stay_at date,
  created_at timestamptz not null default now()
);
create index on guests (hotel_id, last_name);

-- ---------- Réservations ----------
create table reservations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  code text not null,
  guest_id uuid references guests(id) on delete set null,
  room_type_id uuid not null references room_types(id),
  room_id uuid references rooms(id) on delete set null,
  check_in date not null,
  check_out date not null,
  nights int generated always as (check_out - check_in) stored,
  adults smallint not null default 2,
  children smallint not null default 0,
  status reservation_status not null default 'confirmed',
  channel booking_channel not null default 'direct',
  external_ref text,
  total_amount numeric(12,2) not null default 0,     -- hébergement TTC
  extras_amount numeric(12,2) not null default 0,    -- petit-déj, upsells…
  deposit_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  commission_rate numeric(5,2) not null default 0,
  special_requests text,
  internal_notes text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, code),
  check (check_out > check_in),
  -- Pas de double réservation d'une même chambre
  constraint no_overlap exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (room_id is not null and status in ('pending','confirmed','checked_in','checked_out'))
);
create index on reservations (hotel_id, check_in);
create index on reservations (hotel_id, check_out);
create index on reservations (guest_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  reservation_id uuid references reservations(id) on delete cascade,
  kind text not null default 'deposit',          -- deposit | balance | refund | extra
  method text not null default 'card',           -- card | stripe | cash | transfer | ota
  amount numeric(12,2) not null,
  status text not null default 'succeeded',      -- pending | succeeded | failed | refunded
  stripe_payment_intent text,
  created_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  reservation_id uuid references reservations(id) on delete set null,
  guest_id uuid references guests(id) on delete set null,
  number text not null,
  issued_at date not null default current_date,
  due_date date,
  total_ht numeric(12,2) not null,
  total_vat numeric(12,2) not null,
  tourist_tax numeric(12,2) not null default 0,
  total_ttc numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'issued',          -- draft | issued | paid | overdue
  reminders_sent int not null default 0,
  unique (hotel_id, number)
);

-- ---------- Appels & messagerie ----------
create table calls (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  reservation_id uuid references reservations(id) on delete set null,
  from_number text,
  language text default 'fr',
  started_at timestamptz not null default now(),
  duration_s int not null default 0,
  handled_by text not null default 'ai',           -- ai | transferred | human | missed
  intent text,                                     -- booking | info | modification | cancellation | other
  outcome text,
  summary text,
  transcript jsonb not null default '[]'
);
create index on calls (hotel_id, started_at desc);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  reservation_id uuid references reservations(id) on delete set null,
  channel msg_channel not null,
  subject text,
  status text not null default 'open',             -- open | waiting | closed
  ai_mode text not null default 'suggest',         -- suggest | auto
  unread int not null default 0,
  last_message_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null,                          -- in | out
  author text,                                      -- guest | ai | staff name
  body text not null,
  ai_suggestion text,
  status text not null default 'sent',              -- sent | draft | delivered | read
  created_at timestamptz not null default now()
);

-- ---------- Stock & achats ----------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  lead_time_days int not null default 3
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  category text not null,                           -- linge | accueil | minibar | petit_dejeuner | entretien
  name text not null,
  unit text not null default 'u',
  quantity numeric(12,2) not null default 0,
  threshold numeric(12,2) not null default 0,
  reorder_qty numeric(12,2) not null default 0,
  unit_cost numeric(10,2) not null default 0,
  per_occupied_room numeric(8,3) not null default 0,  -- conso / nuitée
  per_checkout numeric(8,3) not null default 0         -- conso / départ
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  number text not null,
  status text not null default 'draft',             -- draft | sent | received | cancelled
  total numeric(12,2) not null default 0,
  auto_generated boolean not null default false,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  item_id uuid references inventory_items(id) on delete set null,
  quantity numeric(12,2) not null,
  unit_cost numeric(10,2) not null
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  delta numeric(12,2) not null,
  reason text not null,                             -- auto_occupancy | auto_checkout | delivery | manual
  created_at timestamptz not null default now()
);

-- ---------- Équipe ----------
create table staff (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  role app_role not null,
  phone text,
  active boolean not null default true
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  role app_role,
  assigned_to uuid references staff(id) on delete set null,
  title text not null,
  due_at timestamptz,
  status text not null default 'todo',              -- todo | done
  source text,                                      -- automation key
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  role app_role,                                    -- null = tous
  level text not null default 'info',               -- info | warning | critical
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Housekeeping & maintenance ----------
create table housekeeping_tasks (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  date date not null,
  kind text not null,                               -- departure | stayover | arrival_prep
  assigned_to uuid references staff(id) on delete set null,
  status text not null default 'todo',              -- todo | in_progress | done | inspected
  priority smallint not null default 0,             -- arrivée du jour = prioritaire
  started_at timestamptz,
  completed_at timestamptz,
  unique (room_id, date)
);

create table maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  title text not null,
  description text,
  priority ticket_priority not null default 'medium',
  status ticket_status not null default 'open',
  photo_url text,
  reported_by text,
  assigned_to uuid references staff(id) on delete set null,
  preventive boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table preventive_plans (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  title text not null,
  frequency_days int not null,
  next_due date not null,
  scope text                                         -- ex : « toutes les chambres », « chaufferie »
);

-- ---------- Revenue ----------
create table daily_rates (
  hotel_id uuid not null references hotels(id) on delete cascade,
  room_type_id uuid not null references room_types(id) on delete cascade,
  date date not null,
  price numeric(10,2) not null,
  suggested_price numeric(10,2),
  min_stay smallint not null default 1,
  closed boolean not null default false,
  source text not null default 'auto',              -- auto | manual
  primary key (room_type_id, date)
);

create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  name text not null,
  kind text not null,                               -- occupancy | season | event | competitor | min_stay | close_out | last_minute
  config jsonb not null default '{}',
  active boolean not null default true
);

create table local_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  impact_percent numeric(5,2) not null default 15
);

create table competitor_rates (
  hotel_id uuid not null references hotels(id) on delete cascade,
  competitor text not null,
  date date not null,
  price numeric(10,2) not null,
  primary key (hotel_id, competitor, date)
);

-- ---------- Avis ----------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  source text not null,                              -- google | booking | tripadvisor
  author text not null,
  rating numeric(2,1) not null,                     -- sur 5
  title text,
  body text,
  language text default 'fr',
  published_at timestamptz not null,
  response text,
  response_status text not null default 'none',     -- none | suggested | published
  responded_at timestamptz
);

-- ---------- Automatisations ----------
create table automations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  key text not null,
  module text not null,                             -- reservations | messaging | crm | stock | housekeeping | revenue | finance | reviews | team
  name text not null,
  description text,
  trigger_label text not null,                      -- « Nouvelle réservation », « Tous les jours à 9h »
  actions text[] not null default '{}',
  enabled boolean not null default true,
  n8n_workflow_id text,
  last_run_at timestamptz,
  runs_count int not null default 0,
  errors_count int not null default 0,
  unique (hotel_id, key)
);

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade,
  status run_status not null default 'success',
  started_at timestamptz not null default now(),
  duration_ms int,
  summary text not null,
  details jsonb not null default '{}',
  reservation_id uuid references reservations(id) on delete set null
);
create index on automation_runs (hotel_id, started_at desc);
create index on automation_runs (automation_id, started_at desc);

-- Paramètres d'intégration (URL des webhooks n8n, etc.)
create table integration_settings (
  hotel_id uuid primary key references hotels(id) on delete cascade,
  n8n_webhook_base text,
  pms_provider text default 'mews',
  channel_manager text default 'siteminder',
  voice_provider text default 'vapi',
  demo_mode boolean not null default true
);
