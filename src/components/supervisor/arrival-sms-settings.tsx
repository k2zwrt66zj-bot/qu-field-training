"use client";
import { useState } from "react";
import { BellRing, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ArrivalSmsState {
  smsOnArrival: boolean;
  phone: string;
  smsConfigured: boolean;
}

/** إعداد اختياري: رسالة نصية للمشرف المؤسسي عند وصول المتدرب إلى المؤسسة */
export function ArrivalSmsSettings({ initial }: { initial: ArrivalSmsState }) {
  const [state, setState] = useState(initial);
  const [phone, setPhone] = useState(initial.phone);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(next: boolean) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/field-supervisor/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smsOnArrival: next, phone }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "تعذّر الحفظ" });
    setState(json);
    setPhone(json.phone);
    setMsg({ ok: true, text: next ? "سيصلك إشعار برسالة نصية عند وصول كل متدرب" : "أُوقفت رسائل الوصول" });
  }

  return (
    <div className="space-y-4" data-sms-settings>
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span className="space-y-1">
          <span className="flex items-center gap-2 font-medium">
            <BellRing className="size-4 text-qu-teal-700" /> رسالة نصية عند وصول المتدرب
          </span>
          <span className="block text-xs leading-6 text-muted-foreground">
            تصلك رسالة على جوالك عند أول تحضير ناجح للمتدرب من داخل المؤسسة في يوم تدريبه. الإعداد اختياري ويمكن إيقافه في أي وقت.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={state.smsOnArrival}
          aria-label="رسالة نصية عند وصول المتدرب"
          disabled={busy}
          onClick={() => save(!state.smsOnArrival)}
          className={cn(
            "relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
            state.smsOnArrival ? "bg-qu-teal-600" : "bg-muted-foreground/30"
          )}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", state.smsOnArrival ? "start-[22px]" : "start-0.5")} />
        </button>
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="sup-phone">رقم الجوال</Label>
        <div className="flex gap-2">
          <Input id="sup-phone" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="text-left" />
          <Button type="button" variant="outline" disabled={busy || phone === state.phone} onClick={() => save(state.smsOnArrival)}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Check />} حفظ
          </Button>
        </div>
      </div>

      {msg && <p className={cn("rounded-md p-2 text-sm", msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>{msg.text}</p>}
      {state.smsOnArrival && !state.smsConfigured && (
        <p className="rounded-md bg-amber-50 p-2 text-xs leading-6 text-amber-800">
          تم حفظ اختيارك. يبدأ الإرسال الفعلي بعد تفعيل مزوّد الرسائل النصية من إدارة المنصة.
        </p>
      )}
    </div>
  );
}
