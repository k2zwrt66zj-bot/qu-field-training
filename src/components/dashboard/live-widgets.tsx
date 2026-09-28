"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** تحديث لحظي للوحة كل دقيقة (يعيد جلب بيانات الخادم دون إعادة تحميل الصفحة) */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [at, setAt] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => start(() => { router.refresh(); setAt(new Date()); }), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return (
    <Button variant="outline" size="sm" onClick={() => start(() => { router.refresh(); setAt(new Date()); })}>
      <RefreshCw className={pending ? "animate-spin" : ""} />
      آخر تحديث {at.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}
    </Button>
  );
}

export function ResolveAlertButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch(`/api/alerts/${id}`, { method: "PATCH" });
          router.refresh();
        })
      }
    >
      <Check /> معالجة
    </Button>
  );
}
