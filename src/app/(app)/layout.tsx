import { getContext, canAccess } from "@/lib/context";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { NAV } from "@/components/shell/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  const allowed = NAV.flatMap((g) => g.items.map((i) => i.section)).filter((s) => canAccess(ctx.role, s));
  return (
    <div className="flex min-h-dvh">
      <Sidebar allowed={allowed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar hotels={ctx.hotels} selection={ctx.selection} fullName={ctx.fullName} role={ctx.role} allowed={allowed} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
