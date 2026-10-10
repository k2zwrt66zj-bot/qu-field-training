"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

export interface OverrideTrainee {
  placementId: string;
  name: string;
  universityId: string;
}

const REASONS = [
  "عطل في جهاز الطالب",
  "نفاد بطارية الجهاز",
  "عدم توفر هاتف ذكي لدى الطالب",
  "انقطاع الإنترنت في مقر التدريب",
  "تعذّر تحديد الموقع (GPS) داخل المبنى",
];

/** تحضير يدوي استثنائي من المشرف المؤسسي عند تعذّر التحضير الجغرافي */
export function ManualAttendanceOverride({ trainees }: { trainees: OverrideTrainee[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [placementId, setPlacementId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [preset, setPreset] = useState(REASONS[0]);
  const [reason, setReason] = useState(REASONS[0]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const reset = () => { setPlacementId(""); setDate(new Date().toISOString().slice(0, 10)); setPreset(REASONS[0]); setReason(REASONS[0]); setMsg(null); };

  const submit = () =>
    start(async () => {
      setMsg(null);
      const res = await fetch("/api/attendance/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placementId, date, reason: reason.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: json.details?.[0]?.message ?? json.error ?? "تعذّر التسجيل" });
      setMsg({ ok: true, text: `سُجّل حضور ${json.studentName} يدوياً (${Math.round((json.workedMinutes / 60) * 10) / 10} ساعة)` });
      router.refresh();
    });

  if (trainees.length === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { reset(); setOpen(true); }}>
        <CalendarCheck className="size-4" /> تحضير يدوي
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="تحضير يدوي استثنائي"
        description="لحالات تعذّر التحضير الجغرافي (عطل جهاز، نفاد بطارية، لا هاتف، انقطاع إنترنت). يُسجَّل حضوراً معتمداً بسبب موثّق في سجل التدقيق."
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ov-student">الطالب/ة</Label>
            <Select id="ov-student" value={placementId} onChange={(e) => setPlacementId(e.target.value)}>
              <option value="">— اختر المتدرب —</option>
              {trainees.map((t) => <option key={t.placementId} value={t.placementId}>{t.name} · {t.universityId}</option>)}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ov-date">اليوم</Label>
            <Input id="ov-date" type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ov-preset">سبب التجاوز</Label>
            <Select
              id="ov-preset"
              value={preset}
              onChange={(e) => { setPreset(e.target.value); if (e.target.value !== "__other__") setReason(e.target.value); else setReason(""); }}
            >
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="__other__">سبب آخر…</option>
            </Select>
            {preset === "__other__" && (
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اكتب سبب التجاوز" rows={3} className="mt-2" />
            )}
          </div>

          {msg && <p role="alert" className={`rounded-md p-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"}`}>{msg.text}</p>}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>إغلاق</Button>
            <Button onClick={submit} disabled={pending || !placementId || reason.trim().length < 5}>
              {pending ? <LoaderCircle className="animate-spin" /> : <CalendarCheck />} تسجيل الحضور
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
