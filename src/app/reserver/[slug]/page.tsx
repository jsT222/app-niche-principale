import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingEngine } from "./booking-engine";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_hotel", { p_slug: slug });
  return { title: data ? `Réserver — ${(data as { name: string }).name}` : "Réserver" };
}

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_hotel", { p_slug: slug });
  if (!data) notFound();
  return <BookingEngine slug={slug} hotel={data as Hotel} />;
}

export type Hotel = { name: string; city: string; address: string; stars: number; deposit_percent: number; check_in_time: string; check_out_time: string; phone: string; email: string };
