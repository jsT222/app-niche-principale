import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, variation } from "@/lib/utils";

export function Delta({ cur, prev, invert = false, unit = "%" }: { cur: number | null; prev: number | null; invert?: boolean; unit?: "%" | "pt" }) {
  let v: number | null;
  if (unit === "pt") v = cur == null || prev == null ? null : Number(cur) - Number(prev);
  else v = variation(cur, prev);
  if (v == null) return <span className="text-xs text-muted-foreground">N-1 —</span>;
  const good = invert ? v < 0 : v > 0;
  const flat = Math.abs(v) < 0.5;
  const Icon = flat ? Minus : v > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular",
        flat ? "bg-muted text-muted-foreground" : good ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="size-3" />
      {v > 0 ? "+" : ""}
      {v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
      {unit === "pt" ? " pt" : " %"}
    </span>
  );
}

export function KpiCard({
  label, value, sub, cur, prev, unit, invert, icon: Icon, accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  cur?: number | null;
  prev?: number | null;
  unit?: "%" | "pt";
  invert?: boolean;
  icon?: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4", accent && "border-primary/25 bg-primary/[0.03]")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground/70" />}
      </div>
      <div className="font-serif text-[1.7rem] leading-none tracking-tight tabular">{value}</div>
      <div className="flex min-h-5 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {cur !== undefined && <Delta cur={cur ?? null} prev={prev ?? null} unit={unit} invert={invert} />}
        {sub}
      </div>
    </div>
  );
}
