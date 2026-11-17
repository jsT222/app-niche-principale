import { ModuleSoon } from "@/components/module-soon";
export const metadata = { title: "Appels & messages" };
export default function Page() {
  return <ModuleSoon title="Appels & messagerie" module="messaging" description="Agent vocal IA 24/7 et boîte de réception unifiée (email, WhatsApp, messages OTA)."
    features={["Liste des appels avec transcription, résumé et lien vers la fiche client", "Boîte de réception unifiée : email, WhatsApp, Booking, Expedia, Airbnb", "Réponse IA proposée, ou envoyée automatiquement selon des règles par type de question", "Transfert vers un humain avec résumé de la conversation", "Réglages de l'agent vocal : voix, langues, horaires, tarifs communicables"]} />;
}
