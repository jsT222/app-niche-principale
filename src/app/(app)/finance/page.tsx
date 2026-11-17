import { ModuleSoon } from "@/components/module-soon";
export const metadata = { title: "Finance" };
export default function Page() {
  return <ModuleSoon title="Finance" module="finance" description="Factures, paiements, relances et exports comptables automatiques."
    features={["Facture générée à chaque check-out (TVA 10 % hébergement, taxe de séjour)", "Suivi des paiements Stripe, OTA et sur place", "Relances automatiques des impayés à J+3, J+10, J+20", "Export comptable CSV et FEC, déclaration de la taxe de séjour"]} />;
}
