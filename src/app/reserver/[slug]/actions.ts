"use server";
import { createClient } from "@/lib/supabase/server";

export type Avail = { room_type_id: string; code: string; name: string; capacity: number; available: number; total: number; nightly: number };

export async function searchAvailability(slug: string, checkIn: string, checkOut: string, guests: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_availability", { p_slug: slug, p_in: checkIn, p_out: checkOut, p_guests: guests });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rooms: (data ?? []) as Avail[] };
}

export async function book(input: {
  slug: string; roomTypeId: string; checkIn: string; checkOut: string; adults: number; children: number;
  firstName: string; lastName: string; email: string; phone: string; language: string; requests: string;
}) {
  const supabase = await createClient();
  // Mode démo : l'acompte est considéré comme payé (Stripe Checkout en production)
  const { data, error } = await supabase.rpc("public_book", {
    p_slug: input.slug, p_type: input.roomTypeId, p_in: input.checkIn, p_out: input.checkOut,
    p_adults: input.adults, p_children: input.children, p_first: input.firstName, p_last: input.lastName,
    p_email: input.email, p_phone: input.phone, p_lang: input.language, p_requests: input.requests, p_deposit_paid: true,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, booking: data as { code: string; total: number; deposit: number; room: string | null } };
}
