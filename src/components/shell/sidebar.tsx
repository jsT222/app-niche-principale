"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

export function SidebarNav({ allowed, onNavigate }: { allowed: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5">
      {NAV.map((g) => {
        const items = g.items.filter((i) => allowed.includes(i.section));
        if (!items.length) return null;
        return (
          <div key={g.group} className="space-y-1">
            <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{g.group}</p>
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-card font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("size-4", active && "text-primary")} />
                  <span className="flex-1">{item.label}</span>
                  {item.soon && <span className="size-1.5 rounded-full bg-muted-foreground/30" title="Module en préparation" />}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ allowed }: { allowed: string[] }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar px-3 py-5 lg:flex">
      <Link href="/" className="px-3">
        <Logo />
      </Link>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav allowed={allowed} />
      </div>
      <div className="rounded-lg border border-dashed bg-card/60 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Mode démo</p>
        Intégrations simulées · données réinitialisées chaque nuit.
      </div>
    </aside>
  );
}
