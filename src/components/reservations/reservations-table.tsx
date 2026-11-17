"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/constants";
import { fmtDate, fmtEur } from "@/lib/utils";
import { ReservationSheet } from "./reservation-sheet";

export type ResRow = {
  id: string; hotel_id: string; code: string; check_in: string; check_out: string; nights: number; adults: number; children: number;
  status: string; channel: string; external_ref: string | null; total_amount: number; extras_amount: number; deposit_amount: number;
  paid_amount: number; special_requests: string | null; created_at: string;
  guests: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; language: string; segments: string[]; stays_count: number; total_spent: number; notes: string | null } | null;
  rooms: { id: string; number: string; hk_status: string } | null;
  room_types: { id: string; name: string; code: string } | null;
  hotels: { name: string } | null;
};

export function SegmentBadges({ segments }: { segments: string[] }) {
  const map: Record<string, { label: string; tone: "gold" | "info" | "success" | "muted" }> = {
    vip: { label: "VIP", tone: "gold" },
    affaires: { label: "Affaires", tone: "info" },
    famille: { label: "Famille", tone: "success" },
    habitue: { label: "Habitué", tone: "muted" },
  };
  return (
    <>
      {segments.map((s) => map[s] && <Badge key={s} tone={map[s].tone}>{map[s].label}</Badge>)}
    </>
  );
}

export function ReservationsTable({ rows, showHotel, canEdit }: { rows: ResRow[]; showHotel: boolean; canEdit: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Réservation</TH>
            <TH>Client</TH>
            <TH>Séjour</TH>
            <TH>Chambre</TH>
            <TH className="hidden md:table-cell">Canal</TH>
            <TH>Statut</TH>
            <TH className="text-right">Montant</TH>
            <TH className="hidden text-right lg:table-cell">Payé</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => {
            const total = Number(r.total_amount) + Number(r.extras_amount);
            const paidPct = total ? Number(r.paid_amount) / total : 0;
            return (
              <TR key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                <TD>
                  <span className="font-mono text-xs">{r.code}</span>
                  {showHotel && <span className="block text-xs text-muted-foreground">{r.hotels?.name}</span>}
                </TD>
                <TD>
                  <span className="flex flex-wrap items-center gap-1.5 font-medium">
                    {r.guests ? `${r.guests.first_name} ${r.guests.last_name}` : "—"}
                    <SegmentBadges segments={r.guests?.segments?.slice(0, 2) ?? []} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.adults} adulte{r.adults > 1 ? "s" : ""}{r.children ? ` · ${r.children} enfant${r.children > 1 ? "s" : ""}` : ""}
                  </span>
                </TD>
                <TD className="whitespace-nowrap">
                  {fmtDate(r.check_in)} → {fmtDate(r.check_out)}
                  <span className="block text-xs text-muted-foreground">{r.nights} nuit{r.nights > 1 ? "s" : ""}</span>
                </TD>
                <TD>
                  <span className="font-medium tabular">{r.rooms?.number ?? "—"}</span>
                  <span className="block text-xs text-muted-foreground">{r.room_types?.name}</span>
                </TD>
                <TD className="hidden md:table-cell">{CHANNEL_LABEL[r.channel]}</TD>
                <TD><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></TD>
                <TD className="text-right tabular">{fmtEur(total)}</TD>
                <TD className="hidden text-right lg:table-cell">
                  <span className={paidPct >= 0.999 ? "text-success" : paidPct > 0 ? "" : "text-muted-foreground"}>
                    {paidPct >= 0.999 ? "Soldé" : paidPct > 0 ? `${Math.round(paidPct * 100)} %` : "—"}
                  </span>
                </TD>
              </TR>
            );
          })}
          {!rows.length && (
            <TR className="hover:bg-transparent">
              <TD colSpan={8} className="py-12 text-center text-muted-foreground">Aucune réservation pour ce filtre.</TD>
            </TR>
          )}
        </TBody>
      </Table>
      <ReservationSheet reservation={open} onClose={() => setOpenId(null)} canEdit={canEdit} />
    </div>
  );
}
