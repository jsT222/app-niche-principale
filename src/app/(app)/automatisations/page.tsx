import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext, canAccess } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AutomationsBoard, type Auto, type Run } from "@/components/automations/board";
import { cn } from "@/lib/utils";

export const metadata = { title: "Automatisations" };
export const dynamic = "force-dynamic";

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getContext();
  if (!canAccess(ctx.role, "automatisations")) redirect("/");
  const sp = await searchParams;
  const hotelId = sp.hotel && ctx.selected.includes(sp.hotel) ? sp.hotel : ctx.selected[0];
  const supabase = await createClient();
  const since = new Date(Date.now() - 86400000).toISOString();

  const [{ data: autos }, { data: runs }, { count: runs24 }, { count: errors24 }] = await Promise.all([
    supabase.from("automations").select("*").eq("hotel_id", hotelId).order("module").order("name"),
    supabase
      .from("automation_runs")
      .select("id, automation_id, status, started_at, duration_ms, summary, reservation_id")
      .eq("hotel_id", hotelId)
      .lte("started_at", new Date().toISOString())
      .order("started_at", { ascending: false })
      .limit(300),
    supabase.from("automation_runs").select("id", { count: "exact", head: true }).eq("hotel_id", hotelId).gte("started_at", since),
    supabase.from("automation_runs").select("id", { count: "exact", head: true }).eq("hotel_id", hotelId).gte("started_at", since).eq("status", "error"),
  ]);

  const list = (autos ?? []) as Auto[];
  return (
    <>
      <PageHeader
        title="Automatisations"
        description="Chaque automatisation a son interrupteur et son journal d'exécution. Les workflows tournent sur n8n et dans la base (tâches planifiées)."
      />
      {ctx.selected.length > 1 && (
        <div className="mb-4 inline-flex rounded-lg border bg-card p-1">
          {ctx.hotels.filter((h) => ctx.selected.includes(h.id)).map((h) => (
            <Link key={h.id} href={`/automatisations?hotel=${h.id}`}
              className={cn("rounded-md px-3 py-1.5 text-sm", h.id === hotelId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
              {h.name}
            </Link>
          ))}
        </div>
      )}
      <AutomationsBoard
        key={hotelId}
        automations={list}
        runs={(runs ?? []) as Run[]}
        stats={{ active: list.filter((a) => a.enabled).length, total: list.length, runs24: runs24 ?? 0, errors24: errors24 ?? 0 }}
        canToggle={ctx.hotels.find((h) => h.id === hotelId)?.role === "owner"}
        canRun={["owner", "reception"].includes(ctx.hotels.find((h) => h.id === hotelId)?.role ?? "")}
      />
    </>
  );
}
