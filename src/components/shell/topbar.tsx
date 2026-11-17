"use client";
import { useState, useTransition } from "react";
import { Building2, Check, ChevronsUpDown, LogOut, Menu } from "lucide-react";
import { setHotel } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "./sidebar";
import { Logo } from "@/components/logo";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

type H = { id: string; name: string; city: string; role: Role };

export function Topbar({
  hotels, selection, fullName, role, allowed,
}: { hotels: H[]; selection: string; fullName: string; role: Role; allowed: string[] }) {
  const [pending, start] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = selection === "all" ? null : hotels.find((h) => h.id === selection);
  const initials = fullName.split(" ").map((p) => p[0]).slice(0, 2).join("");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Menu">
        <Menu />
      </Button>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent className="left-0 right-auto max-w-72 border-r border-l-0 bg-sidebar">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <Logo />
          <SidebarNav allowed={allowed} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={hotels.length < 2}>
          <button
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-accent",
              pending && "opacity-60",
              hotels.length < 2 && "pointer-events-none"
            )}
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium leading-tight">{current ? current.name : "Tous les établissements"}</span>
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                {current ? current.city : `${hotels.length} hôtels · vue groupe`}
              </span>
            </span>
            {hotels.length > 1 && <ChevronsUpDown className="size-3.5 text-muted-foreground" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Établissement</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => start(() => setHotel("all"))}>
            <Building2 /> Tous les établissements
            {selection === "all" && <Check className="ml-auto text-primary!" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {hotels.map((h) => (
            <DropdownMenuItem key={h.id} onSelect={() => start(() => setHotel(h.id))}>
              <span className="flex-1">
                {h.name}
                <span className="block text-xs text-muted-foreground">{h.city}</span>
              </span>
              {selection === h.id && <Check className="text-primary!" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition hover:bg-accent">
              <span className="flex size-8 items-center justify-center rounded-full bg-gold/25 text-xs font-semibold">{initials}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm leading-tight">{fullName}</span>
                <span className="block text-xs leading-tight text-muted-foreground">{ROLE_LABEL[role]}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{fullName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post">
              <button type="submit" className="w-full">
                <DropdownMenuItem>
                  <LogOut /> Changer de profil
                </DropdownMenuItem>
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
