import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        default: "border-transparent bg-primary text-primary-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-success/15 text-success",
        info: "border-transparent bg-info/15 text-info",
        warning: "border-transparent bg-warning/20 text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))]",
        danger: "border-transparent bg-destructive/12 text-destructive",
        gold: "border-transparent bg-gold/20 text-[color-mix(in_oklch,var(--gold)_55%,var(--foreground))]",
      },
    },
    defaultVariants: { tone: "muted" },
  }
);

export function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
