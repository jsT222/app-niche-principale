import { ModuleSoon } from "@/components/module-soon";
export const metadata = { title: "Stock & achats" };
export default function Page() {
  return <ModuleSoon title="Stock & achats" module="stock" description="Inventaire décrémenté automatiquement selon l'occupation et les départs."
    features={["Inventaire par catégorie : linge, produits d'accueil, minibar, petit-déjeuner, entretien", "Décrément automatique selon les nuitées et les check-outs", "Seuils d'alerte + bon de commande généré et envoyé au fournisseur", "Coût par chambre occupée (CPOR) et évolution mensuelle"]} />;
}
