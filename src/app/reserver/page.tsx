import Link from "next/link";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";

export const metadata = { title: "Réserver" };
export const dynamic = "force-dynamic";

const HOTELS = ["les-tilleuls", "maison-saint-clair"];

export default async function ReserverIndex() {
  const supabase = await createClient();
  const hotels = await Promise.all(
    HOTELS.map(async (slug) => {
      const { data } = await supabase.rpc("public_hotel", { p_slug: slug });
      return data ? { slug, ...(data as { name: string; city: string; address: string; stars: number }) } : null;
    })
  );
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-12">
      <Logo />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Réserver en direct</h1>
        <p className="mt-2 text-muted-foreground">Meilleur prix garanti : -5 % par rapport aux plateformes.</p>
      </div>
      <div className="grid gap-3">
        {hotels.filter(Boolean).map((h) => (
          <Link key={h!.slug} href={`/reserver/${h!.slug}`}
            className="group flex items-center gap-4 rounded-2xl border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm">
            <div className="flex-1">
              <span className="flex items-center gap-1 text-gold">
                {Array.from({ length: h!.stars }).map((_, i) => <Star key={i} className="size-3 fill-current" />)}
              </span>
              <h2 className="mt-1 font-serif text-2xl">{h!.name}</h2>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-3.5" /> {h!.address}</p>
            </div>
            <ArrowRight className="size-5 text-muted-foreground transition group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
