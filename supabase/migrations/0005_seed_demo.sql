-- =====================================================================
-- seed_demo() : régénère ~25 mois de données réalistes relatives à aujourd'hui
-- (réservations, clients, appels, messages, avis, tarifs, journaux…)
-- Rejouée chaque nuit par pg_cron pour que la démo reste « fraîche ».
-- =====================================================================

create or replace function public.seed_demo_hotel(p_hotel uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  is_annecy boolean := p_hotel = '11111111-1111-4111-8111-111111111111';
  prefix text := case when p_hotel = '11111111-1111-4111-8111-111111111111' then 'TIL' else 'MSC' end;
  season_occ numeric[];
  season_px numeric[];
  fr_first text[] := '{Camille,Léa,Manon,Chloé,Emma,Inès,Sarah,Julie,Pauline,Marie,Lucie,Anaïs,Clara,Mathilde,Sophie,Hugo,Lucas,Thomas,Nicolas,Julien,Maxime,Antoine,Alexandre,Pierre,Louis,Arthur,Paul,Romain,Baptiste,Guillaume,Nathalie,Isabelle,Valérie,Philippe,Laurent,Olivier,Stéphane,Éric,Christophe,Frédéric,Hélène,Céline,Aurélie,Benoît,Vincent,Jérôme,Margaux,Victor,Adèle,Gabriel}';
  fr_last text[] := '{Martin,Bernard,Dubois,Thomas,Robert,Richard,Petit,Durand,Leroy,Moreau,Simon,Laurent,Lefebvre,Michel,Garcia,David,Bertrand,Roux,Vincent,Fournier,Girard,André,Mercier,Dupont,Lambert,Bonnet,François,Martinez,Legrand,Garnier,Faure,Rousseau,Blanc,Guérin,Muller,Henry,Roussel,Perrin,Morin,Mathieu,Clément,Gauthier,Dumont,Lopez,Fontaine,Chevalier,Robin,Masson,Sanchez,Barbier,Arnaud,Picard,Roche,Renard,Aubert,Colin,Vidal,Caron,Carpentier,Brun}';
  en_first text[] := '{James,Emily,Oliver,Charlotte,Liam,Olivia,Noah,Amelia,George,Grace,Jack,Hannah}';
  en_last text[]  := '{Smith,Johnson,Brown,Taylor,Wilson,Davies,Evans,Walker,Wright,Hughes,Clarke,Turner}';
  de_first text[] := '{Lukas,Anna,Hans,Ingrid,Felix,Lena,Jonas,Mia,Stefan,Julia}';
  de_last text[]  := '{Müller,Schmidt,Schneider,Fischer,Weber,Meyer,Wagner,Becker,Hofmann,Keller}';
  it_first text[] := '{Marco,Giulia,Sofia,Luca,Francesca,Matteo,Chiara,Andrea}';
  it_last text[]  := '{Rossi,Russo,Bianchi,Romano,Colombo,Ricci,Marino,Greco}';
  es_first text[] := '{Javier,Lucía,Carlos,María,Pablo,Carmen,Diego,Elena}';
  es_last text[]  := '{García,Fernández,González,Rodríguez,López,Martínez,Sánchez,Pérez}';
  companies text[] := '{"Alpes Ingénierie","Savoie Conseil","Groupe Lacroix Industrie","Novatec Solutions","Rhône Logistique","Médilab France","Atelier Numérique","Banque des Deux Lacs","Cabinet Vauban Avocats","Horizon Pharma","Lumen Énergie","Transalp Consulting"}';
  domains_fr text[] := '{gmail.com,orange.fr,outlook.fr,free.fr,yahoo.fr,icloud.com,sfr.fr,laposte.net}';
  domains_int text[] := '{gmail.com,outlook.com,icloud.com,yahoo.com,gmx.de,libero.it}';

  g_ids uuid[] := '{}';
  g_id uuid;
  n_guests int;
  new_idx int := 400;
  i int; x numeric; lang text; country text; fn text; ln text; comp text;

  rm record;
  d date; start_d date := current_date - 760; end_d date := current_date + 150;
  m int; dow int; p numeric; los int; px numeric; this_year boolean;
  ch booking_channel; comm numeric; adults int; kids int;
  st reservation_status; total numeric; extras numeric; dep numeric; paid numeric;
  created timestamptz; lead int; seq int := 0;
  v_res_id uuid;
  rt record;
  bfast numeric;
begin
  -- Saisonnalité (occupation de base, coefficient prix) par mois
  if is_annecy then
    season_occ := '{0.50,0.66,0.58,0.66,0.76,0.86,0.95,0.97,0.82,0.66,0.52,0.70}';
    season_px  := '{0.82,0.95,0.86,0.92,1.00,1.12,1.32,1.38,1.08,0.92,0.82,1.00}';
    bfast := 19;
  else
    season_occ := '{0.66,0.76,0.80,0.80,0.82,0.82,0.70,0.55,0.84,0.84,0.82,0.74}';
    season_px  := '{0.95,1.00,1.02,1.02,1.05,1.05,0.92,0.85,1.08,1.08,1.04,1.10}';
    bfast := 15;
  end if;

  -- ---------- Clients ----------
  n_guests := case when is_annecy then 7000 else 4500 end;
  for i in 1..n_guests loop
    x := random();
    if x < 0.72 then lang := 'fr'; country := case when random() < 0.08 then pick('{BE,CH,LU}') else 'FR' end; fn := pick(fr_first); ln := pick(fr_last);
    elsif x < 0.84 then lang := 'en'; country := pick('{GB,GB,US,IE}'); fn := pick(en_first); ln := pick(en_last);
    elsif x < 0.92 then lang := 'de'; country := pick('{DE,DE,CH,AT}'); fn := pick(de_first); ln := pick(de_last);
    elsif x < 0.96 then lang := 'it'; country := 'IT'; fn := pick(it_first); ln := pick(it_last);
    else lang := 'es'; country := 'ES'; fn := pick(es_first); ln := pick(es_last);
    end if;
    comp := case when random() < (case when is_annecy then 0.12 else 0.38 end) then pick(companies) else null end;
    insert into guests (hotel_id, first_name, last_name, email, phone, language, country, company, created_at)
    values (p_hotel, fn, ln,
            translate(lower(fn || '.' || ln), 'éèêëàâäîïôöûüçñíóáú ', 'eeeeaaaiioouucnioau') ||
              case when random() < 0.35 then (floor(random() * 90) + 10)::text else '' end || '@' ||
              case when lang = 'fr' then pick(domains_fr) else pick(domains_int) end,
            case when country = 'FR' then '+33 6 ' else '+' || (floor(random()*50)+30)::text || ' ' end ||
              lpad(floor(random() * 100)::text, 2, '0') || ' ' || lpad(floor(random() * 100)::text, 2, '0') || ' ' ||
              lpad(floor(random() * 100)::text, 2, '0') || ' ' || lpad(floor(random() * 100)::text, 2, '0'),
            lang, country, comp, now() - interval '3 years')
    returning id into g_id;
    g_ids := g_ids || g_id;
  end loop;

  -- ---------- Réservations (chambre par chambre, sans chevauchement) ----------
  for rm in select r.id, r.number, t.id as type_id, t.code, t.base_price, t.capacity
              from rooms r join room_types t on t.id = r.room_type_id
             where r.hotel_id = p_hotel order by r.number loop
    d := start_d;
    while d < end_d loop
      m := extract(month from d); dow := extract(isodow from d);
      this_year := d >= current_date - 365;
      p := season_occ[m];
      if is_annecy then
        p := p * case when dow in (5, 6) then 1.14 else 0.95 end;
        if (m = 6 and extract(day from d) between 13 and 20) or (m = 8 and extract(day from d) between 5 and 9) then p := 0.99; end if;
      else
        p := p * case when dow in (1, 2, 3, 4) then 1.12 when dow in (5, 6) then 0.86 else 0.70 end;
        if m = 12 and extract(day from d) between 5 and 8 then p := 0.99; end if;
      end if;
      if this_year then p := p * 1.05; end if;
      -- Réservations futures : « on the books » décroissant avec l'horizon
      if d > current_date then
        p := p * case when d - current_date <= 3 then 0.96 when d - current_date <= 14 then 0.82
                      when d - current_date <= 30 then 0.62 when d - current_date <= 60 then 0.40
                      when d - current_date <= 90 then 0.24 else 0.10 end;
      end if;
      p := least(p, 0.985);

      if random() < p then
        x := random();
        if is_annecy then
          los := case when x < 0.22 then 1 when x < 0.52 then 2 when x < 0.74 then 3 when x < 0.86 then 4 when x < 0.94 then 5 else 6 + floor(random() * 3)::int end;
        else
          los := case when x < 0.42 then 1 when x < 0.74 then 2 when x < 0.90 then 3 else 4 end;
        end if;

        -- Canal (plus de direct cette année grâce au moteur de réservation)
        x := random() + case when this_year then 0.06 else 0 end;
        if is_annecy then
          ch := case when x < 0.40 then 'booking' when x < 0.52 then 'expedia' when x < 0.59 then 'airbnb'
                     when x < 0.62 then 'walk_in' when x < 0.70 then 'phone' else 'direct' end;
        else
          ch := case when x < 0.36 then 'booking' when x < 0.46 then 'expedia' when x < 0.49 then 'airbnb'
                     when x < 0.52 then 'walk_in' when x < 0.64 then 'phone' else 'direct' end;
        end if;
        comm := case ch when 'booking' then 17 when 'expedia' then 18 when 'airbnb' then 15 else 0 end;

        -- Prix
        px := rm.base_price * season_px[m]
              * case when is_annecy and dow in (5, 6) then 1.12 when not is_annecy and dow in (1,2,3,4) then 1.06 else 1 end
              * case when this_year then 1.06 else 1 end
              * (0.95 + random() * 0.1)
              * case when ch in ('direct','phone') then 0.97 else 1 end;
        total := round(px * los);

        if rm.capacity >= 4 then adults := 2; kids := 1 + floor(random() * 2)::int;
        elsif not is_annecy and random() < 0.55 then adults := 1; kids := 0;
        else adults := case when random() < 0.85 then 2 else 1 end; kids := 0; end if;

        extras := case when random() < 0.42 then bfast * (adults + kids) * los else 0 end
                  + case when random() < 0.08 then 30 else 0 end;

        -- Client : 22 % de clients fidèles (pool de 400), sinon nouveau
        if random() < 0.22 then g_id := g_ids[1 + floor(random() * 400)::int];
        else
          new_idx := new_idx + 1;
          if new_idx > n_guests then new_idx := 401; end if;
          g_id := g_ids[new_idx];
        end if;

        -- Statut
        if d + los < current_date or (d + los = current_date and random() < 0.55) then st := 'checked_out';
        elsif d < current_date or (d = current_date and random() < 0.38) then st := 'checked_in';
        elsif ch = 'direct' and random() < 0.05 and d > current_date + 2 then st := 'pending';
        else st := 'confirmed'; end if;

        dep := case when ch in ('direct', 'phone') then round(total * 0.3) else 0 end;
        paid := case
          when st = 'checked_out' then total + extras
          when ch in ('expedia', 'airbnb') then total
          when st = 'pending' then 0
          else dep end;

        -- Date de création (délai de réservation)
        lead := floor(power(random(), 1.6) * case when is_annecy then 110 else 45 end)::int;
        if d > current_date then lead := greatest(lead, (d - current_date) + floor(random() * 3)::int); end if;
        created := least((d - lead)::timestamp + make_interval(hours => 8 + floor(random() * 14)::int, mins => floor(random() * 60)::int),
                         now() - interval '20 minutes');

        seq := seq + 1;
        insert into reservations (hotel_id, code, guest_id, room_type_id, room_id, check_in, check_out, adults, children,
                                  status, channel, external_ref, total_amount, extras_amount, deposit_amount, paid_amount,
                                  commission_rate, checked_in_at, checked_out_at, created_at, updated_at)
        values (p_hotel, prefix || '-' || lpad(seq::text, 5, '0'), g_id, rm.type_id, rm.id, d, d + los, adults, kids,
                st, ch,
                case ch when 'booking' then (4000000000 + floor(random() * 99999999))::bigint::text
                        when 'expedia' then (7200000000 + floor(random() * 99999999))::bigint::text
                        when 'airbnb' then 'HM' || upper(substr(md5(random()::text), 1, 8)) else null end,
                total, extras, dep, paid, comm,
                case when st in ('checked_in', 'checked_out') then d + time '15:30' + make_interval(mins => floor(random() * 300)::int) end,
                case when st = 'checked_out' then (d + los) + time '09:00' + make_interval(mins => floor(random() * 120)::int) end,
                created, created);
        d := d + los;
      else
        d := d + 1;
      end if;
    end loop;
  end loop;

  -- No-shows (≈1,5 % des séjours passés)
  update reservations set status = 'no_show', paid_amount = deposit_amount, checked_in_at = null, checked_out_at = null
   where hotel_id = p_hotel and status = 'checked_out' and check_in < current_date - 2 and random() < 0.015;

  -- Annulations (≈10 %), sans chambre attribuée
  for i in 1..(select (count(*) * 0.10)::int from reservations where hotel_id = p_hotel) loop
    select * into rt from room_types where hotel_id = p_hotel order by random() limit 1;
    d := start_d + floor(random() * (end_d - start_d - 5))::int;
    los := 1 + floor(random() * 3)::int;
    ch := pick('{booking,booking,booking,expedia,airbnb,direct,direct,phone}')::booking_channel;
    created := least((d - 10 - floor(random() * 60)::int)::timestamp + interval '10 hours', now() - interval '1 hour');
    seq := seq + 1;
    insert into reservations (hotel_id, code, guest_id, room_type_id, room_id, check_in, check_out, adults, status, channel,
                              total_amount, deposit_amount, commission_rate, cancelled_at, created_at, updated_at)
    values (p_hotel, prefix || '-' || lpad(seq::text, 5, '0'), g_ids[401 + floor(random() * (n_guests - 401))::int], rt.id, null,
            d, d + los, 2, 'cancelled', ch, round(rt.base_price * los), 0,
            case ch when 'booking' then 17 when 'expedia' then 18 when 'airbnb' then 15 else 0 end,
            least(created + make_interval(days => floor(random() * 8)::int), now() - interval '30 minutes'), created, created);
  end loop;

  -- Liste d'attente sur les prochains jours chargés
  for i in 1..(case when is_annecy then 5 else 3 end) loop
    select * into rt from room_types where hotel_id = p_hotel order by sort limit 1 offset floor(random() * 2)::int;
    d := current_date + 2 + floor(random() * 18)::int;
    seq := seq + 1;
    insert into reservations (hotel_id, code, guest_id, room_type_id, check_in, check_out, adults, status, channel,
                              total_amount, created_at, updated_at)
    values (p_hotel, prefix || '-' || lpad(seq::text, 5, '0'), g_ids[401 + floor(random() * (n_guests - 401))::int], rt.id,
            d, d + 1 + floor(random() * 2)::int, 2, 'waitlist', pick('{phone,direct}')::booking_channel,
            round(rt.base_price * 2), now() - make_interval(hours => floor(random() * 72)::int), now());
  end loop;

  -- Statistiques & segments clients
  delete from guests g where g.hotel_id = p_hotel and not exists (select 1 from reservations r where r.guest_id = g.id);
  update guests g set stays_count = s.n, total_spent = s.spent, last_stay_at = s.last_out
    from (select guest_id, count(*) n, sum(total_amount + extras_amount) spent, max(check_out) last_out
            from reservations where hotel_id = p_hotel and status = 'checked_out' group by guest_id) s
   where g.id = s.guest_id;
  update guests g set segments = array_remove(array[
      case when g.total_spent > 2200 or g.stays_count >= 4 then 'vip' end,
      case when g.company is not null then 'affaires' end,
      case when exists (select 1 from reservations r where r.guest_id = g.id and r.children > 0) then 'famille' end,
      case when g.stays_count >= 2 then 'habitue' end], null),
    preferences = case when random() < 0.3 then jsonb_build_object(
      'oreiller', pick('{ferme,moelleux,"à mémoire de forme"}'),
      'etage', pick('{élevé,bas,"peu importe"}'),
      'petit_dejeuner', pick('{"en chambre",buffet,"sans gluten"}')) else '{}'::jsonb end,
    notes = case when random() < 0.05 then pick('{"Allergie aux fruits à coque","Préfère une chambre calme côté cour","Client fidèle — offrir une bouteille d''eau pétillante à l''arrivée","Voyage avec un petit chien","Arrive souvent tard (après 22h)"}') end
   where g.hotel_id = p_hotel;

  -- ---------- Statuts des chambres (aujourd'hui) ----------
  update rooms set hk_status = case when random() < 0.75 then 'inspected'::hk_status else 'clean'::hk_status end,
                   out_of_order_reason = null, hk_updated_at = now() - interval '3 hours'
   where hotel_id = p_hotel;
  -- Recouches
  update rooms r set hk_status = case when random() < 0.55 then 'clean'::hk_status else 'dirty'::hk_status end
    from reservations s where s.room_id = r.id and s.status = 'checked_in' and s.check_out > current_date and s.check_in < current_date;
  -- Départs du jour
  update rooms r set hk_status = case when random() < 0.4 then 'dirty'::hk_status when random() < 0.6 then 'in_progress'::hk_status else 'clean'::hk_status end,
                     hk_updated_at = now() - interval '1 hour'
    from reservations s where s.room_id = r.id and s.hotel_id = p_hotel and s.check_out = current_date and s.status = 'checked_out';
  update rooms r set hk_status = 'dirty'
    from reservations s where s.room_id = r.id and s.hotel_id = p_hotel and s.check_out = current_date and s.status = 'checked_in';
  -- Une chambre hors service (libre aujourd'hui et demain)
  update rooms set hk_status = 'out_of_order', out_of_order_reason = 'Dégât des eaux — plafond de la salle de bain'
   where id = (select r.id from rooms r where r.hotel_id = p_hotel
                 and not exists (select 1 from reservations s where s.room_id = r.id
                                  and s.status in ('confirmed','checked_in','pending')
                                  and s.check_in <= current_date + 2 and s.check_out > current_date)
               order by r.number desc limit 1);

  -- ---------- Paiements & factures (60 derniers jours) ----------
  insert into payments (hotel_id, reservation_id, kind, method, amount, created_at)
  select hotel_id, id, 'deposit', 'stripe', deposit_amount, created_at + interval '10 minutes'
    from reservations where hotel_id = p_hotel and deposit_amount > 0 and paid_amount >= deposit_amount
     and check_in >= current_date - 60 and status <> 'cancelled';
  insert into payments (hotel_id, reservation_id, kind, method, amount, created_at)
  select hotel_id, id, 'balance', case when channel in ('expedia','airbnb') then 'ota' else 'card' end,
         total_amount + extras_amount - deposit_amount, coalesce(checked_out_at, check_out::timestamptz)
    from reservations where hotel_id = p_hotel and status = 'checked_out' and check_out >= current_date - 60;

  insert into invoices (hotel_id, reservation_id, guest_id, number, issued_at, due_date, total_ht, total_vat, tourist_tax, total_ttc, paid_amount, status)
  select r.hotel_id, r.id, r.guest_id,
         'F' || to_char(r.check_out, 'YYYY') || '-' || lpad((row_number() over (partition by extract(year from r.check_out) order by r.check_out, r.code))::text, 5, '0'),
         r.check_out, r.check_out + case when r.guest_id in (select id from guests where company is not null) then 30 else 0 end,
         round((r.total_amount + r.extras_amount) / 1.1, 2),
         round((r.total_amount + r.extras_amount) - (r.total_amount + r.extras_amount) / 1.1, 2),
         round(h.tourist_tax_per_person * r.adults * r.nights, 2),
         r.total_amount + r.extras_amount + round(h.tourist_tax_per_person * r.adults * r.nights, 2),
         r.total_amount + r.extras_amount + round(h.tourist_tax_per_person * r.adults * r.nights, 2), 'paid'
    from reservations r join hotels h on h.id = r.hotel_id
   where r.hotel_id = p_hotel and r.status = 'checked_out' and r.check_out >= current_date - 60;
  -- Quelques factures entreprises en attente / en retard
  update invoices set paid_amount = 0,
         status = case when due_date < current_date then 'overdue' else 'issued' end,
         reminders_sent = case when due_date < current_date then 1 + floor(random() * 2)::int else 0 end
   where hotel_id = p_hotel and id in (select id from invoices where hotel_id = p_hotel and issued_at > current_date - 45 order by random() limit 7);
end $$;

-- ---------------------------------------------------------------------
create or replace function public.seed_demo_activity(p_hotel uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  is_annecy boolean := p_hotel = '11111111-1111-4111-8111-111111111111';
  d date; i int; n int; x numeric; t timestamptz;
  handled text; tpl int; g record; r record; c_id uuid; rating numeric; src text;
  rev_rate numeric := case when p_hotel = '11111111-1111-4111-8111-111111111111' then 0.42 else 0.24 end;
  call_tpl text[][] := array[
    array['booking', 'Réservation prise', 'Demande de chambre pour 2 nuits. L''agent a donné disponibilités et tarifs, réservation créée et lien d''acompte envoyé par SMS.'],
    array['booking', 'Réservation prise', 'Week-end en amoureux : chambre vue lac réservée avec petit-déjeuner. Confirmation envoyée par email.'],
    array['info', 'Information donnée', 'Question sur le parking et l''heure d''arrivée. Réponse : parking privé 18 €/nuit sur réservation, check-in dès 15h.'],
    array['info', 'Information donnée', 'Demande sur les horaires du petit-déjeuner (7h-10h30) et l''accès depuis la gare.'],
    array['info', 'Information donnée', 'Question sur les animaux acceptés (oui, 15 €/nuit) et le lit bébé (gratuit).'],
    array['modification', 'Réservation modifiée', 'Décalage du séjour d''une nuit. Disponibilité vérifiée, nouvelle confirmation envoyée.'],
    array['cancellation', 'Annulation traitée', 'Annulation dans le délai gratuit. Chambre remise en vente, confirmation envoyée.'],
    array['booking', 'Pas de disponibilité', 'Demande pour un samedi complet : dates alternatives proposées et inscription en liste d''attente.'],
    array['other', 'Transféré à la réception', 'Demande de devis pour un séminaire de 25 personnes : transfert à la réception avec résumé.'],
    array['info', 'Information donnée', 'Client anglophone : question sur les restaurants à proximité et le late check-out (possible jusqu''à 14h, 30 €).']
  ];
  conv_tpl text[][] := array[
    array['whatsapp', 'Arrivée tardive', 'Bonjour, nous arriverons vers 23h30, est-ce possible ?', 'Bonjour {p}, aucun souci ! Notre veilleur de nuit vous accueillera. Vous recevrez aussi un code d''accès par SMS la veille. Bon voyage !'],
    array['email', 'Facture pour mon entreprise', 'Bonjour, pourriez-vous établir la facture au nom de ma société avec le numéro de TVA ?', 'Bonjour {p}, bien sûr. Pouvez-vous nous confirmer la raison sociale et le numéro de TVA intracommunautaire ? La facture vous sera envoyée dès votre départ.'],
    array['booking', 'Baby cot', 'Hello, could we have a baby cot in the room please?', 'Hello {p}, of course! A baby cot will be set up in your room free of charge. See you soon!'],
    array['whatsapp', 'Parking', 'Bonjour, avez-vous un parking ? Ma voiture est un peu haute (2,10 m).', 'Bonjour {p}, notre parking privé accepte les véhicules jusqu''à 2,20 m. Je vous réserve une place (18 €/nuit) ?'],
    array['email', 'Séminaire', 'Bonjour, nous cherchons une salle pour 20 personnes le 12 du mois prochain, avec déjeuner.', 'Bonjour {p}, merci pour votre demande. Je transmets à notre responsable séminaires qui vous enverra une proposition sous 24 h.'],
    array['airbnb', 'Code wifi', 'Hi! What is the wifi password?', 'Hi {p}! The network is « Hotel-Guest » and the password is on the card in your room. Enjoy your stay!'],
    array['expedia', 'Late check-out', 'Est-il possible de partir à 14h dimanche ?', 'Bonjour {p}, le départ tardif à 14h est possible pour 30 €. Souhaitez-vous que je l''ajoute à votre réservation ?'],
    array['email', 'Allergie', 'Bonjour, ma fille est allergique aux fruits à coque, le petit-déjeuner peut-il être adapté ?', 'Bonjour {p}, c''est noté dans votre dossier. Notre équipe préparera un petit-déjeuner adapté et signalé.'],
    array['whatsapp', 'Restaurant', 'Vous auriez une bonne adresse pour dîner ce soir ?', 'Bonjour {p} ! Nous vous recommandons volontiers 3 adresses à moins de 10 minutes à pied. Voulez-vous que la réception réserve une table ?'],
    array['email', 'Objet oublié', 'Bonjour, j''ai oublié un chargeur dans la chambre 204.', 'Bonjour {p}, nous l''avons bien retrouvé. Nous pouvons vous l''envoyer par La Poste (8 €) ou le garder pour votre prochain séjour.']
  ];
  rev5 text[] := '{"Séjour parfait, personnel aux petits soins et chambre impeccable.","Emplacement idéal, petit-déjeuner délicieux, nous reviendrons !","Accueil chaleureux, literie très confortable. Le check-in en ligne est très pratique.","Superb stay, the staff were incredibly helpful and the room was spotless.","Excellent rapport qualité-prix, calme et très propre.","Tout était parfait, mention spéciale pour la réception."}';
  rev4 text[] := '{"Très bon séjour, seul bémol : la chambre un peu petite.","Hôtel agréable et bien situé, petit-déjeuner un peu cher.","Great location, comfortable bed. Breakfast could have more choice.","Bon accueil, chambre propre. Le parking est un peu étroit."}';
  rev3 text[] := '{"Correct mais bruyant côté rue, difficile de dormir.","Chambre propre mais climatisation bruyante. Personnel sympathique.","Séjour moyen : attente au check-in et wifi instable."}';
  rev2 text[] := '{"Déçu : chambre pas prête à notre arrivée à 16h et douche qui fuit.","Not worth the price, the room was noisy and the shower was cold."}';
  resp text[] := '{"Merci infiniment pour votre retour ! Toute l''équipe est ravie d''avoir contribué à votre séjour et espère vous accueillir à nouveau très bientôt.","Merci pour ce bel avis ! Nous transmettons vos compliments à l''équipe. Au plaisir de vous revoir.","Thank you for your lovely review! We look forward to welcoming you back."}';
begin
  -- ---------- Appels (60 jours) ----------
  for d in select generate_series(current_date - 60, current_date, interval '1 day')::date loop
    n := case when is_annecy then 9 + floor(random() * 8)::int else 5 + floor(random() * 5)::int end;
    if d = current_date then n := greatest(3, (n * extract(hour from now() at time zone 'Europe/Paris') / 24)::int); end if;
    for i in 1..n loop
      t := d + make_interval(hours => (case when random() < 0.85 then 8 + floor(random() * 13) else floor(random() * 24) end)::int,
                             mins => floor(random() * 60)::int);
      if t > now() then t := now() - make_interval(mins => floor(random() * 120)::int); end if;
      x := random();
      handled := case when x < 0.82 then 'ai' when x < 0.95 then 'transferred' else 'missed' end;
      tpl := 1 + floor(random() * array_length(call_tpl, 1))::int;
      select id, first_name, last_name, phone, language into g from guests where hotel_id = p_hotel order by random() limit 1;
      insert into calls (hotel_id, guest_id, from_number, language, started_at, duration_s, handled_by, intent, outcome, summary, transcript)
      values (p_hotel, case when random() < 0.6 then g.id end, coalesce(g.phone, '+33 6 00 00 00 00'), g.language, t,
              case when handled = 'missed' then 0 else 45 + floor(random() * 240)::int end,
              handled, call_tpl[tpl][1],
              case handled when 'ai' then call_tpl[tpl][2] when 'transferred' then 'Transféré à un humain' else 'Appel manqué — rappel planifié' end,
              case when handled = 'missed' then 'Appel en dehors des heures, messagerie IA saturée. Rappel automatique programmé.' else call_tpl[tpl][3] end,
              case when d > current_date - 7 and handled <> 'missed' then jsonb_build_array(
                jsonb_build_object('role', 'agent', 'text', 'Bonjour et bienvenue à ' || (select name from hotels where id = p_hotel) || ', je suis l''assistante virtuelle. Comment puis-je vous aider ?'),
                jsonb_build_object('role', 'guest', 'text', case call_tpl[tpl][1] when 'booking' then 'Bonjour, je voudrais savoir si vous avez une chambre pour le week-end prochain.' when 'cancellation' then 'Bonjour, je dois annuler ma réservation.' when 'modification' then 'Bonjour, je voudrais décaler mon séjour d''une nuit.' else 'Bonjour, j''ai une question pratique sur mon séjour.' end),
                jsonb_build_object('role', 'agent', 'text', 'Bien sûr, je regarde cela pour vous tout de suite.'),
                jsonb_build_object('role', 'agent', 'text', call_tpl[tpl][3])
              ) else '[]'::jsonb end);
    end loop;
  end loop;

  -- ---------- Messagerie unifiée ----------
  for i in 1..(case when is_annecy then 16 else 8 end) loop
    tpl := 1 + ((i - 1) % array_length(conv_tpl, 1));
    select s.id as res_id, gg.id, gg.first_name into r
      from reservations s join guests gg on gg.id = s.guest_id
     where s.hotel_id = p_hotel and s.status in ('confirmed', 'checked_in') and s.check_in between current_date - 2 and current_date + 10
     order by random() limit 1;
    t := now() - make_interval(mins => floor(random() * 60 * 48)::int);
    insert into conversations (hotel_id, guest_id, reservation_id, channel, subject, status, ai_mode, unread, last_message_at)
    values (p_hotel, r.id, r.res_id, conv_tpl[tpl][1]::msg_channel, conv_tpl[tpl][2],
            case when i % 3 = 0 then 'open' when i % 3 = 1 then 'closed' else 'waiting' end,
            case when tpl in (1, 3, 4, 6, 9) then 'auto' else 'suggest' end,
            case when i % 3 = 0 then 1 else 0 end, t)
    returning id into c_id;
    insert into messages (hotel_id, conversation_id, direction, author, body, created_at)
    values (p_hotel, c_id, 'in', 'guest', conv_tpl[tpl][3], t - interval '6 minutes');
    if i % 3 = 0 then
      update messages set ai_suggestion = replace(conv_tpl[tpl][4], '{p}', coalesce(r.first_name, 'Madame, Monsieur')), status = 'delivered'
       where conversation_id = c_id;
    else
      insert into messages (hotel_id, conversation_id, direction, author, body, created_at)
      values (p_hotel, c_id, 'out', case when tpl in (1, 3, 4, 6, 9) then 'ai' else 'Sarah Benali' end,
              replace(conv_tpl[tpl][4], '{p}', coalesce(r.first_name, 'Madame, Monsieur')), t);
    end if;
  end loop;

  -- ---------- Avis (2 ans) ----------
  for d in select generate_series(current_date - 730, current_date, interval '1 day')::date loop
    if random() < rev_rate then
      x := random() - case when d >= current_date - 365 then 0.06 else 0 end;
      rating := case when x < 0.60 then 5 when x < 0.85 then 4 when x < 0.95 then 3 when x < 0.985 then 2 else 1 end;
      x := random();
      src := case when x < 0.45 then 'google' when x < 0.85 then 'booking' else 'tripadvisor' end;
      select first_name, last_name, id into g from guests where hotel_id = p_hotel order by random() limit 1;
      insert into reviews (hotel_id, guest_id, source, author, rating, body, published_at, response, response_status, responded_at)
      values (p_hotel, g.id, src, g.first_name || ' ' || left(g.last_name, 1) || '.', rating,
              case when rating = 5 then pick(rev5) when rating = 4 then pick(rev4) when rating = 3 then pick(rev3) else pick(rev2) end,
              d + make_interval(hours => 8 + floor(random() * 14)::int),
              case when d < current_date - 3 and random() < 0.9 then pick(resp) end,
              case when d < current_date - 3 and random() < 0.9 then 'published' when rating >= 4 then 'suggested' else 'none' end,
              case when d < current_date - 3 then d + interval '1 day' end);
    end if;
  end loop;
  -- Un avis négatif récent sans réponse (déclenche l'alerte)
  insert into reviews (hotel_id, source, author, rating, body, published_at, response_status)
  values (p_hotel, 'google', 'Marc D.', 2, 'Déçu : chambre pas prête à notre arrivée à 16h et douche qui fuit. Personnel aimable mais débordé.',
          now() - interval '5 hours', 'suggested');
  update reviews set response = 'Bonjour Marc, merci pour votre retour et toutes nos excuses pour cette attente. Le problème de douche a été pris en charge par notre technicien dès votre signalement. Nous serions heureux de vous accueillir à nouveau pour vous offrir une meilleure expérience. — Claire Morel, directrice'
   where hotel_id = p_hotel and author = 'Marc D.' and published_at > now() - interval '1 day';

  -- ---------- Tickets de maintenance ----------
  insert into maintenance_tickets (hotel_id, room_id, title, description, priority, status, reported_by, created_at, preventive)
  select p_hotel, (select id from rooms where hotel_id = p_hotel and hk_status <> 'out_of_order' order by random() + length(tk.title) * 0 limit 1), tk.title, tk.descr, tk.prio::ticket_priority, tk.st::ticket_status,
         tk.who, now() - make_interval(hours => tk.h), tk.prev
  from (values
    ('Fuite robinet salle de bain', 'Le robinet du lavabo goutte en continu.', 'high', 'open', 'Maria Da Silva', 3, false),
    ('Climatisation bruyante', 'Bruit de vibration signalé par le client.', 'medium', 'in_progress', 'Réception', 20, false),
    ('Ampoule liseuse grillée', 'Côté gauche du lit.', 'low', 'open', 'Fatou Diallo', 6, false),
    ('Télévision sans signal', 'Chaînes TNT absentes.', 'medium', 'waiting_parts', 'Réception', 52, false),
    ('Chasse d''eau qui coule', null, 'high', 'open', 'Elena Popescu', 1, false),
    ('Détartrage des pommeaux de douche', 'Maintenance préventive mensuelle.', 'low', 'open', 'Automatisation', 30, true)
  ) as tk(title, descr, prio, st, who, h, prev);
  insert into maintenance_tickets (hotel_id, room_id, title, priority, status, reported_by, created_at, resolved_at)
  select p_hotel, (select id from rooms where hotel_id = p_hotel order by random() + k * 0 limit 1),
         pick('{"Siphon bouché","Poignée de porte desserrée","Prise électrique HS","Store bloqué","Radiateur froid","Serrure électronique : piles faibles","Joint de douche à refaire"}'),
         pick('{low,medium,medium,high}')::ticket_priority, 'resolved', pick('{Réception,"Maria Da Silva","Fatou Diallo"}'),
         now() - make_interval(days => k), now() - make_interval(days => k) + make_interval(hours => 2 + floor(random() * 30)::int)
  from generate_series(2, 120, 3) k;
  insert into maintenance_tickets (hotel_id, room_id, title, description, priority, status, reported_by, created_at)
  select p_hotel, id, 'Dégât des eaux — plafond salle de bain', 'Infiltration depuis la chambre du dessus. Chambre bloquée à la vente.', 'urgent', 'in_progress', 'Réception', now() - interval '26 hours'
    from rooms where hotel_id = p_hotel and hk_status = 'out_of_order';

  -- ---------- Tarifs journaliers (J-30 → J+365) ----------
  insert into daily_rates (hotel_id, room_type_id, date, price, suggested_price, min_stay, closed, source)
  select p_hotel, rt.id, dd::date,
         round(rt.base_price * s.px * case when is_annecy and extract(isodow from dd) in (5, 6) then 1.12
                                           when not is_annecy and extract(isodow from dd) in (1,2,3,4) then 1.06 else 1 end * 1.06),
         round(rt.base_price * s.px * case when is_annecy and extract(isodow from dd) in (5, 6) then 1.12
                                           when not is_annecy and extract(isodow from dd) in (1,2,3,4) then 1.06 else 1 end * 1.06 * (0.94 + random() * 0.16)),
         case when is_annecy and extract(month from dd) in (7, 8) and extract(isodow from dd) = 6 then 2 else 1 end,
         false, 'auto'
  from room_types rt
  cross join generate_series(current_date - 30, current_date + 365, interval '1 day') dd
  cross join lateral (select (case when is_annecy
         then ('{0.82,0.95,0.86,0.92,1.00,1.12,1.32,1.38,1.08,0.92,0.82,1.00}'::numeric[])[extract(month from dd)::int]
         else ('{0.95,1.00,1.02,1.02,1.05,1.05,0.92,0.85,1.08,1.08,1.04,1.10}'::numeric[])[extract(month from dd)::int] end) px) s
  where rt.hotel_id = p_hotel;

  -- ---------- Bons de commande ----------
  insert into purchase_orders (hotel_id, supplier_id, number, status, total, auto_generated, created_at, sent_at)
  select p_hotel, s.id, 'BC-' || to_char(now() - make_interval(days => k * 9), 'YYMMDD') || '-' || k, 'received',
         round((180 + random() * 600)::numeric, 2), true, now() - make_interval(days => k * 9), now() - make_interval(days => k * 9)
  from generate_series(1, 6) k cross join lateral (select id from suppliers where hotel_id = p_hotel order by random() limit 1) s;

  -- ---------- Notifications ----------
  insert into notifications (hotel_id, role, level, title, body, link, created_at) values
    (p_hotel, 'owner', 'critical', 'Avis 2★ sur Google', 'Marc D. : « chambre pas prête à notre arrivée… » — réponse IA à valider.', '/avis', now() - interval '5 hours'),
    (p_hotel, null, 'warning', 'Stock bas : capsules café', 'Bon de commande généré automatiquement et envoyé au fournisseur.', '/stock', now() - interval '3 hours'),
    (p_hotel, 'maintenance', 'critical', 'Ticket urgent : dégât des eaux', 'Chambre bloquée à la vente.', '/maintenance', now() - interval '26 hours'),
    (p_hotel, 'reception', 'info', 'Arrivée VIP aujourd''hui', 'Préparer le cadeau de bienvenue.', '/reservations', now() - interval '2 hours');
end $$;

-- ---------------------------------------------------------------------
-- Historique du journal d'automatisations (14 derniers jours)
create or replace function public.seed_demo_runs(p_hotel uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d date; r record; n int; h int;
begin
  for d in select generate_series(current_date - 13, current_date, interval '1 day')::date loop
    -- Planifiées
    if d < current_date or extract(hour from now() at time zone 'Europe/Paris') >= 9 then
      select count(*) into n from reservations where hotel_id = p_hotel and check_in = d + 3 and status in ('confirmed', 'checked_in', 'checked_out');
      perform log_automation(p_hotel, 'reminder_j3', format('%s rappel(s) J-3 envoyé(s) (email + WhatsApp) avec proposition d''upsell', n), '{}', 'success', null, d + time '09:00');
      perform log_automation(p_hotel, 'payment_reminders', format('%s relance(s) d''impayés envoyée(s)', floor(random() * 3)::int), '{}', 'success', null, d + time '09:02');
    end if;
    if d < current_date or extract(hour from now() at time zone 'Europe/Paris') >= 10 then
      select count(*) into n from reservations where hotel_id = p_hotel and check_in = d + 1 and status in ('confirmed', 'checked_in', 'checked_out');
      perform log_automation(p_hotel, 'arrival_instructions_j1', format('%s consigne(s) d''arrivée envoyée(s) avec lien de check-in en ligne', n), '{}', 'success', null, d + time '10:00');
    end if;
    perform log_automation(p_hotel, 'stock_decrement', 'Stocks décrémentés selon les nuitées et les départs de la veille', '{}', 'success', null, d + time '02:00');
    perform log_automation(p_hotel, 'hk_assignment',
      format('%s chambre(s) réparties entre %s femmes de chambre (départs prioritaires)',
             (select count(*) from reservations where hotel_id = p_hotel and (check_out = d or (check_in < d and check_out > d)) and status in ('checked_in','checked_out','confirmed')),
             (select count(*) from staff where hotel_id = p_hotel and role = 'housekeeping')),
      '{}', 'success', null, d + time '07:00');
    if d < current_date then
      perform log_automation(p_hotel, 'no_show_handling', format('Contrôle des no-shows : %s détecté(s)',
        (select count(*) from reservations where hotel_id = p_hotel and check_in = d and status = 'no_show')), '{}', 'success', null, d + time '23:30');
    end if;
    for h in 0..23 by 2 loop
      exit when d + make_interval(hours => h) > now();
      perform log_automation(p_hotel, 'channel_sync',
        format('Synchro OK — %s nouvelle(s) réservation(s) OTA importée(s), disponibilités et tarifs poussés',
          (select count(*) from reservations where hotel_id = p_hotel and channel in ('booking','expedia','airbnb')
              and created_at >= d + make_interval(hours => h - 2) and created_at < d + make_interval(hours => h))),
        '{}', 'success', null, d + make_interval(hours => h, mins => 1));
    end loop;
  end loop;

  -- Évènementielles
  for r in select s.*, guest_name(s.guest_id) gname from reservations s
            where s.hotel_id = p_hotel and s.created_at > now() - interval '10 days' and s.status <> 'waitlist' order by s.created_at loop
    perform log_automation(p_hotel, 'booking_confirmation',
      format('Confirmation envoyée à %s (%s, %s → %s) — email + WhatsApp', r.gname, r.code, to_char(r.check_in, 'DD/MM'), to_char(r.check_out, 'DD/MM')),
      '{}', 'success', r.id, r.created_at + interval '20 seconds');
    if r.channel in ('direct', 'phone') and r.deposit_amount > 0 then
      perform log_automation(p_hotel, 'deposit_request', format('Lien de paiement Stripe envoyé à %s — acompte %s €', r.gname, to_char(r.deposit_amount, 'FM999G990')),
        '{}', 'success', r.id, r.created_at + interval '30 seconds');
    end if;
    if r.status = 'cancelled' then
      perform log_automation(p_hotel, 'cancellation_handling', format('Annulation %s (%s) : conditions appliquées, client notifié', r.code, r.gname),
        '{}', 'success', r.id, r.cancelled_at);
    end if;
  end loop;
  for r in select s.*, guest_name(s.guest_id) gname, room_number(s.room_id) rn from reservations s
            where s.hotel_id = p_hotel and s.status = 'checked_out' and s.checked_out_at > now() - interval '7 days' order by s.checked_out_at loop
    perform log_automation(p_hotel, 'room_dirty_on_checkout', format('Chambre %s passée « à nettoyer » et ajoutée au planning ménage', r.rn), '{}', 'success', r.id, r.checked_out_at + interval '5 seconds');
    perform log_automation(p_hotel, 'invoice_on_checkout', format('Facture émise et envoyée par email à %s (%s)', r.gname, r.code), '{}', 'success', r.id, r.checked_out_at + interval '12 seconds');
    perform log_automation(p_hotel, 'post_stay', format('Demande d''avis + offre de retour programmées pour %s (J+1)', r.gname), '{}', 'success', r.id, r.checked_out_at + interval '15 seconds');
  end loop;
  for r in select * from calls where hotel_id = p_hotel and started_at > now() - interval '3 days' and handled_by <> 'missed' order by started_at loop
    perform log_automation(p_hotel, 'ai_voice_agent',
      format('Appel %s (%s s) — %s', case r.handled_by when 'ai' then 'traité par l''IA' else 'transféré à la réception' end, r.duration_s, r.outcome),
      jsonb_build_object('call_id', r.id), 'success', r.reservation_id, r.started_at + make_interval(secs => r.duration_s));
  end loop;
  for r in select * from reviews where hotel_id = p_hotel and published_at > now() - interval '14 days' order by published_at loop
    perform log_automation(p_hotel, 'reviews_fetch', format('Nouvel avis %s importé (%s★)', initcap(r.source), r.rating), '{}', 'success', null, r.published_at + interval '40 minutes');
    if r.rating >= 4 then
      perform log_automation(p_hotel, 'review_ai_reply', format('Réponse IA %s pour l''avis de %s (%s★)', case when r.response_status = 'published' then 'publiée' else 'proposée' end, r.author, r.rating), '{}', 'success', null, r.published_at + interval '42 minutes');
    else
      perform log_automation(p_hotel, 'low_review_alert', format('Alerte envoyée au propriétaire : avis %s★ de %s sur %s', r.rating, r.author, initcap(r.source)), '{}', 'success', null, r.published_at + interval '41 minutes');
      perform log_automation(p_hotel, 'review_ai_reply', format('Réponse IA proposée (validation humaine requise) pour %s', r.author), '{}', 'success', null, r.published_at + interval '43 minutes');
    end if;
  end loop;
  for r in select c.*, m.body from conversations c join lateral (select body from messages where conversation_id = c.id order by created_at limit 1) m on true
            where c.hotel_id = p_hotel loop
    perform log_automation(p_hotel, 'ai_inbox',
      format('%s — %s : réponse IA %s', initcap(r.channel::text), r.subject, case when r.ai_mode = 'auto' and r.unread = 0 then 'envoyée automatiquement' else 'proposée à la réception' end),
      '{}', 'success', r.reservation_id, r.last_message_at);
  end loop;
  perform log_automation(p_hotel, 'auto_purchase_order', 'Capsules café sous le seuil (420 < 500) : bon de commande de 1 000 u. envoyé à Boissons & Minibar Distribution', '{}', 'success', null, now() - interval '3 hours');
  perform log_automation(p_hotel, 'accounting_export', 'Export FEC + CSV des ventes d''octobre envoyé au cabinet comptable', '{}', 'success', null, date_trunc('month', now()) + interval '6 hours');
  perform log_automation(p_hotel, 'staff_planning', 'Planning de la semaine publié (occupation prévue 78 %) — 14 shifts', '{}', 'success', null, now() - interval '4 days');
  perform log_automation(p_hotel, 'pre_stay_upsell', '6 offres de surclassement envoyées — 2 acceptées (+138 €)', '{}', 'success', null, now() - interval '7 hours');
  perform log_automation(p_hotel, 'in_stay_check', '9 messages de satisfaction envoyés — 1 client insatisfait signalé à la réception', '{}', 'success', null, now() - interval '22 hours');

  -- Quelques erreurs réalistes (pour montrer la supervision)
  perform log_automation(p_hotel, 'booking_confirmation', 'WhatsApp : numéro invalide (+33 6 12 …) — confirmation envoyée par email uniquement', '{"error":"invalid_number"}', 'error', null, now() - interval '2 days 3 hours');
  perform log_automation(p_hotel, 'channel_sync', 'Timeout de l''API Expedia (30 s) — nouvelle tentative réussie 5 min plus tard', '{"error":"timeout"}', 'error', null, now() - interval '4 days 6 hours');
end $$;

-- ---------------------------------------------------------------------
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
  perform set_config('app.seeding', 'off', true);
  foreach h in array array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[] loop
    perform seed_demo_runs(h);
  end loop;
end $$;
revoke execute on function public.seed_demo() from anon, authenticated;
revoke execute on function public.seed_demo_hotel(uuid) from anon, authenticated;
revoke execute on function public.seed_demo_activity(uuid) from anon, authenticated;
revoke execute on function public.seed_demo_runs(uuid) from anon, authenticated;
