import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Cette page n&apos;existe pas</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Le lien est peut-être incomplet ou a changé. Revenez au tableau de bord ou ouvrez le moteur de réservation.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild><Link href="/">Tableau de bord</Link></Button>
        <Button variant="outline" asChild><Link href="/reserver">Moteur de réservation</Link></Button>
        <Button variant="ghost" asChild><a href="/auth/signout">Changer de profil</a></Button>
      </div>
    </div>
  );
}
