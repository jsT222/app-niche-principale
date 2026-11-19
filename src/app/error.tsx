"use client";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-serif text-3xl">Un souci temporaire est survenu</h1>
      <p className="max-w-md text-sm text-muted-foreground">La page n&apos;a pas pu se charger. Réessayez : si le problème persiste, reconnectez-vous.</p>
      <div className="flex gap-2">
        <Button onClick={reset}><RefreshCw /> Réessayer</Button>
        <Button variant="outline" asChild><a href="/auth/signout">Se reconnecter</a></Button>
      </div>
    </div>
  );
}
