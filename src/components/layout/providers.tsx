"use client";
import { SessionProvider } from "next-auth/react";
import { SESSION_REFETCH_SECONDS } from "@/lib/auth/config";

/**
 * تحديث الجلسة تلقائياً: طلب دوري لـ /api/auth/session والصفحة مفتوحة، وعند العودة إلى التبويب.
 * كل طلب يمدّ صلاحية الجلسة 30 يوماً جديدة، فلا يخرج المستخدم إذا ترك الصفحة مفتوحة.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={SESSION_REFETCH_SECONDS} refetchOnWindowFocus refetchWhenOffline={false}>
      {children}
    </SessionProvider>
  );
}
