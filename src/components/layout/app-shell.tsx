"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import type { Role } from "@prisma/client";
import { Activity, Award, BookOpen, Building2, ChartPie, ClipboardCheck, FileText, House, Inbox, Info, KeyRound, LogOut, MapPin, Menu, PenLine, Settings, Users, UsersRound, X } from "lucide-react";
import { COMMON_NAV, NAV } from "./nav";
import { ROLE_LABELS, INSTITUTION } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { LOGO } from "@/lib/brand";
import { DEVELOPER_CREDIT } from "@/lib/developer";
import { NavigationProgress } from "./navigation-progress";

const ICONS = { home: House, "map-pin": MapPin, book: BookOpen, users: Users, pen: PenLine, activity: Activity, file: FileText, award: Award, chart: ChartPie, building: Building2, settings: Settings, inbox: Inbox, meeting: UsersRound, sheet: ClipboardCheck, info: Info, key: KeyRound } as const;

export function AppShell({ user, hiddenHrefs = [], children }: { user: { name: string; role: Role }; hiddenHrefs?: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV[user.role].filter((it) => !hiddenHrefs.includes(it.href));

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const Icon = ICONS[it.icon as keyof typeof ICONS];
        const active = pathname === it.href || (it.href !== "/student" && pathname.startsWith(it.href + "/"));
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="size-4" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );

  // «عن المنصة والمطور»: زر مميز أسفل القائمة لجميع الأدوار
  const common = (
    <nav aria-label="عن المنصة" className="flex flex-col gap-1">
      {COMMON_NAV.map((it) => {
        const Icon = ICONS[it.icon as keyof typeof ICONS];
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              active ? "border-qu-teal-400/60 bg-qu-teal-500/20 font-semibold text-white" : "border-white/10 bg-white/5 text-white/80 hover:border-qu-teal-400/40 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="size-4 text-qu-teal-300" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
      <Image src={LOGO.emblemWhite} alt="جامعة القصيم" width={208} height={131} className="h-auto w-[52px] shrink-0" />
      <div className="leading-tight">
        <div className="text-sm font-bold text-white">{INSTITUTION.unit}</div>
        <div className="text-[11px] text-qu-teal-100">{INSTITUTION.university}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr] print:block">
      <NavigationProgress />
      {/* الشريط الجانبي (سطح المكتب) */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-4 bg-qu-navy-800 p-4 lg:flex print:!hidden">
        {brand}
        {nav}
        <div className="mt-auto space-y-3">
          {common}
          <div className="rounded-lg bg-white/5 p-3 text-xs text-white/70">
            {INSTITUTION.department}
            <br />
            {INSTITUTION.college}
          </div>
        </div>
      </aside>

      {/* قائمة الجوال */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 flex-col gap-4 bg-qu-navy-800 p-4">
            <button className="self-start text-white" onClick={() => setOpen(false)} aria-label="إغلاق"><X /></button>
            {brand}
            {nav}
            <div className="mt-auto space-y-3">
              {common}
              <p className="text-center text-[11px] text-white/50">{DEVELOPER_CREDIT}</p>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 print:hidden items-center gap-3 border-b bg-card/90 px-4 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة"><Menu /></button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-qu-teal-700">{ROLE_LABELS[user.role]}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            <LogOut className="size-4" /> خروج
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 print:p-0">{children}</main>
        <footer className="px-4 pb-24 pt-2 text-center text-xs text-muted-foreground md:px-6 lg:pb-5 print:hidden">
          <Link href="/developer" className="transition-colors hover:text-qu-teal-700">{DEVELOPER_CREDIT}</Link>
        </footer>

        {/* شريط تنقل سفلي للجوال (تجربة PWA) */}
        <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card lg:hidden print:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)` }}>
          {/* أول 4 روابط فقط؛ البقية في القائمة الجانبية */}
          {items.slice(0, 4).map((it) => {
            const Icon = ICONS[it.icon as keyof typeof ICONS];
            const active = pathname === it.href;
            return (
              <Link key={it.href} href={it.href} className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="size-5" />
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
