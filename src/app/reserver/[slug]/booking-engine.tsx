"use client";
import { useState, useTransition } from "react";
import { BadgeCheck, CalendarDays, Check, CreditCard, Loader2, Lock, MapPin, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { book, searchAvailability, type Avail } from "./actions";
import type { Hotel } from "./page";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { addDays, cn, fmtDate, fmtEur, todayParis } from "@/lib/utils";

const ROOM_INFO: Record<string, { size: string; perks: string[] }> = {
  CLA: { size: "18 m²", perks: ["Lit double 160", "Douche à l'italienne", "Wi-Fi fibre"] },
  SUP: { size: "24 m²", perks: ["Lit king size", "Coin salon", "Machine à café"] },
  LAC: { size: "28 m²", perks: ["Vue sur le lac", "Balcon", "Baignoire"] },
  FAM: { size: "34 m²", perks: ["Lit double + 2 lits simples", "2 salles d'eau", "Lit bébé sur demande"] },
  STE: { size: "45 m²", perks: ["Salon séparé", "Vue panoramique", "Petit-déjeuner offert"] },
};

export function BookingEngine({ slug, hotel }: { slug: string; hotel: Hotel }) {
  const today = todayParis();
  const [checkIn, setCheckIn] = useState(addDays(today, 7));
  const [checkOut, setCheckOut] = useState(addDays(today, 9));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState<Avail[] | null>(null);
  const [chosen, setChosen] = useState<Avail | null>(null);
  const [done, setDone] = useState<{ code: string; total: number; deposit: number; room: string | null } | null>(null);
  const [pending, start] = useTransition();
  const nights = Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));

  const search = () =>
    start(async () => {
      setChosen(null);
      const res = await searchAvailability(slug, checkIn, checkOut, adults + children);
      if (!res.ok) return void toast.error(res.error);
      setRooms(res.rooms);
    });

  const confirm = (fd: FormData) =>
    start(async () => {
      if (!chosen) return;
      const res = await book({
        slug, roomTypeId: chosen.room_type_id, checkIn, checkOut, adults, children,
        firstName: String(fd.get("firstName")), lastName: String(fd.get("lastName")), email: String(fd.get("email")),
        phone: String(fd.get("phone")), language: String(fd.get("language")), requests: String(fd.get("requests")),
      });
      if (!res.ok) return void toast.error(res.error);
      setDone(res.booking);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  return (
    <div className="min-h-dvh bg-background">
      <header className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-gold">{Array.from({ length: hotel.stars }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}</span>
            <ThemeToggle />
          </div>
          <h1 className="mt-6 font-serif text-4xl tracking-tight md:text-5xl">{hotel.name}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm opacity-80"><MapPin className="size-4" /> {hotel.address}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs"><BadgeCheck className="size-3.5 text-gold" /> Meilleur prix garanti en réservant ici : -5 % par rapport aux plateformes</p>
        </div>
      </header>

      <main className="relative mx-auto -mt-16 max-w-5xl px-4 pb-16 md:px-6">
        {done ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/15 text-success"><Check className="size-7" /></div>
            <h2 className="mt-4 font-serif text-3xl">Réservation confirmée</h2>
            <p className="mt-2 text-muted-foreground">Merci ! Votre confirmation <span className="font-mono">{done.code}</span> vient d&apos;être envoyée par email et WhatsApp.</p>
            <div className="mx-auto mt-6 max-w-sm space-y-1 rounded-xl border p-4 text-left text-sm">
              <Row label="Séjour">{fmtDate(checkIn, { day: "numeric", month: "long" })} → {fmtDate(checkOut, { day: "numeric", month: "long" })}</Row>
              <Row label="Chambre">{chosen?.name}</Row>
              <Row label="Total">{fmtEur(done.total)}</Row>
              <Row label="Acompte payé">{fmtEur(done.deposit)}</Row>
              <Row label="Reste à régler sur place">{fmtEur(done.total - done.deposit)}</Row>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">Vous recevrez un rappel 3 jours avant votre arrivée, puis vos consignes d&apos;arrivée et le lien de check-in en ligne la veille.</p>
            <Button className="mt-6" variant="outline" onClick={() => { setDone(null); setRooms(null); setChosen(null); }}>Nouvelle recherche</Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2 md:grid-cols-[1fr_1fr_auto_auto_auto] md:items-end">
              <div className="space-y-1.5"><Label><CalendarDays className="mr-1 inline size-3.5" />Arrivée</Label>
                <Input type="date" value={checkIn} min={today} onChange={(e) => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1)); }} /></div>
              <div className="space-y-1.5"><Label>Départ</Label>
                <Input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} /></div>
              <div className="space-y-1.5"><Label><Users className="mr-1 inline size-3.5" />Adultes</Label>
                <NativeSelect value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="md:w-20">{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</NativeSelect></div>
              <div className="space-y-1.5"><Label>Enfants</Label>
                <NativeSelect value={children} onChange={(e) => setChildren(Number(e.target.value))} className="md:w-20">{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</NativeSelect></div>
              <Button onClick={search} disabled={pending || nights < 1} size="lg" className="sm:col-span-2 md:col-span-1">
                {pending && !chosen ? <Loader2 className="animate-spin" /> : null} Voir les disponibilités
              </Button>
            </div>

            {rooms && (
              <section className="mt-8 space-y-3">
                <h2 className="text-sm text-muted-foreground">{nights} nuit{nights > 1 ? "s" : ""} · {adults + children} personne{adults + children > 1 ? "s" : ""}</h2>
                {rooms.length === 0 && <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Aucune chambre ne correspond à ces critères.</p>}
                {rooms.map((r) => {
                  const info = ROOM_INFO[r.code] ?? { size: "", perks: [] };
                  const sold = r.available === 0;
                  return (
                    <div key={r.room_type_id} className={cn("grid gap-4 rounded-2xl border bg-card p-5 transition md:grid-cols-[1fr_auto]", chosen?.room_type_id === r.room_type_id && "ring-2 ring-primary", sold && "opacity-60")}>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-xl">{r.name}</h3>
                          {!sold && r.available <= 2 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Plus que {r.available} !</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">{info.size} · jusqu&apos;à {r.capacity} personnes</p>
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">{info.perks.map((p) => <li key={p} className="flex items-center gap-1"><Check className="size-3.5 text-success" />{p}</li>)}</ul>
                      </div>
                      <div className="flex items-end justify-between gap-4 md:flex-col md:items-end">
                        <div className="text-right">
                          <p className="font-serif text-2xl tabular">{fmtEur(r.total)}</p>
                          <p className="text-xs text-muted-foreground">soit {fmtEur(r.nightly)} / nuit, taxes incluses</p>
                        </div>
                        <Button disabled={sold} onClick={() => setChosen(r)} variant={chosen?.room_type_id === r.room_type_id ? "default" : "outline"}>
                          {sold ? "Complet" : chosen?.room_type_id === r.room_type_id ? "Sélectionnée" : "Choisir"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {chosen && (
              <form action={confirm} className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
                <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-5">
                  <h3 className="col-span-2 font-serif text-xl">Vos coordonnées</h3>
                  <F label="Prénom"><Input name="firstName" required /></F>
                  <F label="Nom"><Input name="lastName" required /></F>
                  <F label="Email"><Input name="email" type="email" required /></F>
                  <F label="Téléphone (WhatsApp)"><Input name="phone" /></F>
                  <F label="Langue" className="col-span-2">
                    <NativeSelect name="language" defaultValue="fr"><option value="fr">Français</option><option value="en">English</option><option value="de">Deutsch</option><option value="it">Italiano</option><option value="es">Español</option></NativeSelect>
                  </F>
                  <F label="Demandes particulières" className="col-span-2"><Textarea name="requests" rows={2} placeholder="Heure d'arrivée, lit bébé, allergies…" /></F>
                  <div className="col-span-2 space-y-3 rounded-xl border border-dashed p-4">
                    <p className="flex items-center gap-2 text-sm font-medium"><CreditCard className="size-4" /> Paiement sécurisé de l&apos;acompte</p>
                    <Input value="4242 4242 4242 4242" readOnly className="font-mono" aria-label="Numéro de carte (démo)" />
                    <div className="grid grid-cols-2 gap-3"><Input value="12 / 29" readOnly aria-label="Expiration" /><Input value="123" readOnly aria-label="CVC" /></div>
                    <p className="text-xs text-muted-foreground">Mode démo : paiement simulé (Stripe Checkout en production). Aucune carte n&apos;est débitée.</p>
                  </div>
                </div>
                <aside className="h-fit space-y-3 rounded-2xl border bg-card p-5 md:sticky md:top-6">
                  <h3 className="font-serif text-xl">Récapitulatif</h3>
                  <Row label="Chambre">{chosen.name}</Row>
                  <Row label="Dates">{fmtDate(checkIn)} → {fmtDate(checkOut)}</Row>
                  <Row label="Nuits">{nights}</Row>
                  <div className="border-t pt-2"><Row label="Total séjour">{fmtEur(chosen.total)}</Row></div>
                  <Row label={`Acompte (${hotel.deposit_percent} %)`}><span className="font-semibold">{fmtEur(Math.round((chosen.total * hotel.deposit_percent) / 100))}</span></Row>
                  <Button type="submit" className="w-full" size="lg" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Lock />} Payer l&apos;acompte et réserver</Button>
                  <p className="text-xs text-muted-foreground">Annulation gratuite jusqu&apos;à 48 h avant l&apos;arrivée. Arrivée dès {hotel.check_in_time.slice(0, 5)}, départ avant {hotel.check_out_time.slice(0, 5)}.</p>
                </aside>
              </form>
            )}
          </>
        )}
        <p className="mt-10 text-center text-xs text-muted-foreground">{hotel.name} · {hotel.phone} · Propulsé par Hôtelis</p>
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right">{children}</span></div>;
}
function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}><Label>{label}</Label>{children}</div>;
}
