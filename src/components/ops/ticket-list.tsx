"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Check, Play } from "lucide-react";
import { setTicketStatus } from "@/app/(app)/housekeeping/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, relTime } from "@/lib/utils";

export type Ticket = {
  id: string; title: string; description: string | null; priority: string; status: string; reported_by: string | null; preventive: boolean;
  created_at: string; rooms: { number: string } | null; hotels: { name: string };
};
type Plan = { id: string; title: string; frequency_days: number; next_due: string; scope: string; hotels: { name: string } };

const PRIO: Record<string, { label: string; tone: "danger" | "warning" | "info" | "muted" }> = {
  urgent: { label: "Urgent", tone: "danger" }, high: { label: "Haute", tone: "warning" }, medium: { label: "Moyenne", tone: "info" }, low: { label: "Basse", tone: "muted" },
};
const STATUS: Record<string, string> = { open: "Ouvert", in_progress: "En cours", waiting_parts: "Attente pièce", resolved: "Résolu" };
const RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function TicketList({ tickets, plans, showHotel }: { tickets: Ticket[]; plans: Plan[]; showHotel: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState([...tickets].sort((a, b) => RANK[a.priority] - RANK[b.priority]));
  const [, start] = useTransition();
  const update = (t: Ticket, status: string) => {
    const prev = items;
    setItems((cur) => (status === "resolved" ? cur.filter((x) => x.id !== t.id) : cur.map((x) => (x.id === t.id ? { ...x, status } : x))));
    start(async () => {
      const res = await setTicketStatus(t.id, status);
      if (!res.ok) { setItems(prev); return void toast.error(res.error); }
      toast.success(status === "resolved" ? `Ticket résolu : ${t.title}` : "Ticket pris en charge");
      router.refresh();
    });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
            <span className="w-12 rounded-md bg-muted py-1 text-center text-sm font-medium tabular">{t.rooms?.number ?? "—"}</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">{t.title}<Badge tone={PRIO[t.priority].tone}>{PRIO[t.priority].label}</Badge>{t.preventive && <Badge tone="outline">Préventif</Badge>}</p>
              <p className="text-xs text-muted-foreground">{STATUS[t.status]} · signalé par {t.reported_by} · {relTime(t.created_at)}{showHotel ? ` · ${t.hotels.name}` : ""}</p>
              {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
            </div>
            <div className="flex gap-2">
              {t.status === "open" && <Button size="sm" variant="outline" onClick={() => update(t, "in_progress")}><Play /> Prendre</Button>}
              <Button size="sm" onClick={() => update(t, "resolved")}><Check /> Résolu</Button>
            </div>
          </li>
        ))}
        {!items.length && <li className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Aucun ticket ouvert.</li>}
      </ul>
      <aside className="h-fit rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4 text-primary" /> Maintenance préventive</h3>
        <ul className="mt-3 divide-y text-sm">
          {plans.map((p) => (
            <li key={p.id} className="py-2.5">
              <p className="font-medium">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.scope} · tous les {p.frequency_days} j · prochain le {fmtDate(p.next_due, { day: "numeric", month: "long" })}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
