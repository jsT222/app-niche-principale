"use client";
import { useState } from "react";
import { OccupancyChart } from "./occupancy-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TrendCard({ series, today }: { series: Parameters<typeof OccupancyChart>[0]["data"]; today: string }) {
  const [metric, setMetric] = useState<"occupancy" | "revenue">("occupancy");
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{metric === "occupancy" ? "Taux d'occupation" : "CA hébergement"} — 30 derniers jours et 14 prochains</h3>
          <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-chart-1" /> Cette année (réservations en portefeuille au-delà d&apos;aujourd&apos;hui)</span>
            <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-muted-foreground/60" /> N-1</span>
          </div>
        </div>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as "occupancy" | "revenue")}>
          <TabsList>
            <TabsTrigger value="occupancy">Occupation</TabsTrigger>
            <TabsTrigger value="revenue">Chiffre d&apos;affaires</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <OccupancyChart data={series} today={today} metric={metric} />
    </div>
  );
}
