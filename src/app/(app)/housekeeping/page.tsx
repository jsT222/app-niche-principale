import { getContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { RoomBoard, type HkRoom } from "@/components/ops/room-board";
import { todayParis } from "@/lib/utils";

export const metadata = { title: "Housekeeping" };
export const dynamic = "force-dynamic";

export default async function HousekeepingPage() {
  const ctx = await getContext();
  const supabase = await createClient();
  const today = todayParis();
  const [{ data: rooms }, { data: res }] = await Promise.all([
    supabase.from("rooms").select("id, hotel_id, number, floor, hk_status, hk_updated_at, out_of_order_reason, room_types(code, name), hotels(name)").in("hotel_id", ctx.selected).order("hotel_id").order("number"),
    supabase.from("reservations").select("room_id, check_in, check_out, status").in("hotel_id", ctx.selected)
      .lte("check_in", today).gte("check_out", today).in("status", ["confirmed", "checked_in", "checked_out", "pending"]),
  ]);
  const flags = new Map<string, { arrival: boolean; departure: boolean; occupied: boolean }>();
  (res ?? []).forEach((r) => {
    if (!r.room_id) return;
    const f = flags.get(r.room_id) ?? { arrival: false, departure: false, occupied: false };
    if (r.check_in === today && r.status !== "checked_out") f.arrival = true;
    if (r.check_out === today) f.departure = true;
    if (r.status === "checked_in" && r.check_out > today) f.occupied = true;
    flags.set(r.room_id, f);
  });
  const list = ((rooms ?? []) as unknown as HkRoom[]).map((r) => ({ ...r, ...(flags.get(r.id) ?? { arrival: false, departure: false, occupied: false }) }));

  return (
    <>
      <PageHeader title="Housekeeping" description="Statut des chambres en temps réel. Touchez une chambre pour faire avancer son statut — la réception est notifiée instantanément." />
      <RoomBoard rooms={list} showHotel={ctx.selected.length > 1} />
    </>
  );
}
