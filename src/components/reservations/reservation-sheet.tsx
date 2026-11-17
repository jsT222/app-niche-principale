"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Bot, CalendarClock, LogIn, LogOut, Mail, Phone, UserX } from "lucide-react";
import { Dialog, DialogDescription, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/constants";
import { cn, fmtDate, fmtDateTime, fmtEur, todayParis } from "@/lib/utils";
import { setReservationStatus } from "@/app/(app)/reservations/actions";
import { SegmentBadges, type ResRow } from "./reservations-table";

type Run = { id: string; status: string; started_at: string; summary: string; automations: { name: string } | null };

export function ReservationSheet({ reservation: r, onClose, canEdit }: { reservation: ResRow | null; onClose: () => void; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    if (!r) return;
    setRuns([]);
    const supabase = createClient();
    supabase
      .from("automation_runs")
      .select("id, status, started_at, summary, automations(name)")
      .eq("reservation_id", r.id)
      .order("started_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setRuns((data ?? []) as unknown as Run[]));
  }, [r]);

  if (!r) return null;
  const total = Number(r.total_amount) + Number(r.extras_amount);
  const today = todayParis();
  const g = r.guests;

  const act = (status: string, label: string) =>
    start(async () => {
      const res = await setReservationStatus(r.id, status);
      if (!res.ok) return void toast.error(res.error);
      toast.success(label, { description: "Les automatisations associées ont été déclenchées." });
      onClose();
      router.refresh();
    });

  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="max-w-lg">
        <div className="space-y-1 pr-6">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
            <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
          </div>
          <DialogTitle className="font-serif text-2xl font-normal">{g ? `${g.first_name} ${g.last_name}` : "Client"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5">
            <SegmentBadges segments={g?.segments ?? []} />
            {g && <span>{g.stays_count} séjour{g.stays_count > 1 ? "s" : ""} · {fmtEur(g.total_spent)} dépensés</span>}
          </DialogDescription>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {["confirmed", "pending"].includes(r.status) && r.check_in <= today && (
              <Button size="sm" disabled={pending} onClick={() => act("checked_in", "Check-in effectué")}><LogIn /> Check-in</Button>
            )}
            {r.status === "checked_in" && (
              <Button size="sm" disabled={pending} onClick={() => act("checked_out", "Check-out effectué — facture envoyée")}><LogOut /> Check-out</Button>
            )}
            {r.status === "waitlist" && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act("confirmed", "Réservation confirmée")}><CalendarClock /> Confirmer</Button>
            )}
            {["confirmed", "pending"].includes(r.status) && r.check_in <= today && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act("no_show", "Marquée no-show")}><UserX /> No-show</Button>
            )}
            {["confirmed", "pending", "waitlist"].includes(r.status) && (
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending}
                onClick={() => confirm("Annuler cette réservation ?") && act("cancelled", "Réservation annulée — chambre libérée")}>
                <Ban /> Annuler
              </Button>
            )}
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-4 text-sm">
          <Item label="Arrivée">{fmtDate(r.check_in, { weekday: "short", day: "numeric", month: "long" })}</Item>
          <Item label="Départ">{fmtDate(r.check_out, { weekday: "short", day: "numeric", month: "long" })}</Item>
          <Item label="Chambre">{r.rooms ? `${r.rooms.number} · ${r.room_types?.name}` : `Non attribuée · ${r.room_types?.name}`}</Item>
          <Item label="Occupants">{r.adults} adulte{r.adults > 1 ? "s" : ""}{r.children ? `, ${r.children} enfant${r.children > 1 ? "s" : ""}` : ""}</Item>
          <Item label="Canal">{CHANNEL_LABEL[r.channel]}{r.external_ref && <span className="block font-mono text-xs text-muted-foreground">{r.external_ref}</span>}</Item>
          <Item label="Réservé le">{fmtDateTime(r.created_at)}</Item>
        </dl>

        <div className="rounded-lg border p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Hébergement ({r.nights} nuit{r.nights > 1 ? "s" : ""})</span><span className="tabular">{fmtEur(r.total_amount, true)}</span></div>
          {Number(r.extras_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Extras (petit-déjeuner…)</span><span className="tabular">{fmtEur(r.extras_amount, true)}</span></div>}
          {Number(r.deposit_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Acompte demandé</span><span className="tabular">{fmtEur(r.deposit_amount, true)}</span></div>}
          <div className="mt-2 flex justify-between border-t pt-2 font-medium"><span>Total</span><span className="tabular">{fmtEur(total, true)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Déjà payé</span><span className="tabular">{fmtEur(r.paid_amount, true)}</span></div>
        </div>

        {g && (
          <div className="space-y-1.5 text-sm">
            {g.email && <p className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" />{g.email}</p>}
            {g.phone && <p className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{g.phone} · {g.language.toUpperCase()}</p>}
            {r.special_requests && <p className="rounded-md bg-muted p-2 text-xs">Demande : {r.special_requests}</p>}
            {g.notes && <p className="rounded-md bg-gold/15 p-2 text-xs">Note client : {g.notes}</p>}
          </div>
        )}

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-primary" /> Automatisations exécutées</h4>
          <ol className="space-y-2 border-l pl-4">
            {runs.map((x) => (
              <li key={x.id} className="relative text-sm">
                <span className={cn("absolute -left-[21px] top-1.5 size-2 rounded-full ring-4 ring-card", x.status === "error" ? "bg-destructive" : x.status === "skipped" ? "bg-muted-foreground/40" : "bg-success")} />
                <span className="block text-xs text-muted-foreground">{x.automations?.name} · {fmtDateTime(x.started_at)}</span>
                {x.summary}
              </li>
            ))}
            {!runs.length && <li className="text-sm text-muted-foreground">Aucune exécution récente pour cette réservation.</li>}
          </ol>
        </div>
      </SheetContent>
    </Dialog>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
