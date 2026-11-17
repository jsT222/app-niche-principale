"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Wrench } from "lucide-react";
import { moveReservation } from "@/app/(app)/reservations/actions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CHANNEL_LABEL, HK_LABEL, STATUS_LABEL } from "@/lib/constants";
import { addDays, cn, fmtEur } from "@/lib/utils";

export type PRoom = { id: string; number: string; floor: number; hk_status: string; out_of_order_reason: string | null; room_types: { code: string; name: string } };
export type PRes = {
  id: string; code: string; room_id: string; check_in: string; check_out: string; status: string; channel: string;
  adults: number; children: number; total_amount: number;
  guests: { first_name: string; last_name: string; segments: string[] } | null;
};

const COL = 56; // largeur d'une nuit (px)
const ROW = 40;
const LEFT = 132;

const CH_STYLE: Record<string, string> = {
  direct: "bg-primary text-primary-foreground",
  phone: "bg-primary/85 text-primary-foreground",
  walk_in: "bg-primary/70 text-primary-foreground",
  booking: "bg-[color-mix(in_oklch,var(--info)_80%,var(--card))] text-white",
  expedia: "bg-[color-mix(in_oklch,var(--gold)_85%,var(--foreground))] text-white",
  airbnb: "bg-[color-mix(in_oklch,var(--destructive)_75%,var(--card))] text-white",
};

const HK_DOT: Record<string, string> = {
  dirty: "bg-destructive", in_progress: "bg-warning", clean: "bg-info", inspected: "bg-success", out_of_order: "bg-muted-foreground",
};

function diffDays(a: string, b: string) {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}

export function PlanningBoard({ rooms, reservations, start, days, today, canEdit }: {
  rooms: PRoom[]; reservations: PRes[]; start: string; days: number; today: string; canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(reservations);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, start_] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days]);
  const byRoom = useMemo(() => {
    const m = new Map<string, PRes[]>();
    items.forEach((r) => m.set(r.room_id, [...(m.get(r.room_id) ?? []), r]));
    return m;
  }, [items]);

  const occupancy = dates.map((d) => items.filter((r) => r.check_in <= d && r.check_out > d).length);

  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (!e.over) return;
    const res = items.find((r) => r.id === e.active.id);
    if (!res) return;
    const [roomId, day] = String(e.over.id).split("|");
    const room = rooms.find((x) => x.id === roomId);
    if (!room || room.hk_status === "out_of_order") return void toast.error("Chambre hors service");
    // Le jour de dépôt correspond à la position du début de la barre
    const grabOffset = Math.round((e.delta.x || 0) / COL);
    const newIn = addDays(res.check_in, grabOffset);
    const nights = diffDays(res.check_in, res.check_out);
    const newOut = addDays(newIn, nights);
    void day;
    if (roomId === res.room_id && newIn === res.check_in) return;
    if (res.status === "checked_in" && newIn !== res.check_in) return void toast.error("Client déjà arrivé : seul un changement de chambre est possible");
    if (res.status === "checked_out") return void toast.error("Séjour terminé");
    const clash = items.some((o) => o.id !== res.id && o.room_id === roomId && o.check_in < newOut && o.check_out > newIn);
    if (clash) return void toast.error(`Chambre ${room.number} déjà occupée sur ces dates`);

    const prev = items;
    setItems((cur) => cur.map((r) => (r.id === res.id ? { ...r, room_id: roomId, check_in: newIn, check_out: newOut } : r)));
    start_(async () => {
      const out = await moveReservation(res.id, roomId, newIn, newOut);
      if (!out.ok) {
        setItems(prev);
        toast.error(out.error);
      } else {
        toast.success(`${res.code} déplacée en chambre ${room.number}`, { description: "PMS et channel manager synchronisés." });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      <Legend />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div style={{ width: LEFT + COL * days }} className="relative select-none">
            {/* En-tête des dates */}
            <div className="sticky top-0 z-20 flex border-b bg-card">
              <div style={{ width: LEFT }} className="sticky left-0 z-30 flex shrink-0 items-end border-r bg-card px-3 pb-1.5 text-xs font-medium text-muted-foreground">
                Chambre
              </div>
              {dates.map((d, i) => {
                const dt = new Date(d + "T12:00:00");
                const we = [0, 6].includes(dt.getDay());
                return (
                  <div key={d} style={{ width: COL }} className={cn("shrink-0 border-r px-1 py-1.5 text-center", we && "bg-muted/50", d === today && "bg-gold/15")}>
                    <div className="text-[10px] uppercase text-muted-foreground">{dt.toLocaleDateString("fr-FR", { weekday: "short" })}</div>
                    <div className={cn("text-sm font-medium tabular", d === today && "text-primary")}>{dt.getDate()}</div>
                    <div className="text-[10px] tabular text-muted-foreground">{Math.round((100 * occupancy[i]) / rooms.length)} %</div>
                  </div>
                );
              })}
            </div>

            {rooms.map((room) => (
              <div key={room.id} className="relative flex border-b last:border-0" style={{ height: ROW }}>
                <div style={{ width: LEFT }} className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-card px-3">
                  <span className={cn("size-2 rounded-full", HK_DOT[room.hk_status])} title={HK_LABEL[room.hk_status]} />
                  <span className="text-sm font-medium tabular">{room.number}</span>
                  <span className="truncate text-xs text-muted-foreground">{room.room_types.code}</span>
                </div>
                {dates.map((d) => (
                  <Cell key={d} id={`${room.id}|${d}`} weekend={[0, 6].includes(new Date(d + "T12:00:00").getDay())} today={d === today} ooo={room.hk_status === "out_of_order"} />
                ))}
                {room.hk_status === "out_of_order" && (
                  <div className="pointer-events-none absolute inset-y-1 flex items-center gap-1.5 px-2 text-xs text-muted-foreground" style={{ left: LEFT + 4 }}>
                    <Wrench className="size-3.5" /> Hors service — {room.out_of_order_reason}
                  </div>
                )}
                {(byRoom.get(room.id) ?? []).map((r) => (
                  <Bar key={r.id} r={r} start={start} days={days} canEdit={canEdit} dimmed={dragging !== null && dragging !== r.id} />
                ))}
              </div>
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}

function Cell({ id, weekend, today, ooo }: { id: string; weekend: boolean; today: boolean; ooo: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: ooo });
  return (
    <div
      ref={setNodeRef}
      style={{ width: COL }}
      className={cn(
        "shrink-0 border-r",
        weekend && "bg-muted/40",
        today && "bg-gold/10",
        ooo && "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--muted)_6px_8px)]",
        isOver && "bg-primary/15"
      )}
    />
  );
}

function Bar({ r, start, days, canEdit, dimmed }: { r: PRes; start: string; days: number; canEdit: boolean; dimmed: boolean }) {
  const movable = canEdit && ["pending", "confirmed", "checked_in"].includes(r.status);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: r.id, disabled: !movable });
  const from = Math.max(0, diffDays(start, r.check_in));
  const to = Math.min(days, diffDays(start, r.check_out));
  if (to <= 0 || from >= days) return null;
  const clippedLeft = diffDays(start, r.check_in) < 0;
  const name = r.guests ? `${r.guests.first_name[0]}. ${r.guests.last_name}` : r.code;
  const vip = r.guests?.segments?.includes("vip");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          style={{
            left: LEFT + from * COL + (clippedLeft ? 0 : COL / 2),
            width: (to - from) * COL - (clippedLeft ? COL / 2 : 0) - 3,
            transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
            zIndex: isDragging ? 40 : 5,
          }}
          className={cn(
            "absolute inset-y-1.5 flex items-center gap-1 overflow-hidden rounded-md px-2 text-xs font-medium shadow-sm transition-opacity",
            CH_STYLE[r.channel],
            r.status === "pending" && "opacity-80 ring-2 ring-warning ring-inset",
            r.status === "checked_out" && "opacity-45",
            movable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
            isDragging && "shadow-lg ring-2 ring-foreground/30",
            dimmed && "opacity-60"
          )}
        >
          {vip && <span className="text-[10px]">★</span>}
          <span className="truncate">{name}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="font-medium">{r.guests ? `${r.guests.first_name} ${r.guests.last_name}` : ""} · {r.code}</p>
        <p className="opacity-80">
          {STATUS_LABEL[r.status]} · {CHANNEL_LABEL[r.channel]} · {fmtEur(r.total_amount)} · {r.adults + r.children} pers.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["Direct / téléphone", CH_STYLE.direct], ["Booking.com", CH_STYLE.booking], ["Expedia", CH_STYLE.expedia], ["Airbnb", CH_STYLE.airbnb],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map(([l, c]) => (
        <span key={l} className="flex items-center gap-1.5"><span className={cn("h-3 w-5 rounded-sm", c)} />{l}</span>
      ))}
      <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-muted ring-2 ring-inset ring-warning" />Acompte en attente</span>
      <span className="mx-1 h-4 w-px bg-border" />
      {Object.entries(HK_DOT).map(([k, c]) => (
        <span key={k} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", c)} />{HK_LABEL[k]}</span>
      ))}
    </div>
  );
}
