"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import type { Role } from "@prisma/client";
import { Activity, Award, BookOpen, Building2, ChartPie, FileText, House, LogOut, MapPin, Menu, PenLine, Settings, Users, X } from "lucide-react";
import { NAV } from "./nav";
import { ROLE_LABELS, INSTITUTION } from "@/lib/labels";
import { cn } from "@/lib/utils";

const ICONS = { home: House, "map-pin": MapPin, book: BookOpen, users: Users, pen: PenLine, activity: Activity, file: FileText, award: Award, chart: ChartPie, building: Building2, settings: Settings } as const;

export function AppShell({ user, children }: { user: { name: string; role: Role }; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV[user.role];

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

  const brand = (
    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
      <Image src="/brand/logo.svg" alt="جامعة القصيم" width={44} height={44} />
      <div className="leading-tight">
        <div className="text-sm font-bold text-white">{INSTITUTION.unit}</div>
        <div className="text-[11px] text-qu-gold-100">{INSTITUTION.university}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr] print:block">
      {/* الشريط الجانبي (سطح المكتب) */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-4 bg-qu-green-800 p-4 lg:flex print:!hidden">
        {brand}
        {nav}
        <div className="mt-auto rounded-lg bg-white/5 p-3 text-xs text-white/70">
          {INSTITUTION.department}
          <br />
          {INSTITUTION.college}
        </div>
      </aside>

      {/* قائمة الجوال */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 flex-col gap-4 bg-qu-green-800 p-4">
            <button className="self-start text-white" onClick={() => setOpen(false)} aria-label="إغلاق"><X /></button>
            {brand}
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 print:hidden items-center gap-3 border-b bg-card/90 px-4 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة"><Menu /></button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-qu-gold-600">{ROLE_LABELS[user.role]}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            <LogOut className="size-4" /> خروج
          </button>
        </header>
        <main className="flex-1 p-4 pb-24 md:p-6 lg:pb-6 print:p-0">{children}</main>

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
