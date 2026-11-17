import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path d="M10 8v16M22 8v16M10 16h12" stroke="var(--gold)" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      {!compact && <span className="font-serif text-xl font-medium tracking-tight">Hôtelis</span>}
    </div>
  );
}
