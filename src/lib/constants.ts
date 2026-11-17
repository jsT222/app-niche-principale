export type Role = "owner" | "reception" | "housekeeping" | "maintenance";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Propriétaire",
  reception: "Réception",
  housekeeping: "Ménage",
  maintenance: "Maintenance",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "En attente d'acompte",
  confirmed: "Confirmée",
  checked_in: "En séjour",
  checked_out: "Partie",
  cancelled: "Annulée",
  no_show: "No-show",
  waitlist: "Liste d'attente",
};

export const STATUS_TONE: Record<string, "default" | "success" | "info" | "warning" | "danger" | "muted"> = {
  pending: "warning",
  confirmed: "info",
  checked_in: "success",
  checked_out: "muted",
  cancelled: "danger",
  no_show: "danger",
  waitlist: "warning",
};

export const CHANNEL_LABEL: Record<string, string> = {
  direct: "Site direct",
  booking: "Booking.com",
  expedia: "Expedia",
  airbnb: "Airbnb",
  phone: "Téléphone",
  walk_in: "Sans réservation",
};

export const CHANNEL_COLOR: Record<string, string> = {
  direct: "var(--chart-1)",
  phone: "var(--chart-5)",
  walk_in: "var(--chart-6)",
  booking: "var(--chart-3)",
  expedia: "var(--chart-2)",
  airbnb: "var(--chart-4)",
};

export const HK_LABEL: Record<string, string> = {
  dirty: "Sale",
  in_progress: "En cours",
  clean: "Propre",
  inspected: "Inspectée",
  out_of_order: "Hors service",
};

export const MODULE_LABEL: Record<string, string> = {
  reservations: "Réservations",
  messaging: "Appels & messagerie",
  crm: "Clients (CRM)",
  stock: "Stock & achats",
  housekeeping: "Housekeeping & maintenance",
  revenue: "Revenue & prix",
  finance: "Finance",
  reviews: "Avis & réputation",
  team: "Équipe",
};

export const DEMO_ACCOUNTS: { role: Role; email: string; name: string; desc: string }[] = [
  { role: "owner", email: "proprietaire@demo-hotelis.fr", name: "Claire Morel", desc: "Vue groupe : 2 hôtels, tous les modules" },
  { role: "reception", email: "reception@demo-hotelis.fr", name: "Sarah Benali", desc: "Réservations, clients, messagerie" },
  { role: "housekeeping", email: "menage@demo-hotelis.fr", name: "Maria Da Silva", desc: "Statut des chambres, tâches du jour" },
  { role: "maintenance", email: "maintenance@demo-hotelis.fr", name: "Karim Mansouri", desc: "Tickets et maintenance préventive" },
];
export const DEMO_PASSWORD = "Demo-Hotelis-2026";
