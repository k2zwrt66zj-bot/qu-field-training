"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";

export interface AcademicEditData {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  gender: "MALE" | "FEMALE" | null;
  academicRank: string | null;
  maxStudents: number;
  isActive: boolean;
}

const RANKS = ["أستاذ", "أستاذ مشارك", "أستاذ مساعد", "محاضر", "معيد"];

/** زر ونافذة لتعديل بيانات مشرف أكاديمي (رئيسة الوحدة) */
export function AcademicEdit({ sup }: { sup: AcademicEditData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (fd: FormData, isActive: boolean) =>
    start(async () => {
      setErr(null);
      const res = await fetch(`/api/academic-supervisors/${sup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fd.get("fullName"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          gender: fd.get("gender"),
          academicRank: fd.get("academicRank"),
          maxStudents: Number(fd.get("maxStudents")),
          isActive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json.details?.[0]?.message ?? json.error ?? "تعذّر الحفظ");
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <Button variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => { setErr(null); setOpen(true); }} aria-label={`تعديل ${sup.fullName}`}>
        <Pencil className="size-3.5" /> تعديل
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`تعديل المشرف الأكاديمي: ${sup.fullName}`} className="max-w-lg">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget), sup.isActive); }}>
          <div className="space-y-1"><Label htmlFor="a-name">الاسم</Label><Input id="a-name" name="fullName" defaultValue={sup.fullName} required minLength={3} /></div>
          <div className="space-y-1"><Label htmlFor="a-email">البريد الإلكتروني</Label><Input id="a-email" name="email" type="email" dir="ltr" defaultValue={sup.email} required /></div>
          <div className="space-y-1"><Label htmlFor="a-phone">الجوال</Label><Input id="a-phone" name="phone" dir="ltr" defaultValue={sup.phone ?? ""} /></div>
          <div className="space-y-1">
            <Label htmlFor="a-gender">الجنس</Label>
            <Select id="a-gender" name="gender" defaultValue={sup.gender ?? "MALE"}><option value="MALE">ذكر</option><option value="FEMALE">أنثى</option></Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="a-rank">الرتبة العلمية</Label>
            <Select id="a-rank" name="academicRank" defaultValue={sup.academicRank ?? ""}>
              <option value="">— غير محددة —</option>
              {RANKS.map((rk) => <option key={rk} value={rk}>{rk}</option>)}
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="a-max">الحد الأقصى للمتدربين</Label><Input id="a-max" name="maxStudents" type="number" min={1} max={50} defaultValue={sup.maxStudents} required /></div>
          {err && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700 md:col-span-2 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3 md:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : null} حفظ التعديلات</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>إلغاء</Button>
            <Button
              type="button"
              variant={sup.isActive ? "outline" : "teal"}
              disabled={pending}
              className="ms-auto"
              onClick={(e) => save(new FormData(e.currentTarget.closest("form") as HTMLFormElement), !sup.isActive)}
            >
              {sup.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
