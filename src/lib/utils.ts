import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("fr-FR");

export const fmtEur = (v: number | null | undefined, decimals = false) =>
  v == null ? "—" : (decimals ? eur2 : eur0).format(Number(v));
export const fmtNum = (v: number | null | undefined) => (v == null ? "—" : num.format(Number(v)));
export const fmtPct = (v: number | null | undefined, d = 1) =>
  v == null ? "—" : `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

export function variation(cur: number | null | undefined, prev: number | null | undefined) {
  if (cur == null || prev == null || Number(prev) === 0) return null;
  return ((Number(cur) - Number(prev)) / Math.abs(Number(prev))) * 100;
}

export function fmtDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) {
  return new Date(typeof d === "string" && d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("fr-FR", opts);
}

export function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relTime(d: string | Date) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`;
  return fmtDate(d);
}

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function todayParis() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}
