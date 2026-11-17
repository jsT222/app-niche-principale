"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReservation } from "@/app/(app)/reservations/actions";
import { addDays, todayParis } from "@/lib/utils";

type RT = { id: string; hotel_id: string; name: string; base_price: number; capacity: number };

export function NewReservationButton({ hotels, roomTypes }: { hotels: { id: string; name: string }[]; roomTypes: RT[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const today = todayParis();
  const [hotelId, setHotelId] = useState(hotels[0]?.id ?? "");
  const types = useMemo(() => roomTypes.filter((t) => t.hotel_id === hotelId), [roomTypes, hotelId]);

  const submit = (fd: FormData) =>
    start(async () => {
      const res = await createReservation({
        hotelId,
        roomTypeId: String(fd.get("roomType")),
        checkIn: String(fd.get("checkIn")),
        checkOut: String(fd.get("checkOut")),
        adults: Number(fd.get("adults")),
        children: Number(fd.get("children")),
        firstName: String(fd.get("firstName")),
        lastName: String(fd.get("lastName")),
        email: String(fd.get("email")),
        phone: String(fd.get("phone")),
        language: String(fd.get("language")),
        channel: String(fd.get("channel")),
        status: String(fd.get("status")),
        requests: String(fd.get("requests")),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Réservation ${res.code} créée`, { description: `${res.message}. Confirmation envoyée automatiquement.` });
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus /> Nouvelle réservation</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouvelle réservation</DialogTitle>
          <DialogDescription>La chambre est attribuée automatiquement, la fiche client créée et la confirmation envoyée.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid grid-cols-2 gap-3">
          {hotels.length > 1 && (
            <Field label="Établissement" className="col-span-2">
              <NativeSelect value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field label="Arrivée"><Input type="date" name="checkIn" required defaultValue={today} min={today} /></Field>
          <Field label="Départ"><Input type="date" name="checkOut" required defaultValue={addDays(today, 2)} min={addDays(today, 1)} /></Field>
          <Field label="Type de chambre" className="col-span-2">
            <NativeSelect name="roomType" required>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name} — dès {Math.round(t.base_price)} € · {t.capacity} pers.</option>)}
            </NativeSelect>
          </Field>
          <Field label="Adultes"><Input type="number" name="adults" min={1} max={6} defaultValue={2} /></Field>
          <Field label="Enfants"><Input type="number" name="children" min={0} max={4} defaultValue={0} /></Field>
          <Field label="Prénom"><Input name="firstName" required /></Field>
          <Field label="Nom"><Input name="lastName" required /></Field>
          <Field label="Email"><Input type="email" name="email" /></Field>
          <Field label="Téléphone"><Input name="phone" /></Field>
          <Field label="Langue">
            <NativeSelect name="language" defaultValue="fr">
              <option value="fr">Français</option><option value="en">Anglais</option><option value="de">Allemand</option><option value="it">Italien</option><option value="es">Espagnol</option>
            </NativeSelect>
          </Field>
          <Field label="Canal">
            <NativeSelect name="channel" defaultValue="phone">
              <option value="phone">Téléphone</option><option value="walk_in">Sans réservation</option><option value="direct">Site direct</option>
              <option value="booking">Booking.com</option><option value="expedia">Expedia</option><option value="airbnb">Airbnb</option>
            </NativeSelect>
          </Field>
          <Field label="Statut" className="col-span-2">
            <NativeSelect name="status" defaultValue="confirmed">
              <option value="confirmed">Confirmée</option><option value="pending">En attente d&apos;acompte</option><option value="waitlist">Liste d&apos;attente</option>
            </NativeSelect>
          </Field>
          <Field label="Demandes particulières" className="col-span-2"><Textarea name="requests" rows={2} placeholder="Lit bébé, arrivée tardive…" /></Field>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Créer la réservation</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
