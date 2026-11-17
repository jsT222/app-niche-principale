import {
  BarChart3, BedDouble, CalendarRange, ClipboardList, Coins, LayoutDashboard, MessagesSquare, Package,
  Star, Users, Workflow, Wrench, UsersRound, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; section: string; soon?: boolean };

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Pilotage",
    items: [
      { href: "/", label: "Tableau de bord", icon: LayoutDashboard, section: "dashboard" },
      { href: "/automatisations", label: "Automatisations", icon: Workflow, section: "automatisations" },
    ],
  },
  {
    group: "Exploitation",
    items: [
      { href: "/reservations", label: "Réservations", icon: ClipboardList, section: "reservations" },
      { href: "/planning", label: "Planning", icon: CalendarRange, section: "planning" },
      { href: "/messagerie", label: "Appels & messages", icon: MessagesSquare, section: "messagerie", soon: true },
      { href: "/clients", label: "Clients", icon: Users, section: "clients", soon: true },
      { href: "/housekeeping", label: "Housekeeping", icon: BedDouble, section: "housekeeping", soon: true },
      { href: "/maintenance", label: "Maintenance", icon: Wrench, section: "maintenance", soon: true },
      { href: "/stock", label: "Stock & achats", icon: Package, section: "stock", soon: true },
    ],
  },
  {
    group: "Gestion",
    items: [
      { href: "/revenue", label: "Revenue & prix", icon: BarChart3, section: "revenue", soon: true },
      { href: "/finance", label: "Finance", icon: Coins, section: "finance", soon: true },
      { href: "/avis", label: "Avis", icon: Star, section: "avis", soon: true },
      { href: "/equipe", label: "Équipe", icon: UsersRound, section: "equipe", soon: true },
    ],
  },
];
