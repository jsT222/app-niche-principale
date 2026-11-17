import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div className="relative flex items-center gap-2">
          <Logo compact />
          <span className="font-serif text-xl">Hôtelis</span>
        </div>
        <div className="relative max-w-lg space-y-6">
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight">
            Votre hôtel tourne.
            <br />
            <span className="text-gold">Même quand vous dormez.</span>
          </h1>
          <p className="text-base/7 opacity-80">
            Réservations, appels, messages, ménage, stocks, prix, factures et avis : tout est centralisé et automatisé.
            Votre équipe se concentre sur l&apos;accueil, plus sur la saisie.
          </p>
          <dl className="grid grid-cols-3 gap-6 border-t border-white/15 pt-6 text-sm">
            <div>
              <dt className="opacity-70">Automatisations</dt>
              <dd className="font-serif text-3xl">28</dd>
            </div>
            <div>
              <dt className="opacity-70">Appels traités par l&apos;IA</dt>
              <dd className="font-serif text-3xl">82 %</dd>
            </div>
            <div>
              <dt className="opacity-70">Saisie manuelle</dt>
              <dd className="font-serif text-3xl">≈ 0</dd>
            </div>
          </dl>
        </div>
        <p className="relative text-xs opacity-60">Démo — données fictives, réinitialisées chaque nuit.</p>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
