"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

/** نموذج السجل اليومي / الأسبوعي للطالب */
export function LogbookForm({ major }: { major: "SOCIOLOGY" | "SOCIAL_WORK" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [type, setType] = useState<"DAILY" | "WEEKLY">("WEEKLY");
  const today = new Date().toISOString().slice(0, 10);

  const hint =
    major === "SOCIAL_WORK"
      ? "مثال: مقابلة أولية مع حالة، جمع بيانات دراسة الحالة، المشاركة في لجنة الحالات، تنفيذ خطة التدخل..."
      : "مثال: تطبيق استمارة المسح الاجتماعي، ملاحظة بالمشاركة، تحليل بيانات ميدانية، مقابلات بؤرية...";

  function submit(form: HTMLFormElement, send: boolean) {
    const fd = new FormData(form);
    const body = {
      type,
      periodStart: fd.get("periodStart"),
      periodEnd: type === "DAILY" ? fd.get("periodStart") : fd.get("periodEnd"),
      weekNumber: fd.get("weekNumber") ? Number(fd.get("weekNumber")) : undefined,
      activities: fd.get("activities"),
      skills: fd.get("skills") || undefined,
      challenges: fd.get("challenges") || undefined,
      reflections: fd.get("reflections") || undefined,
      plannedNext: fd.get("plannedNext") || undefined,
      submit: send,
    };
    start(async () => {
      const res = await fetch("/api/logbooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) return setMsg({ ok: false, text: json.details?.[0]?.message ?? json.error });
      setMsg({ ok: true, text: send ? "تم رفع السجل للمشرف الميداني للتوقيع" : "تم حفظ المسودة" });
      if (send) form.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>سجل جديد</CardTitle>
        <CardDescription>يُرفع للمشرف الميداني للتوقيع الإلكتروني ثم يراجعه المشرف الأكاديمي</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget, true); }}>
          <div className="space-y-2">
            <Label>نوع السجل</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as "DAILY" | "WEEKLY")}>
              <option value="WEEKLY">أسبوعي</option>
              <option value="DAILY">يومي</option>
            </Select>
          </div>
          {type === "WEEKLY" && (
            <div className="space-y-2">
              <Label htmlFor="weekNumber">رقم الأسبوع</Label>
              <Input id="weekNumber" name="weekNumber" type="number" min={1} max={30} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="periodStart">{type === "DAILY" ? "التاريخ" : "من"}</Label>
            <Input id="periodStart" name="periodStart" type="date" defaultValue={today} required />
          </div>
          {type === "WEEKLY" && (
            <div className="space-y-2">
              <Label htmlFor="periodEnd">إلى</Label>
              <Input id="periodEnd" name="periodEnd" type="date" defaultValue={today} required />
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="activities">الأنشطة والمهام المنفذة *</Label>
            <Textarea id="activities" name="activities" required minLength={20} placeholder={hint} className="min-h-32" />
          </div>
          <div className="space-y-2"><Label htmlFor="skills">المهارات المهنية المكتسبة</Label><Textarea id="skills" name="skills" /></div>
          <div className="space-y-2"><Label htmlFor="challenges">الصعوبات وكيفية التعامل معها</Label><Textarea id="challenges" name="challenges" /></div>
          <div className="space-y-2"><Label htmlFor="reflections">التأمل المهني وربط النظرية بالتطبيق</Label><Textarea id="reflections" name="reflections" /></div>
          <div className="space-y-2"><Label htmlFor="plannedNext">خطة الفترة القادمة</Label><Textarea id="plannedNext" name="plannedNext" /></div>
          {msg && <p className={`rounded-md p-2 text-sm md:col-span-2 ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Send />} رفع للمشرف</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={(e) => submit(e.currentTarget.form!, false)}><Save /> حفظ مسودة</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
