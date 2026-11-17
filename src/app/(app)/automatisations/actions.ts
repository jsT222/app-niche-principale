"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleAutomation(id: string, enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_automation_enabled", { p_automation: id, p_enabled: enabled });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/automatisations");
  return { ok: true as const };
}

export async function runAutomation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("run_automation_now", { p_automation: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
