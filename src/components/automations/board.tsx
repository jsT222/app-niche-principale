"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, AlertTriangle, ArrowRight, CircleCheck, CirclePause, History, Loader2, Play, Zap } from "lucide-react";
import { toggleAutomation, runAutomation } from "@/app/(app)/automatisations/actions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { Dialog, DialogDescription, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MODULE_LABEL } from "@/lib/constants";
import { cn, fmtDateTime, relTime } from "@/lib/utils";

export type Auto = {
  id: string; key: string; module: string; name: string; description: string | null; trigger_label: string; actions: string[];
  enabled: boolean; n8n_workflow_id: string | null; last_run_at: string | null; runs_count: number; errors_count: number;
};
export type Run = { id: string; automation_id: string; status: string; started_at: string; duration_ms: number | null; summary: string; reservation_id: string | null };

const MANUAL = new Set(["reminder_j3", "arrival_instructions_j1", "no_show_handling", "channel_sync", "stock_decrement", "hk_assignment", "payment_reminders", "dynamic_pricing", "reviews_fetch", "accounting_export", "staff_planning", "preventive_maintenance"]);
const MODULE_ORDER = ["reservations", "messaging", "crm", "stock", "housekeeping", "revenue", "finance", "reviews", "team"];

export function StatusDot({ status }: { status: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", status === "error" ? "bg-destructive" : status === "skipped" ? "bg-muted-foreground/40" : status === "running" ? "bg-warning" : "bg-success")} />;
}

const STATUS_FR: Record<string, string> = { success: "Succès", error: "Erreur", skipped: "Ignorée", running: "En cours" };

export function AutomationsBoard({ automations, runs, stats, canToggle, canRun }: {
  automations: Auto[]; runs: Run[]; stats: { active: number; total: number; runs24: number; errors24: number }; canToggle: boolean; canRun: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(automations);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const [fModule, setFModule] = useState("");
  const [fStatus, setFStatus] = useState("");
  const byId = useMemo(() => new Map(items.map((a) => [a.id, a])), [items]);
  const grouped = MODULE_ORDER.map((m) => ({ module: m, list: items.filter((a) => a.module === m) })).filter((g) => g.list.length);
  const open = openId ? byId.get(openId) : null;
  const filteredRuns = runs.filter((r) => (!fModule || byId.get(r.automation_id)?.module === fModule) && (!fStatus || r.status === fStatus));

  const toggle = (a: Auto, v: boolean) => {
    setItems((cur) => cur.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)));
    start(async () => {
      const res = await toggleAutomation(a.id, v);
      if (!res.ok) {
        setItems((cur) => cur.map((x) => (x.id === a.id ? { ...x, enabled: !v } : x)));
        return void toast.error(res.error);
      }
      toast.success(`${a.name} ${v ? "activée" : "désactivée"}`);
    });
  };
  const run = (a: Auto) => {
    setBusy(a.id);
    start(async () => {
      const res = await runAutomation(a.id);
      setBusy(null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${a.name} exécutée`, { description: "Résultat ajouté au journal." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Zap} label="Automatisations actives" value={`${stats.active} / ${stats.total}`} />
        <Stat icon={Activity} label="Exécutions (24 h)" value={stats.runs24} />
        <Stat icon={stats.errors24 ? AlertTriangle : CircleCheck} label="Erreurs (24 h)" value={stats.errors24} tone={stats.errors24 ? "danger" : "success"} />
        <Stat icon={History} label="Temps de saisie économisé" value={`≈ ${Math.round((stats.runs24 * 3) / 60)} h / jour`} />
      </div>

      {grouped.map((g) => (
        <section key={g.module}>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{MODULE_LABEL[g.module]}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.list.map((a) => (
              <article key={a.id} className={cn("flex flex-col rounded-xl border bg-card p-4 transition", !a.enabled && "opacity-70")}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{a.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <Switch checked={a.enabled} disabled={!canToggle} onCheckedChange={(v) => toggle(a, v)} aria-label={`Activer ${a.name}`} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone="outline"><Zap /> {a.trigger_label}</Badge>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  {a.actions.slice(0, 3).map((x) => <Badge key={x} tone="muted">{x}</Badge>)}
                  {a.actions.length > 3 && <Badge tone="muted">+{a.actions.length - 3}</Badge>}
                </div>
                <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted-foreground">
                  {a.enabled ? <CircleCheck className="size-3.5 text-success" /> : <CirclePause className="size-3.5" />}
                  <span>{a.last_run_at ? `Dernière exécution ${relTime(a.last_run_at)}` : "Jamais exécutée"}</span>
                  {a.errors_count > 0 && <Badge tone="danger">{a.errors_count} erreur{a.errors_count > 1 ? "s" : ""}</Badge>}
                  <div className="ml-auto flex gap-1">
                    {canRun && MANUAL.has(a.key) && (
                      <Button size="sm" variant="ghost" onClick={() => run(a)} disabled={busy === a.id} title="Exécuter maintenant">
                        {busy === a.id ? <Loader2 className="animate-spin" /> : <Play />}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setOpenId(a.id)}>Journal</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Journal d&apos;exécution</h2>
            <p className="text-sm text-muted-foreground">Les 300 dernières exécutions, toutes automatisations confondues.</p>
          </div>
          <div className="flex gap-2">
            <NativeSelect value={fModule} onChange={(e) => setFModule(e.target.value)} className="w-auto">
              <option value="">Tous les modules</option>
              {MODULE_ORDER.map((m) => <option key={m} value={m}>{MODULE_LABEL[m]}</option>)}
            </NativeSelect>
            <NativeSelect value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-auto">
              <option value="">Tous statuts</option>
              <option value="success">Succès</option><option value="error">Erreur</option><option value="skipped">Ignorée</option>
            </NativeSelect>
          </div>
        </div>
        <div className="rounded-xl border bg-card">
          <Table>
            <THead>
              <TR className="hover:bg-transparent"><TH>Date</TH><TH>Automatisation</TH><TH>Résultat</TH><TH className="hidden text-right md:table-cell">Durée</TH></TR>
            </THead>
            <TBody>
              {filteredRuns.slice(0, 120).map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.started_at)}</TD>
                  <TD className="whitespace-nowrap">
                    <span className="flex items-center gap-2"><StatusDot status={r.status} />{byId.get(r.automation_id)?.name}</span>
                  </TD>
                  <TD className={cn(r.status === "error" && "text-destructive")}>{r.summary}</TD>
                  <TD className="hidden text-right text-xs tabular text-muted-foreground md:table-cell">{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)} s` : "—"}</TD>
                </TR>
              ))}
              {!filteredRuns.length && <TR><TD colSpan={4} className="py-10 text-center text-muted-foreground">Aucune exécution.</TD></TR>}
            </TBody>
          </Table>
        </div>
      </section>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && (
          <SheetContent className="max-w-xl">
            <div className="pr-6">
              <p className="text-xs text-muted-foreground">{MODULE_LABEL[open.module]}</p>
              <DialogTitle className="font-serif text-2xl font-normal">{open.name}</DialogTitle>
              <DialogDescription>{open.description}</DialogDescription>
            </div>
            <div className="rounded-lg border p-4 text-sm">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Déclencheur → actions</p>
              <ol className="space-y-1.5">
                <li className="flex items-center gap-2"><Zap className="size-4 text-gold" /> {open.trigger_label}</li>
                {open.actions.map((x, i) => (
                  <li key={x} className="flex items-center gap-2 pl-1"><span className="flex size-4 items-center justify-center rounded-full bg-muted text-[10px]">{i + 1}</span>{x}</li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Workflow n8n : {open.n8n_workflow_id ? <span className="font-mono">{open.n8n_workflow_id}</span> : "exécuté dans la base (mode démo)"}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">{open.enabled ? "Activée" : "Désactivée"}</p>
                <p className="text-xs text-muted-foreground">{open.runs_count} exécutions · {open.errors_count} erreurs</p>
              </div>
              <Switch checked={byId.get(open.id)?.enabled} disabled={!canToggle} onCheckedChange={(v) => toggle(open, v)} />
            </div>
            <ol className="space-y-3 border-l pl-4">
              {runs.filter((r) => r.automation_id === open.id).slice(0, 50).map((r) => (
                <li key={r.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5"><StatusDot status={r.status} /></span>
                  <span className="block text-xs text-muted-foreground">{fmtDateTime(r.started_at)} · {STATUS_FR[r.status]}{r.duration_ms ? ` · ${(r.duration_ms / 1000).toFixed(1)} s` : ""}</span>
                  {r.summary}
                </li>
              ))}
            </ol>
          </SheetContent>
        )}
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: React.ReactNode; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <Icon className={cn("size-4", tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-muted-foreground/70")} />
      </div>
      <p className="mt-2 font-serif text-2xl tabular">{value}</p>
    </div>
  );
}
