import { ModuleSoon } from "@/components/module-soon";
export const metadata = { title: "Équipe" };
export default function Page() {
  return <ModuleSoon title="Équipe" module="team" description="Planning du personnel calé sur les prévisions d'occupation."
    features={["Planning hebdomadaire généré selon les arrivées, départs et recouches prévus", "Tâches et notifications par rôle (réception, ménage, maintenance)", "Gestion des comptes et des droits par établissement"]} />;
}
