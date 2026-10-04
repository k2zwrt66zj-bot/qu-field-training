"use client";
import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/** خطأ في صفحة واحدة: تبقى القائمة الجانبية تعمل، مع إعادة المحاولة دون تحديث المتصفح */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
      <TriangleAlert className="mx-auto size-12 text-amber-600" />
      <h1 className="mt-3 text-xl font-bold text-qu-navy-700 dark:text-qu-navy-100">تعذّر عرض هذه الصفحة</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        حدث خطأ مؤقت أثناء تحميل البيانات. أعد المحاولة، وإن تكرر الخطأ فأبلغ الدعم الفني
        {error.digest ? <> برمز <span dir="ltr" className="font-mono">{error.digest}</span></> : null}.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCw /> إعادة المحاولة
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          الرئيسية
        </Link>
      </div>
    </div>
  );
}
