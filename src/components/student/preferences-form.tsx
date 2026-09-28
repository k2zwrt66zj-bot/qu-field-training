"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { ORG_CATEGORY_LABELS } from "@/lib/labels";

interface Props {
  initial: { city: string; district: string | null; hasLocation: boolean; categories: string[] };
}

/** تسجيل مكان السكن ورغبات التدريب (3 رغبات مرتبة) */
export function PreferencesForm({ initial }: Props) {
  const router = useRouter();
  const [coords, setCoords] = useState<{ homeLat: number; homeLng: number } | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>بياناتي الجغرافية ورغبات التدريب</CardTitle>
        <CardDescription>تُستخدم في التوزيع الآلي: تُراعى الرغبات بالترتيب ثم قرب الجهة من سكنك</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const preferences = [1, 2, 3].map((i) => fd.get(`pref${i}`)).filter(Boolean).map((c) => ({ category: c }));
            start(async () => {
              const res = await fetch("/api/preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ city: fd.get("city"), district: fd.get("district") || undefined, ...(coords ?? {}), preferences }),
              });
              const json = await res.json();
              setMsg(res.ok ? { ok: true, text: "تم حفظ رغباتك" } : { ok: false, text: json.details?.[0]?.message ?? json.error });
              if (res.ok) router.refresh();
            });
          }}
        >
          <div className="space-y-1"><Label htmlFor="city">المدينة</Label><Input id="city" name="city" defaultValue={initial.city} required /></div>
          <div className="space-y-1"><Label htmlFor="district">الحي</Label><Input id="district" name="district" defaultValue={initial.district ?? ""} /></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <Label htmlFor={`pref${i}`}>الرغبة {i === 1 ? "الأولى" : i === 2 ? "الثانية" : "الثالثة"}</Label>
              <Select id={`pref${i}`} name={`pref${i}`} defaultValue={initial.categories[i - 1] ?? ""} required={i === 1}>
                <option value="">— اختر مجال التدريب —</option>
                {Object.entries(ORG_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
          ))}
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => navigator.geolocation.getCurrentPosition(
              (p) => setCoords({ homeLat: p.coords.latitude, homeLng: p.coords.longitude }),
              () => setMsg({ ok: false, text: "تعذر تحديد الموقع" }))}>
              <LocateFixed /> {coords || initial.hasLocation ? "تم تحديد موقع السكن ✓" : "تحديد موقع السكن (من المنزل)"}
            </Button>
          </div>
          {msg && <p className={`rounded-md p-2 text-sm md:col-span-2 ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
          <Button type="submit" disabled={pending} className="md:col-span-2">حفظ البيانات والرغبات</Button>
        </form>
      </CardContent>
    </Card>
  );
}
