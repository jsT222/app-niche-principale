import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/constants";

export type Hotel = { id: string; name: string; city: string; slug: string; stars: number | null };

export type AppContext = {
  userId: string;
  email: string;
  fullName: string;
  hotels: (Hotel & { role: Role })[];
  /** hôtels sélectionnés (1 ou tous) */
  selected: string[];
  selection: string; // id ou "all"
  role: Role; // rôle le plus élevé sur la sélection
};

const RANK: Record<Role, number> = { owner: 4, reception: 3, housekeeping: 2, maintenance: 1 };

export const getContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_hotel_roles").select("role, hotels(id, name, city, slug, stars)").eq("user_id", user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  const hotels = (roles ?? [])
    .map((r) => ({ ...(r.hotels as unknown as Hotel), role: r.role as Role }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cookieStore = await cookies();
  const pref = cookieStore.get("hotel")?.value;
  let selection = pref && (pref === "all" || hotels.some((h) => h.id === pref)) ? pref : hotels.length > 1 ? "all" : hotels[0]?.id;
  if (selection === "all" && hotels.length < 2) selection = hotels[0]?.id;
  const selected = selection === "all" ? hotels.map((h) => h.id) : [selection!];
  const role = hotels
    .filter((h) => selected.includes(h.id))
    .reduce<Role>((best, h) => (RANK[h.role] > RANK[best] ? h.role : best), "maintenance");

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.email ?? "",
    hotels,
    selected,
    selection: selection ?? "",
    role,
  };
});

export function canAccess(role: Role, section: string) {
  const map: Record<Role, string[]> = {
    owner: ["*"],
    reception: ["dashboard", "reservations", "planning", "messagerie", "clients", "housekeeping", "maintenance", "stock", "avis", "automatisations"],
    housekeeping: ["housekeeping", "maintenance", "stock"],
    maintenance: ["maintenance"],
  };
  return map[role].includes("*") || map[role].includes(section);
}
