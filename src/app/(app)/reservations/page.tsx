import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { getContext, canAccess } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReservationsTable, type ResRow } from "@/components/reservations/reservations-table";
import { NewReservationButton } from "@/components/reservations/new-reservation";
import { CHANNEL_LABEL, STATUS_LABEL } from "@/lib/constants";
import { addDays, cn, todayParis } from "@/lib/utils";

export const metadata = { title: "Réservations" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "arrivees", label: "Arrivées du jour" },
  { key: "departs", label: "Départs du jour" },
  { key: "en-sejour", label: "En séjour" },
  { key: "a-venir", label: "À venir" },
  { key: "attente", label: "Liste d'attente" },
  { key: "toutes", label: "Toutes" },
];

const PAGE = 50;

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getContext();
  if (!canAccess(ctx.role, "reservations")) redirect("/");
  const sp = await searchParams;
  const vue = sp.vue ?? "arrivees";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1));
  const today = todayParis();

  const supabase = await createClient();
  let query = supabase
    .from("reservations")
    .select(
      "id, hotel_id, code, check_in, check_out, nights, adults, children, status, channel, external_ref, total_amount, extras_amount, deposit_amount, paid_amount, special_requests, created_at, guests!inner(id, first_name, last_name, email, phone, language, segments, stays_count, total_spent, notes), rooms(id, number, hk_status), room_types(id, name, code), hotels(name)",
      { count: "exact" }
    )
    .in("hotel_id", ctx.selected);

  switch (vue) {
    case "arrivees": query = query.eq("check_in", today).in("status", ["confirmed", "pending", "checked_in"]); break;
    case "departs": query = query.eq("check_out", today).in("status", ["checked_in", "checked_out"]); break;
    case "en-sejour": query = query.eq("status", "checked_in"); break;
    case "a-venir": query = query.gt("check_in", today).lte("check_in", addDays(today, 60)).in("status", ["confirmed", "pending"]); break;
    case "attente": query = query.eq("status", "waitlist"); break;
  }
  if (sp.statut) query = query.eq("status", sp.statut);
  if (sp.canal) query = query.eq("channel", sp.canal);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = /^[A-Z]{3}-\d+$/i.test(q)
      ? query.ilike("code", safe)
      : query.or(`last_name.ilike.%${safe}%,first_name.ilike.%${safe}%,email.ilike.%${safe}%`, { referencedTable: "guests" });
  }
  const order = vue === "toutes" ? { col: "check_in", asc: false } : vue === "departs" ? { col: "check_out", asc: true } : { col: "check_in", asc: true };
  const { data, count } = await query
    .order(order.col, { ascending: order.asc })
    .order("code")
    .range((page - 1) * PAGE, page * PAGE - 1);

  const { data: roomTypes } = await supabase.from("room_types").select("id, hotel_id, name, base_price, capacity").in("hotel_id", ctx.selected).order("sort");

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { vue, q: q || undefined, statut: sp.statut, canal: sp.canal, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `/reservations?${p.toString()}`;
  };
  const pages = Math.ceil((count ?? 0) / PAGE);

  return (
    <>
      <PageHeader
        title="Réservations"
        description="Synchronisées en continu avec le PMS et le channel manager (Booking, Expedia, Airbnb, site direct)."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/reserver/les-tilleuls" target="_blank">Moteur de réservation</Link>
            </Button>
            {canAccess(ctx.role, "reservations") && ctx.role !== "housekeeping" && (
              <NewReservationButton hotels={ctx.hotels.filter((h) => ctx.selected.includes(h.id))} roomTypes={roomTypes ?? []} />
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={qs({ vue: v.key, page: undefined })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition",
              vue === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap gap-2" action="/reservations">
        <input type="hidden" name="vue" value={vue} />
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Nom, email ou n° de réservation (TIL-00123)" className="pl-8" />
        </div>
        <NativeSelect name="statut" defaultValue={sp.statut ?? ""} className="w-auto">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </NativeSelect>
        <NativeSelect name="canal" defaultValue={sp.canal ?? ""} className="w-auto">
          <option value="">Tous canaux</option>
          {Object.entries(CHANNEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </NativeSelect>
        <Button type="submit" variant="secondary">Filtrer</Button>
      </form>

      <ReservationsTable rows={(data ?? []) as unknown as ResRow[]} showHotel={ctx.selected.length > 1} canEdit={["owner", "reception"].includes(ctx.role)} />

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{count ?? 0} réservation{(count ?? 0) > 1 ? "s" : ""}</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            {page > 1 && <Button variant="outline" size="sm" asChild><Link href={qs({ page: String(page - 1) })}>Précédent</Link></Button>}
            <span>Page {page} / {pages}</span>
            {page < pages && <Button variant="outline" size="sm" asChild><Link href={qs({ page: String(page + 1) })}>Suivant</Link></Button>}
          </div>
        )}
      </div>
    </>
  );
}
