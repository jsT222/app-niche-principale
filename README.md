# Hôtelis — le pilote automatique des hôtels indépendants

Dashboard SaaS multi-établissements qui centralise et automatise l'exploitation d'un hôtel :
réservations, appels et messages IA, CRM, stock, housekeeping, revenue, finance, avis et équipe.

**Stack** : Next.js 15 (App Router) · Tailwind CSS 4 · composants shadcn/ui (Radix) · Supabase (Postgres, Auth, RLS, pg_cron) · n8n · Vercel.

## Démo

Comptes de démonstration (connexion en un clic sur `/login`, mot de passe `Demo-Hotelis-2026`) :

| Rôle | Email | Accès |
|---|---|---|
| Propriétaire | proprietaire@demo-hotelis.fr | 2 hôtels, tous les modules, interrupteurs des automatisations |
| Réception | reception@demo-hotelis.fr | Hôtel Les Tilleuls : réservations, planning, clients, messagerie |
| Ménage | menage@demo-hotelis.fr | Statut des chambres (vue tablette / mobile) |
| Maintenance | maintenance@demo-hotelis.fr | Tickets et maintenance préventive |

Données de démo : groupe « Morel Hospitality » avec **Hôtel Les Tilleuls** (Annecy, 40 chambres) et
**Maison Saint-Clair** (Lyon, 18 chambres), ~18 700 réservations sur 25 mois (comparaisons N-1),
appels IA, messages, avis, stocks, tickets. Les données sont **régénérées chaque nuit** (pg_cron, 2h30 UTC)
relativement à la date du jour.

Moteur de réservation public : `/reserver/les-tilleuls` et `/reserver/maison-saint-clair`.

## Ce qui est livré (itération 1)

- **Tableau de bord** : occupation, ADR, RevPAR, CA jour / mois, arrivées / départs, chambres prêtes,
  appels traités par l'IA, part directe vs OTA, alertes stock, tickets ouverts, note des avis — tout avec N-1,
  sélecteur d'hôtel (vue groupe ou par établissement).
- **Réservations** : vues arrivées / départs / en séjour / à venir / liste d'attente, recherche, fiche détaillée
  avec actions (check-in, check-out → facture, annulation → libération + liste d'attente, no-show),
  création avec attribution automatique de chambre.
- **Planning** : calendrier chambres × jours, glisser-déposer (changement de chambre / décalage), anti-chevauchement
  garanti par contrainte d'exclusion PostgreSQL.
- **Moteur de réservation direct** : disponibilités temps réel, tarif direct -5 %, acompte 30 % (paiement simulé en démo).
- **Automatisations** : 28 automatisations, chacune avec interrupteur on/off (propriétaire), exécution manuelle,
  journal d'exécution (statut, durée, résumé) visible dans l'appli et dans chaque fiche réservation.
- **Housekeeping** (statut des chambres en un geste) et **Maintenance** (tickets priorisés, préventif).
- Mode clair / sombre, responsive (tablette réception, mobile staff).

Les autres modules (messagerie, CRM, stock, revenue, finance, avis, équipe) ont leur schéma, leurs données et
leurs automatisations ; leurs écrans complets sont les prochaines itérations.

## Architecture

```
Navigateur ──► Next.js (Vercel) ──► Supabase (Postgres + RLS + Auth)
                                        │  triggers SQL ─► journal automation_runs
                                        │  pg_cron ──────► tâches planifiées (J-3, J-1, no-show, synchro…)
                                        └► pg_net ───────► webhooks n8n (hors mode démo)
n8n ──► API Supabase (service role) : lit les données, écrit dans le journal via rpc/log_automation
```

- Toute la logique métier critique est **dans la base** (triggers + fonctions) : elle s'exécute quel que soit le canal
  (appli, moteur public, PMS, n8n).
- `integration_settings.demo_mode = true` : les intégrations externes sont simulées et journalisées.
  Passer à `false` active l'envoi des évènements vers n8n (`n8n_webhook_base`).

## Schéma de la base (`supabase/migrations`)

| Domaine | Tables |
|---|---|
| Organisation & accès | `organizations`, `hotels`, `profiles`, `user_hotel_roles` (rôle par hôtel : owner, reception, housekeeping, maintenance) |
| Chambres | `room_types`, `rooms` (statut ménage) |
| Réservations | `reservations` (contrainte d'exclusion anti-surbooking), `payments`, `invoices` |
| Appels & messagerie | `calls` (transcription, résumé), `conversations`, `messages` (suggestion IA) |
| CRM | `guests` (segments, préférences, dépenses) |
| Stock & achats | `suppliers`, `inventory_items` (conso / nuitée et / départ), `stock_movements`, `purchase_orders`, `purchase_order_lines` |
| Housekeeping & maintenance | `housekeeping_tasks`, `maintenance_tickets`, `preventive_plans` |
| Revenue | `daily_rates`, `pricing_rules`, `local_events`, `competitor_rates` |
| Avis | `reviews` |
| Équipe | `staff`, `shifts`, `tasks`, `notifications` |
| Automatisations | `automations` (on/off, lien workflow n8n), `automation_runs` (journal), `integration_settings` |

**RLS** : chaque table opérationnelle est filtrée par `hotel_id` via `has_hotel_role()` ; lecture et écriture
sont définies par rôle (ex. le ménage lit les réservations mais ne les modifie pas ; seules la réception et le propriétaire voient la finance).

## Workflows n8n

| Workflow | Déclencheur | Actions | État |
|---|---|---|---|
| Hôtelis — Confirmation de réservation | Webhook `reservation.created` (Supabase) | Vérifie l'interrupteur → WhatsApp (Twilio) → email (Resend) → journal | Créé, identifiants à brancher |
| Hôtelis — Rappels J-3 et consignes J-1 | Planifié 9h et 10h (Europe/Paris) | Arrivées concernées → interrupteur par hôtel → WhatsApp personnalisé → journal | Créé, identifiants à brancher |
| Hôtelis — Annulation, remboursement et notification | Webhook `reservation.status_changed` | Si annulée et > 48 h : remboursement Stripe → email → journal | Créé, identifiants à brancher |

Automatisations prévues (catalogue complet dans `automations`) : synchro PMS/channel manager, acompte Stripe,
liste d'attente, no-shows, agent vocal 24/7, boîte de réception IA, segmentation, séquences pré/pendant/post-séjour,
décrément des stocks + bons de commande, attribution des chambres au ménage, maintenance préventive,
prix dynamiques, facture au check-out, relances d'impayés, export FEC, taxe de séjour, collecte + réponse IA aux avis,
alerte avis ≤ 3★, planning du personnel.

## Développement local

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Les migrations SQL sont dans `supabase/migrations` (à appliquer dans l'ordre). `select seed_demo();` régénère la démo.
