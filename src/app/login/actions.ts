"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_PASSWORD } from "@/lib/constants";

export async function signIn(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "") || DEMO_PASSWORD;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Identifiants invalides." };
  redirect("/");
}
