"use client";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDate, fmtEur } from "@/lib/utils";

type Point = { date: string; occupancy: number; occupancy_ly: number; revenue: number; revenue_ly: number };

function Tip({ active, payload, metric }: { active?: boolean; payload?: { payload: Point }[]; metric: "occupancy" | "revenue" }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const f = (v: number) => (metric === "occupancy" ? `${v.toLocaleString("fr-FR")} %` : fmtEur(v));
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{fmtDate(p.date, { weekday: "short", day: "numeric", month: "long" })}</p>
      <p className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded bg-chart-1" /> Cette année <span className="ml-auto pl-3 font-medium tabular">{f(p[metric])}</span>
      </p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span className="h-0.5 w-3 rounded border-t-2 border-dashed border-muted-foreground/60" /> N-1
        <span className="ml-auto pl-3 tabular">{f(p[`${metric}_ly` as const])}</span>
      </p>
    </div>
  );
}

export function OccupancyChart({ data, today, metric }: { data: Point[]; today: string; metric: "occupancy" | "revenue" }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(d) => fmtDate(d, { day: "numeric", month: "short" })}
            interval={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            domain={metric === "occupancy" ? [0, 100] : [0, "auto"]}
            tickFormatter={(v) => (metric === "occupancy" ? `${v} %` : `${Math.round(v / 1000)} k€`)}
            width={48}
          />
          <Tooltip content={<Tip metric={metric} />} cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }} />
          <ReferenceLine x={today} stroke="var(--gold)" strokeWidth={1.5} label={{ value: "Aujourd'hui", position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }} />
          <Line type="monotone" dataKey={`${metric}_ly`} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Area type="monotone" dataKey={metric} stroke="var(--chart-1)" strokeWidth={2} fill="url(#occ)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
