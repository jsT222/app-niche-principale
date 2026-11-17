"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setRoomStatus(roomId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").update({ hk_status: status, hk_updated_at: new Date().toISOString() }).eq("id", roomId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setTicketStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_tickets")
    .update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
