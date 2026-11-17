-- =====================================================================
-- Données de démo statiques : groupe, 2 hôtels, chambres, équipe,
-- comptes démo, fournisseurs, stocks, catalogue d'automatisations
-- =====================================================================

create or replace function public.pick(a text[]) returns text
language sql volatile as $$ select a[1 + floor(random() * array_length(a, 1))::int] $$;

-- ---------- Groupe & hôtels ----------
insert into organizations (id, name) values
  ('00000000-0000-4000-a000-000000000001', 'Groupe Morel Hospitality');

insert into hotels (id, organization_id, slug, name, city, address, stars, tourist_tax_per_person, phone, email) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-a000-000000000001', 'les-tilleuls',
   'Hôtel Les Tilleuls', 'Annecy', '12 quai des Tilleuls, 74000 Annecy', 4, 2.53, '+33 4 50 00 12 12', 'contact@les-tilleuls.example'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-a000-000000000001', 'maison-saint-clair',
   'Maison Saint-Clair', 'Lyon', '8 rue Saint-Clair, 69001 Lyon', 3, 1.65, '+33 4 72 00 34 34', 'bonjour@maison-saint-clair.example');

insert into integration_settings (hotel_id) values
  ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');

-- ---------- Types de chambres ----------
insert into room_types (hotel_id, code, name, capacity, base_price, sort) values
  ('11111111-1111-4111-8111-111111111111', 'CLA', 'Classique',          2, 129, 1),
  ('11111111-1111-4111-8111-111111111111', 'SUP', 'Supérieure',         2, 159, 2),
  ('11111111-1111-4111-8111-111111111111', 'LAC', 'Deluxe vue lac',     2, 209, 3),
  ('11111111-1111-4111-8111-111111111111', 'FAM', 'Familiale',          4, 229, 4),
  ('11111111-1111-4111-8111-111111111111', 'STE', 'Suite Panorama',     3, 349, 5),
  ('22222222-2222-4222-8222-222222222222', 'CLA', 'Classique',          2, 109, 1),
  ('22222222-2222-4222-8222-222222222222', 'SUP', 'Supérieure',         2, 139, 2),
  ('22222222-2222-4222-8222-222222222222', 'STE', 'Suite Saint-Clair',  3, 229, 3);

-- ---------- Chambres : 40 à Annecy, 18 à Lyon ----------
insert into rooms (hotel_id, room_type_id, number, floor)
select '11111111-1111-4111-8111-111111111111',
       (select id from room_types where hotel_id = '11111111-1111-4111-8111-111111111111' and code =
          case when i <= 14 then 'CLA' when i <= 26 then 'SUP' when i <= 34 then 'LAC' when i <= 38 then 'FAM' else 'STE' end),
       (((i - 1) / 10 + 1) * 100 + ((i - 1) % 10 + 1))::text,
       (i - 1) / 10 + 1
from generate_series(1, 40) i;

insert into rooms (hotel_id, room_type_id, number, floor)
select '22222222-2222-4222-8222-222222222222',
       (select id from room_types where hotel_id = '22222222-2222-4222-8222-222222222222' and code =
          case when i <= 10 then 'CLA' when i <= 16 then 'SUP' else 'STE' end),
       (((i - 1) / 6 + 1) * 100 + ((i - 1) % 6 + 1))::text,
       (i - 1) / 6 + 1
from generate_series(1, 18) i;

-- ---------- Comptes démo (un par rôle) ----------
do $$
declare
  u record;
begin
  for u in select * from (values
    ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'proprietaire@demo-hotelis.fr', 'Claire Morel'),
    ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'reception@demo-hotelis.fr',    'Sarah Benali'),
    ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'menage@demo-hotelis.fr',       'Maria Da Silva'),
    ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, 'maintenance@demo-hotelis.fr',  'Karim Mansouri')
  ) as t(id, email, name)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
            extensions.crypt('Demo-Hotelis-2026', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name),
            now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
    insert into profiles (id, full_name) values (u.id, u.name);
  end loop;
end $$;

insert into user_hotel_roles (user_id, hotel_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'reception'),
  ('aaaaaaaa-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'housekeeping'),
  ('aaaaaaaa-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'maintenance');

-- ---------- Équipe ----------
insert into staff (hotel_id, user_id, full_name, role, phone) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'Claire Morel',   'owner',        '+33 6 11 22 33 01'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 'Sarah Benali',   'reception',    '+33 6 11 22 33 02'),
  ('11111111-1111-4111-8111-111111111111', null,                                   'Julien Petit',   'reception',    '+33 6 11 22 33 03'),
  ('11111111-1111-4111-8111-111111111111', null,                                   'Thomas Roux',    'reception',    '+33 6 11 22 33 04'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000003', 'Maria Da Silva', 'housekeeping', '+33 6 11 22 33 05'),
  ('11111111-1111-4111-8111-111111111111', null,                                   'Fatou Diallo',   'housekeeping', '+33 6 11 22 33 06'),
  ('11111111-1111-4111-8111-111111111111', null,                                   'Elena Popescu',  'housekeeping', '+33 6 11 22 33 07'),
  ('11111111-1111-4111-8111-111111111111', null,                                   'Nadia Haddad',   'housekeeping', '+33 6 11 22 33 08'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000004', 'Karim Mansouri', 'maintenance',  '+33 6 11 22 33 09'),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000001', 'Claire Morel',   'owner',        '+33 6 11 22 33 01'),
  ('22222222-2222-4222-8222-222222222222', null,                                   'Lucas Girard',   'reception',    '+33 6 22 33 44 01'),
  ('22222222-2222-4222-8222-222222222222', null,                                   'Inès Moreau',    'reception',    '+33 6 22 33 44 02'),
  ('22222222-2222-4222-8222-222222222222', null,                                   'Ana Ferreira',   'housekeeping', '+33 6 22 33 44 03'),
  ('22222222-2222-4222-8222-222222222222', null,                                   'Joëlle Martin',  'housekeeping', '+33 6 22 33 44 04'),
  ('22222222-2222-4222-8222-222222222222', null,                                   'Pierre Blanc',   'maintenance',  '+33 6 22 33 44 05');

-- ---------- Fournisseurs & stocks ----------
do $$
declare
  h uuid;
  s_linge uuid; s_hyg uuid; s_bois uuid; s_boul uuid;
  k numeric;
begin
  foreach h in array array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[] loop
    k := case when h = '11111111-1111-4111-8111-111111111111' then 1 else 0.5 end;
    insert into suppliers (hotel_id, name, email, phone, lead_time_days) values
      (h, 'Blanchisserie Alpine', 'commandes@blanchisserie-alpine.example', '+33 4 50 11 11 11', 2) returning id into s_linge;
    insert into suppliers (hotel_id, name, email, phone, lead_time_days) values
      (h, 'Hygiène Pro Services', 'pro@hygiene-pro.example', '+33 4 50 22 22 22', 3) returning id into s_hyg;
    insert into suppliers (hotel_id, name, email, phone, lead_time_days) values
      (h, 'Boissons & Minibar Distribution', 'ventes@bmd.example', '+33 4 50 33 33 33', 2) returning id into s_bois;
    insert into suppliers (hotel_id, name, email, phone, lead_time_days) values
      (h, 'Maison Favre — boulangerie', 'favre@boulangerie.example', '+33 4 50 44 44 44', 1) returning id into s_boul;

    insert into inventory_items (hotel_id, supplier_id, category, name, unit, quantity, threshold, reorder_qty, unit_cost, per_occupied_room, per_checkout) values
      (h, s_linge, 'linge',          'Draps 2 personnes',            'u',     round(260*k), round(160*k), round(120*k), 14.50, 0,    0.02),
      (h, s_linge, 'linge',          'Housses de couette',           'u',     round(150*k), round(90*k),  round(60*k),  22.00, 0,    0.01),
      (h, s_linge, 'linge',          'Serviettes de bain',           'u',     round(210*k), round(240*k), round(200*k), 6.80,  0,    0.03),
      (h, s_linge, 'linge',          'Peignoirs',                    'u',     round(70*k),  round(40*k),  round(30*k),  24.00, 0,    0.01),
      (h, s_hyg,   'accueil',        'Savons 40 g',                  'u',     round(1400*k),round(600*k), round(1500*k),0.28,  0,    2),
      (h, s_hyg,   'accueil',        'Gel douche 30 ml',             'u',     round(520*k), round(600*k), round(1200*k),0.35,  1,    0),
      (h, s_hyg,   'accueil',        'Shampoing 30 ml',              'u',     round(980*k), round(600*k), round(1200*k),0.35,  0.8,  0),
      (h, s_hyg,   'accueil',        'Kits dentaires',               'u',     round(310*k), round(150*k), round(300*k), 0.45,  0,    0.3),
      (h, s_bois,  'minibar',        'Eau minérale 50 cl',           'u',     round(380*k), round(200*k), round(300*k), 0.40,  0.6,  0),
      (h, s_bois,  'minibar',        'Bières artisanales',           'u',     round(64*k),  round(80*k),  round(96*k),  1.60,  0.12, 0),
      (h, s_bois,  'minibar',        'Chocolats',                    'u',     round(140*k), round(80*k),  round(120*k), 0.90,  0.1,  0),
      (h, s_bois,  'minibar',        'Capsules café',                'u',     round(420*k), round(500*k), round(1000*k),0.32,  2,    0),
      (h, s_boul,  'petit_dejeuner', 'Viennoiseries (commande J+1)', 'u',     round(90*k),  round(60*k),  round(80*k),  0.75,  1.2,  0),
      (h, s_boul,  'petit_dejeuner', 'Jus d''orange pressé',         'L',     round(36*k),  round(20*k),  round(30*k),  3.20,  0.25, 0),
      (h, s_boul,  'petit_dejeuner', 'Confitures portions',         'u',     round(600*k), round(300*k), round(500*k), 0.18,  1.5,  0),
      (h, s_boul,  'petit_dejeuner', 'Café en grains',               'kg',    round(14*k),  round(8*k),   round(10*k),  18.00, 0.03, 0),
      (h, s_hyg,   'entretien',      'Produit multi-surfaces',       'L',     round(42*k),  round(20*k),  round(30*k),  4.20,  0.05, 0),
      (h, s_hyg,   'entretien',      'Papier toilette',              'rouleau', round(380*k), round(250*k), round(400*k), 0.30, 0.5, 0),
      (h, s_hyg,   'entretien',      'Sacs poubelle',                'u',     round(300*k), round(150*k), round(400*k), 0.08,  0.5,  1),
      (h, s_hyg,   'entretien',      'Désinfectant sanitaires',      'L',     round(11*k),  round(15*k),  round(20*k),  5.90,  0.02, 0);
  end loop;
end $$;

-- ---------- Plans de maintenance préventive ----------
insert into preventive_plans (hotel_id, title, frequency_days, next_due, scope)
select h, p.title, p.freq, current_date + p.offs, p.scope
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) h,
     (values ('Détartrage des pommeaux de douche', 30, 4, 'Toutes les chambres'),
             ('Nettoyage des filtres de climatisation', 90, 12, 'Toutes les chambres'),
             ('Contrôle légionelle (prélèvements)', 90, 23, 'Réseau eau chaude'),
             ('Entretien chaudière', 180, 41, 'Chaufferie'),
             ('Vérification des extincteurs', 365, 63, 'Bâtiment'),
             ('Contrôle des détecteurs de fumée', 180, 2, 'Toutes les chambres')) p(title, freq, offs, scope);

-- ---------- Règles de prix & évènements ----------
insert into pricing_rules (hotel_id, name, kind, config, active)
select h, r.name, r.kind, r.cfg::jsonb, r.active
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) h,
     (values ('Occupation > 85 % : +15 %',                    'occupancy',   '{"above":85,"adjust":15}', true),
             ('Occupation > 70 % : +8 %',                     'occupancy',   '{"above":70,"adjust":8}', true),
             ('Occupation < 40 % à J-14 : -10 %',             'occupancy',   '{"below":40,"days_before":14,"adjust":-10}', true),
             ('Aligné sur la moyenne des concurrents (-3 %)', 'competitor',  '{"position":-3}', true),
             ('Séjour minimum 2 nuits le samedi (juil.-août)','min_stay',    '{"min":2,"dow":[6],"months":[7,8]}', true),
             ('Fermeture à la vente si occupation > 97 %',     'close_out',   '{"above":97}', true),
             ('Dernière minute : -15 % à J-2 si occ. < 70 %',  'last_minute', '{"days_before":2,"below":70,"adjust":-15}', false)) r(name, kind, cfg, active);

insert into local_events (hotel_id, name, start_date, end_date, impact_percent) values
  ('11111111-1111-4111-8111-111111111111', 'Marché de Noël d''Annecy', '2026-11-28', '2026-12-24', 10),
  ('11111111-1111-4111-8111-111111111111', 'Festival du film d''animation', '2027-06-13', '2027-06-19', 35),
  ('11111111-1111-4111-8111-111111111111', 'Fête du Lac', '2027-08-07', '2027-08-07', 40),
  ('22222222-2222-4222-8222-222222222222', 'Fête des Lumières', '2026-12-05', '2026-12-08', 45),
  ('22222222-2222-4222-8222-222222222222', 'Salon de la restauration (Eurexpo)', '2027-01-21', '2027-01-25', 30);

-- ---------- Catalogue d'automatisations ----------
create or replace function public.install_automations(h uuid) returns void
language sql security definer set search_path = public as $$
  insert into automations (hotel_id, key, module, name, description, trigger_label, actions, enabled) values
  (h, 'channel_sync', 'reservations', 'Synchro PMS & channel manager', 'Importe les réservations Booking, Expedia, Airbnb et site direct ; pousse disponibilités et tarifs.', 'Toutes les 30 min + webhook PMS', '{"Import des nouvelles réservations","Mise à jour des disponibilités","Push des tarifs sur 365 jours"}', true),
  (h, 'booking_confirmation', 'reservations', 'Confirmation de réservation', 'Envoie la confirmation dans la langue du client, sur le canal préféré.', 'Nouvelle réservation', '{"Email de confirmation","SMS / WhatsApp","Création / mise à jour de la fiche client"}', true),
  (h, 'deposit_request', 'reservations', 'Acompte automatique', 'Demande un acompte sur les réservations directes et relance si non payé.', 'Réservation directe créée', '{"Lien de paiement Stripe","Relance à 48 h","Annulation auto à 72 h si impayé"}', true),
  (h, 'reminder_j3', 'reservations', 'Rappel J-3', 'Rappel de séjour avec proposition d''upsell.', 'Tous les jours à 9h00', '{"Email + WhatsApp de rappel","Proposition surclassement / petit-déjeuner"}', true),
  (h, 'arrival_instructions_j1', 'reservations', 'Consignes d''arrivée J-1', 'Consignes d''accès, parking et lien de check-in en ligne.', 'Tous les jours à 10h00', '{"Consignes d''arrivée","Lien de check-in en ligne","Code d''accès (arrivée tardive)"}', true),
  (h, 'cancellation_handling', 'reservations', 'Gestion des annulations', 'Libère la chambre, applique les conditions et rembourse si besoin.', 'Réservation annulée', '{"Libération de la chambre","Application des conditions d''annulation","Remboursement Stripe","Notification client"}', true),
  (h, 'waitlist_promotion', 'reservations', 'Liste d''attente', 'Attribue automatiquement une chambre libérée au premier client en attente.', 'Chambre libérée', '{"Attribution de la chambre","Confirmation au client"}', true),
  (h, 'no_show_handling', 'reservations', 'Gestion des no-shows', 'Passe en no-show les arrivées non présentées et encaisse l''acompte.', 'Tous les jours à 23h30', '{"Statut no-show","Encaissement de l''acompte","Remise en vente de la chambre"}', true),
  (h, 'planning_sync', 'reservations', 'Synchro des modifications de planning', 'Répercute chaque déplacement du planning vers le PMS et les OTA.', 'Changement de chambre ou de dates', '{"Mise à jour PMS","Mise à jour channel manager","Notification ménage"}', true),
  (h, 'ai_voice_agent', 'messaging', 'Agent vocal IA 24/7', 'Répond aux appels, donne prix et disponibilités, réserve, transfère si besoin.', 'Appel entrant', '{"Réponse en 5 langues","Disponibilités & prix","Prise de réservation","Transfert humain","Transcription + résumé"}', true),
  (h, 'ai_inbox', 'messaging', 'Réponses IA messagerie', 'Propose ou envoie une réponse aux emails, WhatsApp et messages OTA selon les règles.', 'Nouveau message', '{"Détection d''intention","Réponse proposée","Envoi auto si question simple"}', true),
  (h, 'guest_segmentation', 'crm', 'Fiche client & segmentation', 'Crée la fiche client et calcule les segments VIP, affaires, famille, habitué.', 'Nouvelle réservation / départ', '{"Création de fiche","Segmentation"}', true),
  (h, 'pre_stay_upsell', 'crm', 'Séquence pré-séjour (upsell)', 'Surclassement, petit-déjeuner, late check-out.', 'J-7 avant l''arrivée', '{"Email personnalisé","Paiement de l''option en un clic"}', true),
  (h, 'in_stay_check', 'crm', 'Check de satisfaction', 'Message WhatsApp le lendemain de l''arrivée.', 'J+1 après l''arrivée, 18h', '{"Message WhatsApp","Alerte réception si insatisfait"}', true),
  (h, 'post_stay', 'crm', 'Avis + offre de retour', 'Demande d''avis et code de réduction pour un retour en direct.', 'J+1 après le départ', '{"Demande d''avis","Offre -10 % en direct"}', true),
  (h, 'stock_decrement', 'stock', 'Décrément automatique des stocks', 'Décompte selon les nuitées et les départs.', 'Chaque nuit à 2h', '{"Calcul des consommations","Mise à jour des stocks"}', true),
  (h, 'auto_purchase_order', 'stock', 'Bon de commande automatique', 'Génère et envoie le bon de commande au fournisseur sous le seuil.', 'Stock sous le seuil', '{"Bon de commande PDF","Envoi au fournisseur"}', true),
  (h, 'hk_assignment', 'housekeeping', 'Attribution des chambres au ménage', 'Répartit départs et recouches entre les femmes de chambre.', 'Tous les jours à 7h00', '{"Répartition équilibrée","Priorité aux arrivées du jour","Notification mobile"}', true),
  (h, 'room_dirty_on_checkout', 'housekeeping', 'Chambre à nettoyer au départ', 'Passe la chambre en « sale » au check-out.', 'Check-out', '{"Statut chambre","Ajout au planning ménage"}', true),
  (h, 'preventive_maintenance', 'housekeeping', 'Maintenance préventive', 'Crée les tickets de maintenance planifiée.', 'Tous les lundis 8h', '{"Création des tickets","Attribution au technicien"}', true),
  (h, 'dynamic_pricing', 'revenue', 'Prix dynamiques', 'Ajuste les prix selon occupation, saison, évènements et concurrence.', 'Toutes les 6 h', '{"Calcul des prix","Push channel manager"}', false),
  (h, 'invoice_on_checkout', 'finance', 'Facture au check-out', 'Génère et envoie la facture avec taxe de séjour.', 'Check-out', '{"Facture PDF","Envoi par email"}', true),
  (h, 'payment_reminders', 'finance', 'Relance des impayés', 'Relance à J+3, J+10, J+20.', 'Tous les jours à 9h00', '{"Email de relance","Lien de paiement"}', true),
  (h, 'accounting_export', 'finance', 'Export comptable (FEC)', 'Export mensuel envoyé au cabinet comptable.', 'Le 1er de chaque mois', '{"Fichier FEC","CSV ventes","Envoi au comptable"}', true),
  (h, 'reviews_fetch', 'reviews', 'Collecte des avis', 'Récupère les avis Google, Booking et TripAdvisor.', 'Toutes les heures', '{"Import des avis"}', true),
  (h, 'review_ai_reply', 'reviews', 'Réponse IA aux avis', 'Publie automatiquement la réponse aux avis 4-5★, propose une réponse pour les autres.', 'Nouvel avis', '{"Rédaction IA","Publication auto si ≥ 4★"}', true),
  (h, 'low_review_alert', 'reviews', 'Alerte avis ≤ 3★', 'Alerte immédiate du directeur.', 'Nouvel avis ≤ 3★', '{"Notification push","Email au propriétaire"}', true),
  (h, 'staff_planning', 'team', 'Planning du personnel', 'Planning de la semaine selon les prévisions d''occupation.', 'Chaque vendredi', '{"Calcul des besoins","Publication du planning"}', true)
  on conflict (hotel_id, key) do nothing;
$$;

select install_automations('11111111-1111-4111-8111-111111111111');
select install_automations('22222222-2222-4222-8222-222222222222');
