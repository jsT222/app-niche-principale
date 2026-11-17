import { ModuleSoon } from "@/components/module-soon";
export const metadata = { title: "Clients" };
export default function Page() {
  return <ModuleSoon title="Clients (CRM)" module="crm" description="Fiches clients créées automatiquement à chaque réservation, segmentées et suivies."
    features={["Fiche client : historique des séjours, préférences, dépenses, notes, appels et messages", "Segments automatiques : VIP, affaires, famille, habitué", "Séquences pré-séjour (upsell), pendant le séjour (satisfaction), post-séjour (avis + offre de retour)", "Check-in / check-out en ligne avec pièce d'identité et signature électronique"]} />;
}
