import { ModuleSoon } from "@/components/module-soon";
export const metadata = { title: "Revenue & prix" };
export default function Page() {
  return <ModuleSoon title="Revenue & prix" module="revenue" description="Prix dynamiques selon l'occupation, la saison, les événements locaux et la concurrence."
    features={["Calendrier tarifaire 365 jours par type de chambre (prix appliqué vs prix suggéré)", "Règles : séjour minimum, fermeture à la vente, promos dernière minute", "Veille des tarifs concurrents et des événements locaux", "Simulation de l'impact d'une règle avant activation"]} />;
}
