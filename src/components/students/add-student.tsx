"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";

type Result = { ok: boolean; text: string; email?: string; password?: string };

/** زر ونافذة لإضافة حساب طالب/ة (رئيس وحدة التدريب) */
export function AddStudent() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    start(async () => {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fd)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setResult({ ok: false, text: json.details?.[0]?.message ?? json.error ?? "تعذّر إنشاء الحساب" });
      setResult({
        ok: true,
        text: "تم إنشاء حساب الطالب. سلّم معرّف الدخول وكلمة المرور المؤقتة له — لن تظهر كلمة المرور مرة أخرى:",
        email: json.email,
        password: json.tempPassword,
      });
      form.reset();
      router.refresh();
    });
  };

  return (
    <>
      <Button onClick={() => { setResult(null); setOpen(true); }}><UserPlus /> إضافة طالب</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="إضافة طالب/ة" className="max-w-xl">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
          <div className="space-y-1">
            <Label htmlFor="st-name">الاسم الكامل</Label>
            <Input id="st-name" name="fullName" required minLength={3} placeholder="محمد العنزي" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-uid">الرقم الجامعي</Label>
            <Input id="st-uid" name="universityId" dir="ltr" required inputMode="numeric" pattern="\d{6,12}" placeholder="441100001" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-major">التخصص</Label>
            <Select id="st-major" name="major">
              <option value="SOCIAL_WORK">الخدمة الاجتماعية</option>
              <option value="SOCIOLOGY">علم الاجتماع</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-gender">الجنس</Label>
            <Select id="st-gender" name="gender"><option value="MALE">طالب</option><option value="FEMALE">طالبة</option></Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-city">المدينة</Label>
            <Input id="st-city" name="city" required placeholder="بريدة" defaultValue="بريدة" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-district">الحي <span className="text-muted-foreground">(اختياري)</span></Label>
            <Input id="st-district" name="district" placeholder="النهضة" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-phone">الجوال <span className="text-muted-foreground">(اختياري)</span></Label>
            <Input id="st-phone" name="phone" dir="ltr" placeholder="05XXXXXXXX" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="st-level">المستوى</Label>
              <Input id="st-level" name="level" type="number" min={1} max={12} defaultValue={7} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="st-gpa">المعدل <span className="text-muted-foreground">(اختياري)</span></Label>
              <Input id="st-gpa" name="gpa" type="number" step="0.01" min={0} max={5} dir="ltr" placeholder="4.25" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            معرّف الدخول يُشتق تلقائياً من الرقم الجامعي: <span dir="ltr" className="font-mono">&lt;الرقم&gt;@qu.edu.sa</span>
          </p>
          <Button type="submit" disabled={pending} className="md:col-span-2"><UserPlus /> {pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</Button>
          {result && (
            <div className={`rounded-md p-3 text-sm md:col-span-2 ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
              {result.text}
              {result.ok && (
                <div className="mt-2 grid gap-2">
                  <div><span className="text-xs text-emerald-700">معرّف الدخول</span><div dir="ltr" className="select-all rounded bg-white p-2 text-center font-mono">{result.email}</div></div>
                  <div><span className="text-xs text-emerald-700">كلمة المرور المؤقتة</span><div dir="ltr" className="select-all rounded bg-white p-2 text-center font-mono text-base">{result.password}</div></div>
                </div>
              )}
            </div>
          )}
        </form>
      </Dialog>
    </>
  );
}
