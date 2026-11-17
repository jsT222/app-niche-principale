"use client";
import { useActionState, useState } from "react";
import { ArrowRight, BedDouble, ConciergeBell, Crown, Loader2, Wrench } from "lucide-react";
import { signIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ACCOUNTS, ROLE_LABEL, type Role } from "@/lib/constants";

const ICONS: Record<Role, React.ElementType> = { owner: Crown, reception: ConciergeBell, housekeeping: BedDouble, maintenance: Wrench };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  const [clicked, setClicked] = useState<string | null>(null);

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-1.5">
        <h2 className="font-serif text-3xl tracking-tight">Bienvenue</h2>
        <p className="text-sm text-muted-foreground">Choisissez un profil de démonstration pour explorer l&apos;application.</p>
      </div>

      <div className="grid gap-2">
        {DEMO_ACCOUNTS.map((a) => {
          const Icon = ICONS[a.role];
          return (
            <form key={a.email} action={action} onSubmit={() => setClicked(a.email)}>
              <input type="hidden" name="email" value={a.email} />
              <button
                type="submit"
                disabled={pending}
                className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition hover:border-primary/40 hover:shadow-sm disabled:opacity-60"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">
                    {ROLE_LABEL[a.role]} <span className="font-normal text-muted-foreground">· {a.name}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">{a.desc}</span>
                </span>
                {pending && clicked === a.email ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                )}
              </button>
            </form>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        ou avec votre compte
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={action} onSubmit={() => setClicked("form")} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && clicked === "form" && <Loader2 className="animate-spin" />}
          Se connecter
        </Button>
      </form>
    </div>
  );
}
