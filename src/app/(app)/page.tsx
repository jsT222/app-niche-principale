import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle, ArrowRight, BedDouble, Bot, CircleCheck, CircleX, LogIn, LogOut, Package, PhoneCall, Star, Wrench,
} from "lucide-react";
import { getContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { KpiCard, Delta } from "@/components/dashboard/kpi-card";
import { TrendCard } from "@/components/dashboard/chart-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/constants";
import { cn, fmtEur, fmtPct, relTime, todayParis } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Kpis = Record<string, number> & {
  series: { date: string; occupancy: number; occupancy_ly: number; revenue: number; revenue_ly: number }[];
  channel_mix: { channel: string; count: number; revenue: number }[];
  by_hotel: { hotel_id: string; name: string; rooms: number; occupancy: number; revenue_day: number }[] | null;
};

export default async function DashboardPage() {
  const ctx = await getContext();
  if (ctx.role === "housekeeping") redirect("/housekeeping");
  if (ctx.role === "maintenance") redirect("/maintenance");

  const supabase = await createClient();
  const today = todayParis();
  const [{ data: kpiData }, { data: runs }, { data: arrivals }] = await Promise.all([
    supabase.rpc("dashboard_kpis", { p_hotels: ctx.selected, p_date: today }),
    supabase
      .from("automation_runs")
      .select("id, status, started_at, summary, automations(name, module)")
      .in("hotel_id", ctx.selected)
      .lte("started_at", new Date().toISOString())
      .order("started_at", { ascending: false })
      .limit(8),
    supabase
      .from("reservations")
      .select("id, code, status, channel, adults, children, nights, guests(first_name, last_name, segments), rooms(number, hk_status), room_types(name)")
      .in("hotel_id", ctx.selected)
      .eq("check_in", today)
      .in("status", ["confirmed", "checked_in", "pending"])
      .order("status")
      .limit(7),
  ]);
  const k = (kpiData ?? {}) as Kpis;
  const multi = ctx.selected.length > 1;
  const aiShare = k.calls_month ? Math.round((100 * k.calls_ai_month) / k.calls_month) : 0;
  const totalMix = (k.channel_mix ?? []).reduce((s, c) => s + c.count, 0) || 1;
  const hour = Number(new Date().toLocaleString("fr-FR", { hour: "2-digit", hour12: false, timeZone: "Europe/Paris" }));
  const hello = hour < 18 ? "Bonjour" : "Bonsoir";
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

  return (
    <>
      <PageHeader
        title={`${hello}, ${ctx.fullName.split(" ")[0]}`}
        description={
          <>
            <span className="capitalize">{dateLabel}</span> · {multi ? `${ctx.selected.length} établissements, ${k.rooms} chambres` : `${k.rooms} chambres`} · comparaison avec N-1
          </>
        }
      />

      {/* KPIs principaux */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Taux d'occupation" value={fmtPct(k.occupancy)} cur={k.occupancy} prev={k.occupancy_ly} unit="pt" accent
          sub={<span>N-1 {fmtPct(k.occupancy_ly)}</span>} />
        <KpiCard label="Prix moyen (ADR)" value={fmtEur(k.adr)} cur={k.adr} prev={k.adr_ly} sub={<span>N-1 {fmtEur(k.adr_ly)}</span>} />
        <KpiCard label="RevPAR" value={fmtEur(k.revpar)} cur={k.revpar} prev={k.revpar_ly} sub={<span>N-1 {fmtEur(k.revpar_ly)}</span>} />
        <KpiCard label="CA du jour" value={fmtEur(k.revenue_day)} cur={k.revenue_day} prev={k.revenue_day_ly} sub={<span>hébergement</span>} />
        <KpiCard label="CA du mois" value={fmtEur(k.revenue_month)} cur={k.revenue_month} prev={k.revenue_month_ly}
          sub={<span>occ. {fmtPct(k.occupancy_month, 0)}</span>} />
        <KpiCard label="Réservations directes" value={fmtPct(k.direct_share, 0)} cur={k.direct_share} prev={k.direct_share_ly} unit="pt"
          sub={<span>vs OTA, ce mois</span>} />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <OpsTile href="/reservations?vue=arrivees" icon={LogIn} label="Arrivées du jour" value={k.arrivals} detail={`${k.arrivals_done} déjà enregistrées`} progress={k.arrivals ? (100 * k.arrivals_done) / k.arrivals : 0} />
        <OpsTile href="/reservations?vue=departs" icon={LogOut} label="Départs du jour" value={k.departures} detail={`${k.departures_done} check-outs faits`} progress={k.departures ? (100 * k.departures_done) / k.departures : 0} />
        <OpsTile href="/housekeeping" icon={BedDouble} label="Chambres prêtes" value={`${k.rooms_ready}/${k.rooms}`} detail={`${k.rooms_dirty} à nettoyer · ${k.rooms_ooo} HS`} progress={(100 * k.rooms_ready) / (k.rooms || 1)} />
        <OpsTile href="/messagerie" icon={PhoneCall} label="Appels traités par l'IA" value={k.calls_ai_today} detail={`${aiShare} % ce mois · ${k.calls_bookings_month} réservations`} progress={aiShare} />
        <OpsTile href="/stock" icon={Package} label="Alertes stock" value={k.stock_alerts} detail="commandes auto envoyées" tone={k.stock_alerts ? "warning" : undefined} />
        <OpsTile href="/maintenance" icon={Wrench} label="Tickets ouverts" value={k.tickets_open} detail={`${k.tickets_urgent} prioritaires`} tone={k.tickets_urgent ? "danger" : undefined} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_340px]">
        <TrendCard series={k.series ?? []} today={today} />
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold">Note moyenne des avis</h3>
                <p className="text-xs text-muted-foreground">90 derniers jours · {k.reviews_count} avis</p>
              </div>
              <Star className="size-4 fill-gold text-gold" />
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className="font-serif text-4xl leading-none tabular">{k.rating ? Number(k.rating).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) : "—"}</span>
              <span className="pb-1 text-sm text-muted-foreground">/ 5</span>
              <span className="ml-auto pb-1"><Delta cur={k.rating} prev={k.rating_ly} /></span>
            </div>
            {k.low_reviews_pending > 0 && (
              <Link href="/avis" className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="size-3.5" /> {k.low_reviews_pending} avis ≤ 3★ en attente de réponse
                <ArrowRight className="ml-auto size-3.5" />
              </Link>
            )}
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold">Réservations du mois par canal</h3>
            <p className="mb-3 text-xs text-muted-foreground">Le direct inclut téléphone et sans réservation (sans commission)</p>
            <ul className="space-y-2.5">
              {(k.channel_mix ?? []).map((c) => {
                const direct = ["direct", "phone", "walk_in"].includes(c.channel);
                return (
                  <li key={c.channel} className="text-xs">
                    <div className="mb-1 flex justify-between">
                      <span>{CHANNEL_LABEL[c.channel]}</span>
                      <span className="tabular text-muted-foreground">
                        {c.count} · {Math.round((100 * c.count) / totalMix)} %
                      </span>
                    </div>
                    <Progress value={(100 * c.count) / totalMix} color={direct ? "var(--chart-1)" : "var(--chart-6)"} />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="text-sm font-semibold">Arrivées du jour</h3>
            <Link href="/reservations?vue=arrivees" className="text-xs text-primary hover:underline">Tout voir</Link>
          </div>
          <ul className="mt-3 divide-y">
            {(arrivals ?? []).map((r) => {
              const g = r.guests as unknown as { first_name: string; last_name: string; segments: string[] } | null;
              const room = r.rooms as unknown as { number: string; hk_status: string } | null;
              const ready = room && ["clean", "inspected"].includes(room.hk_status);
              return (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="w-10 rounded-md bg-muted py-1 text-center text-xs font-medium tabular">{room?.number ?? "—"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate font-medium">
                      {g ? `${g.first_name} ${g.last_name}` : "Client"}
                      {g?.segments?.includes("vip") && <Badge tone="gold">VIP</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {(r.room_types as unknown as { name: string })?.name} · {r.nights} nuit{r.nights > 1 ? "s" : ""} · {CHANNEL_LABEL[r.channel]}
                    </span>
                  </span>
                  <span className={cn("hidden items-center gap-1 text-xs sm:flex", ready ? "text-success" : "text-muted-foreground")}>
                    {ready ? <CircleCheck className="size-3.5" /> : <CircleX className="size-3.5" />} {ready ? "Prête" : "Pas prête"}
                  </span>
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </li>
              );
            })}
            {!arrivals?.length && <li className="px-5 py-6 text-sm text-muted-foreground">Aucune arrivée aujourd&apos;hui.</li>}
          </ul>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-primary" /> Ce que l&apos;automatisation a fait pour vous</h3>
            <Link href="/automatisations" className="text-xs text-primary hover:underline">Journal complet</Link>
          </div>
          <ul className="mt-3 divide-y">
            {(runs ?? []).map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", r.status === "error" ? "bg-destructive" : r.status === "skipped" ? "bg-muted-foreground/40" : "bg-success")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-muted-foreground">{(r.automations as unknown as { name: string })?.name}</span>
                  <span className="line-clamp-2">{r.summary}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{relTime(r.started_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {multi && k.by_hotel && (
        <section className="mt-6 rounded-xl border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Par établissement — aujourd&apos;hui</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {k.by_hotel.map((h) => (
              <div key={h.hotel_id} className="rounded-lg border p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{h.name}</span>
                  <span className="text-muted-foreground">{h.rooms} ch.</span>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="font-serif text-2xl tabular">{fmtPct(h.occupancy, 0)}</span>
                  <span className="text-sm tabular text-muted-foreground">{fmtEur(h.revenue_day)} / jour</span>
                </div>
                <Progress className="mt-2" value={h.occupancy} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function OpsTile({
  href, icon: Icon, label, value, detail, progress, tone,
}: { href: string; icon: React.ElementType; label: string; value: React.ReactNode; detail: string; progress?: number; tone?: "warning" | "danger" }) {
  return (
    <Link href={href} className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition hover:border-primary/30 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-muted-foreground/70")} />
      </div>
      <span className="font-serif text-[1.7rem] leading-none tabular">{value}</span>
      {progress !== undefined && <Progress value={progress} />}
      <span className="text-xs text-muted-foreground">{detail}</span>
    </Link>
  );
}
