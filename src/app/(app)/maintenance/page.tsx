import { getContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { TicketList, type Ticket } from "@/components/ops/ticket-list";

export const metadata = { title: "Maintenance" };
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const ctx = await getContext();
  const supabase = await createClient();
  const [{ data: tickets }, { data: plans }] = await Promise.all([
    supabase.from("maintenance_tickets").select("id, title, description, priority, status, reported_by, preventive, created_at, rooms(number), hotels(name)")
      .in("hotel_id", ctx.selected).neq("status", "resolved").order("created_at", { ascending: false }),
    supabase.from("preventive_plans").select("id, title, frequency_days, next_due, scope, hotels(name)").in("hotel_id", ctx.selected).order("next_due").limit(8),
  ]);
  return (
    <>
      <PageHeader title="Maintenance" description="Tickets créés depuis le mobile (photo), priorisés automatiquement, et maintenance préventive planifiée." />
      <TicketList tickets={(tickets ?? []) as unknown as Ticket[]} plans={(plans ?? []) as unknown as Plan[]} showHotel={ctx.selected.length > 1} />
    </>
  );
}
type Plan = { id: string; title: string; frequency_days: number; next_due: string; scope: string; hotels: { name: string } };
