"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

/** توثيق زيارة إشرافية (حضورية مع إثبات الموقع، أو افتراضية مع رابط الاجتماع) */
export function VisitForm({ students }: { students: { placementId: string; name: string }[] }) {
  const router = useRouter();
  const [type, setType] = useState<"IN_PERSON" | "VIRTUAL">("IN_PERSON");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const res = await fetch("/api/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              placementId: fd.get("placementId"),
              type,
              visitDate: fd.get("visitDate"),
              meetingLink: type === "VIRTUAL" ? fd.get("meetingLink") : undefined,
              ...(type === "IN_PERSON" && coords ? coords : {}),
              summary: fd.get("summary"),
              recommendations: fd.get("recommendations") || undefined,
              studentRating: fd.get("studentRating") ? Number(fd.get("studentRating")) : undefined,
            }),
          });
          const json = await res.json();
          setMsg(res.ok ? "تم توثيق الزيارة" : json.details?.[0]?.message ?? json.error);
          if (res.ok) { form.reset(); setCoords(null); router.refresh(); }
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Select name="placementId" required aria-label="الطالب">
          {students.map((s) => <option key={s.placementId} value={s.placementId}>{s.name}</option>)}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value as "IN_PERSON" | "VIRTUAL")} aria-label="نوع الزيارة">
          <option value="IN_PERSON">زيارة حضورية</option>
          <option value="VIRTUAL">زيارة افتراضية</option>
        </Select>
      </div>
      <div className="space-y-1"><Label htmlFor="visitDate">موعد الزيارة</Label><Input id="visitDate" name="visitDate" type="datetime-local" required /></div>
      {type === "VIRTUAL" ? (
        <Input name="meetingLink" type="url" dir="ltr" placeholder="https://teams.microsoft.com/..." required />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => navigator.geolocation.getCurrentPosition((p) => setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => setMsg("تعذر تحديد الموقع"), { enableHighAccuracy: true })}>
          <LocateFixed /> {coords ? "تم إرفاق الموقع ✓" : "إرفاق موقعي الحالي كإثبات للزيارة"}
        </Button>
      )}
      <Textarea name="summary" placeholder="ملخص الزيارة وما تمت مناقشته" required minLength={10} />
      <Textarea name="recommendations" placeholder="التوصيات" />
      <Select name="studentRating" defaultValue="" aria-label="تقييم انطباعي">
        <option value="">تقييم انطباعي للطالب (اختياري)</option>
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
      </Select>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !students.length}>توثيق الزيارة</Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </form>
  );
}
