import { Check, CornerDownLeft } from "lucide-react";
import type { DocumentStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

/** مسار النموذج: مسودة ← مرفوع ← توقيع المشرف المؤسسي ← اعتماد أكاديمي */
export function StatusStepper({ status, fieldApproval, locked }: { status: DocumentStatus; fieldApproval: boolean; locked: boolean }) {
  const steps = [
    { key: "DRAFT", label: "إعداد" },
    { key: "SUBMITTED", label: "مرفوع" },
    ...(fieldApproval ? [{ key: "SIGNED", label: "توقيع المشرف المؤسسي" }] : []),
    { key: "REVIEWED", label: "اعتماد المشرف الأكاديمي" },
  ];
  const order = steps.map((s) => s.key);
  const current = status === "RETURNED" ? 0 : order.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="مسار النموذج">
      {steps.map((s, i) => {
        const done = i < current || (status === "REVIEWED" && i === current);
        const active = i === current && status !== "REVIEWED";
        return (
          <li key={s.key} className="flex items-center gap-1">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1",
                done && "bg-emerald-100 text-emerald-800",
                active && (status === "RETURNED" ? "bg-red-100 text-red-800" : "bg-qu-navy-700 text-white"),
                !done && !active && "bg-muted text-muted-foreground"
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-3" /> : active && status === "RETURNED" ? <CornerDownLeft className="size-3" /> : <span className="tabular-nums">{i + 1}</span>}
              {active && status === "RETURNED" ? "معاد للتعديل" : s.label}
            </span>
            {i < steps.length - 1 && <span className="h-px w-3 bg-border" />}
          </li>
        );
      })}
      {locked && <li className="ms-2 rounded-full bg-qu-teal-50 px-2.5 py-1 text-qu-teal-700">مقفل بعد اعتماد النتيجة</li>}
    </ol>
  );
}
