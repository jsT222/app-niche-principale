"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const TRANSITIONS: Record<string, string[]> = {
  checked_in: ["confirmed", "pending"],
  checked_out: ["checked_in"],
  cancelled: ["confirmed", "pending", "waitlist"],
  no_show: ["confirmed", "pending"],
  confirmed: ["pending", "waitlist"],
};

export async function setReservationStatus(id: string, status: string): Promise<Result> {
  const supabase = await createClient();
  const { data: r } = await supabase.from("reservations").select("status, total_amount, extras_amount").eq("id", id).single();
  if (!r) return { ok: false, error: "Réservation introuvable" };
  if (!TRANSITIONS[status]?.includes(r.status)) return { ok: false, error: "Changement de statut impossible" };

  const patch: Record<string, unknown> = { status };
  const now = new Date().toISOString();
  if (status === "checked_in") patch.checked_in_at = now;
  if (status === "checked_out") {
    patch.checked_out_at = now;
    patch.paid_amount = Number(r.total_amount) + Number(r.extras_amount);
  }
  if (status === "cancelled") {
    patch.cancelled_at = now;
    patch.room_id = null;
  }
  const { error } = await supabase.from("reservations").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moveReservation(id: string, roomId: string | null, checkIn: string, checkOut: string): Promise<Result> {
  const supabase = await createClient();
  let roomTypeId: string | undefined;
  if (roomId) {
    const { data: room } = await supabase.from("rooms").select("room_type_id, hk_status").eq("id", roomId).single();
    if (!room) return { ok: false, error: "Chambre introuvable" };
    if (room.hk_status === "out_of_order") return { ok: false, error: "Cette chambre est hors service" };
    roomTypeId = room.room_type_id;
  }
  const { error } = await supabase
    .from("reservations")
    .update({ room_id: roomId, check_in: checkIn, check_out: checkOut, ...(roomTypeId ? { room_type_id: roomTypeId } : {}) })
    .eq("id", id);
  if (error) {
    if (error.message.includes("no_overlap")) return { ok: false, error: "Chambre déjà occupée sur ces dates" };
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createReservation(input: {
  hotelId: string; roomTypeId: string; checkIn: string; checkOut: string; adults: number; children: number;
  firstName: string; lastName: string; email: string; phone: string; language: string;
  channel: string; status: string; requests: string;
}): Promise<Result & { code?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_create_booking", {
    p_hotel: input.hotelId, p_type: input.roomTypeId, p_in: input.checkIn, p_out: input.checkOut,
    p_adults: input.adults, p_children: input.children, p_first: input.firstName, p_last: input.lastName,
    p_email: input.email, p_phone: input.phone, p_lang: input.language, p_channel: input.channel,
    p_status: input.status, p_requests: input.requests,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  const res = data as { code: string; room: string | null };
  return { ok: true, code: res.code, message: res.room ? `Chambre ${res.room} attribuée automatiquement` : "En liste d'attente" };
}
