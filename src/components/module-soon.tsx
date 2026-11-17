import Link from "next/link";
import { ArrowRight, Construction, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/context";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { relTime } from "@/lib/utils";

export async function ModuleSoon({ title, description, module, features, children }: {
  title: string; description: string; module: string; features: string[]; children?: React.ReactNode;
}) {
  const ctx = await getContext();
  const supabase = await createClient();
  const { data: autos } = await supabase
    .from("automations")
    .select("id, name, trigger_label, enabled, last_run_at, runs_count")
    .eq("hotel_id", ctx.selected[0])
    .eq("module", module)
    .order("name");

  return (
    <>
      <PageHeader title={title} description={description} />
      {children}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-dashed bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><Construction className="size-4 text-gold" /> Écran en cours de construction</p>
          <p className="mt-1 text-sm text-muted-foreground">Les données et automatisations de ce module existent déjà en base ; l&apos;interface complète arrive dans la prochaine itération.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {features.map((f) => <li key={f} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{f}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><Zap className="size-4 text-primary" /> Automatisations déjà actives</p>
            {["owner", "reception"].includes(ctx.role) && <Link href="/automatisations" className="flex items-center gap-1 text-xs text-primary hover:underline">Gérer <ArrowRight className="size-3" /></Link>}
          </div>
          <ul className="mt-3 divide-y">
            {(autos ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{a.name}</span>
                  <span className="block text-xs text-muted-foreground">{a.trigger_label} · {a.runs_count} exécutions{a.last_run_at ? ` · dernière ${relTime(a.last_run_at)}` : ""}</span>
                </span>
                <Badge tone={a.enabled ? "success" : "muted"}>{a.enabled ? "Active" : "En pause"}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
