import { ModuleSoon } from "@/components/module-soon";
export const metadata = { title: "Avis" };
export default function Page() {
  return <ModuleSoon title="Avis & réputation" module="reviews" description="Avis Google, Booking et TripAdvisor centralisés, réponses IA."
    features={["Flux unifié des avis avec note, source et langue", "Réponse IA proposée ou publiée automatiquement selon la note", "Alerte immédiate pour tout avis ≤ 3★", "Analyse des thèmes récurrents (propreté, bruit, petit-déjeuner…)"]} />;
}
