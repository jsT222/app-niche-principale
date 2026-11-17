"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut, User, Wrench } from "lucide-react";
import { setRoomStatus } from "@/app/(app)/housekeeping/actions";
import { HK_LABEL } from "@/lib/constants";
import { cn, relTime } from "@/lib/utils";

export type HkRoom = {
  id: string; hotel_id: string; number: string; floor: number; hk_status: string; hk_updated_at: string; out_of_order_reason: string | null;
  room_types: { code: string; name: string }; hotels: { name: string };
  arrival?: boolean; departure?: boolean; occupied?: boolean;
};

const NEXT: Record<string, string> = { dirty: "in_progress", in_progress: "clean", clean: "inspected", inspected: "dirty" };
const STYLE: Record<string, string> = {
  dirty: "border-destructive/40 bg-destructive/8",
  in_progress: "border-warning/60 bg-warning/12",
  clean: "border-info/40 bg-info/8",
  inspected: "border-success/40 bg-success/10",
  out_of_order: "border-dashed bg-muted",
};
const DOT: Record<string, string> = { dirty: "bg-destructive", in_progress: "bg-warning", clean: "bg-info", inspected: "bg-success", out_of_order: "bg-muted-foreground" };

export function RoomBoard({ rooms, showHotel }: { rooms: HkRoom[]; showHotel: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(rooms);
  const [filter, setFilter] = useState<string>("");
  const [, start] = useTransition();
  const counts = items.reduce<Record<string, number>>((m, r) => ({ ...m, [r.hk_status]: (m[r.hk_status] ?? 0) + 1 }), {});

  const advance = (r: HkRoom) => {
    if (r.hk_status === "out_of_order") return;
    const next = NEXT[r.hk_status];
    setItems((cur) => cur.map((x) => (x.id === r.id ? { ...x, hk_status: next, hk_updated_at: new Date().toISOString() } : x)));
    start(async () => {
      const res = await setRoomStatus(r.id, next);
      if (!res.ok) {
        setItems((cur) => cur.map((x) => (x.id === r.id ? r : x)));
        return void toast.error(res.error);
      }
      toast.success(`Chambre ${r.number} : ${HK_LABEL[next]}`);
      router.refresh();
    });
  };

  const hotels = [...new Set(items.map((r) => r.hotels.name))];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("")} className={cn("rounded-full border px-3 py-1 text-sm", !filter && "bg-foreground text-background")}>Toutes · {items.length}</button>
        {Object.keys(HK_LABEL).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", filter === k && "bg-foreground text-background")}>
            <span className={cn("size-2 rounded-full", DOT[k])} /> {HK_LABEL[k]} · {counts[k] ?? 0}
          </button>
        ))}
      </div>
      {hotels.map((h) => (
        <section key={h}>
          {showHotel && <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{h}</h2>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {items.filter((r) => r.hotels.name === h && (!filter || r.hk_status === filter)).map((r) => (
              <button key={r.id} onClick={() => advance(r)} disabled={r.hk_status === "out_of_order"}
                className={cn("flex min-h-24 flex-col rounded-xl border p-3 text-left transition active:scale-[0.98]", STYLE[r.hk_status])}>
                <span className="flex items-center justify-between">
                  <span className="font-serif text-xl tabular">{r.number}</span>
                  <span className="text-[11px] text-muted-foreground">{r.room_types.code}</span>
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs font-medium"><span className={cn("size-2 rounded-full", DOT[r.hk_status])} />{HK_LABEL[r.hk_status]}</span>
                <span className="mt-auto flex items-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
                  {r.hk_status === "out_of_order" ? <><Wrench className="size-3" /> {r.out_of_order_reason?.split("—")[0]}</> : (
                    <>
                      {r.departure && <span className="flex items-center gap-0.5" title="Départ"><LogOut className="size-3" />Départ</span>}
                      {r.arrival && <span className="flex items-center gap-0.5 text-primary" title="Arrivée"><LogIn className="size-3" />Arrivée</span>}
                      {r.occupied && !r.departure && <span className="flex items-center gap-0.5" title="Recouche"><User className="size-3" />Recouche</span>}
                      {!r.arrival && !r.departure && !r.occupied && <span>{relTime(r.hk_updated_at)}</span>}
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
