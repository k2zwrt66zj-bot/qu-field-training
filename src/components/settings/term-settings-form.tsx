"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TermSettings {
  fieldWeight: number;
  academicWeight: number;
  attendanceWeight: number;
  requiredHours: number;
  lateAfterMinutes: number;
  minDailyMinutes: number;
  maxConsecutiveAbsences: number;
}

const FIELDS: { key: keyof TermSettings; label: string; hint?: string; group: "w" | "a" }[] = [
  { key: "fieldWeight", label: "وزن المشرف المؤسسي %", group: "w" },
  { key: "academicWeight", label: "وزن المشرف الأكاديمي %", group: "w" },
  { key: "attendanceWeight", label: "وزن التحضير والسجلات %", group: "w" },
  { key: "requiredHours", label: "الساعات المطلوبة", hint: "تسري على الإسنادات الجارية", group: "a" },
  { key: "lateAfterMinutes", label: "يُحتسب تأخراً بعد (دقيقة)", hint: "من بداية دوام الجهة", group: "a" },
  { key: "maxConsecutiveAbsences", label: "تنبيه حرج بعد غياب متتالٍ (يوم)", group: "a" },
];

export function TermSettingsForm({ termId, initial, gradesApproved }: { termId: string; initial: TermSettings; gradesApproved: number }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sum = v.fieldWeight + v.academicWeight + v.attendanceWeight;

  const input = (f: (typeof FIELDS)[number]) => (
    <div key={f.key} className="space-y-1.5">
      <Label htmlFor={f.key}>{f.label}</Label>
      <Input
        id={f.key}
        type="number"
        min={0}
        disabled={f.group === "w" && gradesApproved > 0}
        value={v[f.key]}
        onChange={(e) => setV((s) => ({ ...s, [f.key]: Number(e.target.value) }))}
      />
      {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
    </div>
  );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await fetch(`/api/terms/${termId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
          const json = await res.json();
          if (!res.ok) return setMsg({ ok: false, text: json.details?.[0]?.message ?? json.error });
          setMsg({ ok: true, text: json.weightsChanged ? "تم الحفظ — أعد احتساب الدرجات من صفحة «اعتماد النتائج» لتطبيق الأوزان الجديدة" : "تم الحفظ" });
          router.refresh();
        });
      }}
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">توزيع الدرجة النهائية</h4>
          <span className={cn("text-sm font-semibold tabular-nums", sum === 100 ? "text-emerald-700" : "text-red-700")}>المجموع: {sum} / 100</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">{FIELDS.filter((f) => f.group === "w").map(input)}</div>
        {gradesApproved > 0 && <p className="mt-2 text-xs text-amber-700">الأوزان مقفلة: اعتُمدت {gradesApproved} نتيجة في هذا الفصل.</p>}
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">الحضور والتنبيهات</h4>
        <div className="grid gap-3 sm:grid-cols-3">{FIELDS.filter((f) => f.group === "a").map(input)}</div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || sum !== 100}>{pending ? <LoaderCircle className="animate-spin" /> : <Save />} حفظ الإعدادات</Button>
        {msg && <span role="status" className={cn("text-sm", msg.ok ? "text-emerald-700" : "text-red-700")}>{msg.text}</span>}
      </div>
    </form>
  );
}
