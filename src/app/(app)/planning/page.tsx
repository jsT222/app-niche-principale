import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getContext, canAccess } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PlanningBoard, type PRes, type PRoom } from "@/components/planning/board";
import { addDays, cn, todayParis } from "@/lib/utils";

export const metadata = { title: "Planning" };
export const dynamic = "force-dynamic";

const DAYS = 21;

export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getContext();
  if (!canAccess(ctx.role, "planning")) redirect("/");
  const sp = await searchParams;
  const today = todayParis();
  const start = sp.du && /^\d{4}-\d{2}-\d{2}$/.test(sp.du) ? sp.du : addDays(today, -2);
  const end = addDays(start, DAYS);
  const hotelId = sp.hotel && ctx.selected.includes(sp.hotel) ? sp.hotel : ctx.selected[0];

  const supabase = await createClient();
  const [{ data: rooms }, { data: res }] = await Promise.all([
    supabase.from("rooms").select("id, number, floor, hk_status, out_of_order_reason, room_types(code, name)").eq("hotel_id", hotelId).order("number"),
    supabase
      .from("reservations")
      .select("id, code, room_id, check_in, check_out, status, channel, adults, children, total_amount, guests(first_name, last_name, segments)")
      .eq("hotel_id", hotelId)
      .lt("check_in", end)
      .gt("check_out", start)
      .in("status", ["pending", "confirmed", "checked_in", "checked_out"])
      .limit(2000),
  ]);

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ du: start, hotel: hotelId, ...patch });
    return `/planning?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Planning des chambres"
        description="Glissez une réservation pour changer de chambre ou décaler le séjour : le PMS et les OTA sont mis à jour automatiquement."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" asChild><Link href={link({ du: addDays(start, -7) })} aria-label="Semaine précédente"><ChevronLeft /></Link></Button>
            <Button variant="outline" asChild><Link href={link({ du: addDays(today, -2) })}>Aujourd&apos;hui</Link></Button>
            <Button variant="outline" size="icon" asChild><Link href={link({ du: addDays(start, 7) })} aria-label="Semaine suivante"><ChevronRight /></Link></Button>
          </div>
        }
      />
      {ctx.selected.length > 1 && (
        <div className="mb-4 inline-flex rounded-lg border bg-card p-1">
          {ctx.hotels.filter((h) => ctx.selected.includes(h.id)).map((h) => (
            <Link key={h.id} href={link({ hotel: h.id })}
              className={cn("rounded-md px-3 py-1.5 text-sm", h.id === hotelId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
              {h.name}
            </Link>
          ))}
        </div>
      )}
      <PlanningBoard
        key={`${hotelId}-${start}`}
        rooms={(rooms ?? []) as unknown as PRoom[]}
        reservations={(res ?? []) as unknown as PRes[]}
        start={start}
        days={DAYS}
        today={today}
        canEdit={["owner", "reception"].includes(ctx.role)}
      />
    </>
  );
}
