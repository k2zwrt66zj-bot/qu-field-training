"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export interface SectionRow {
  id: string;
  courseName: string;
  courseCode: string | null;
  sectionNumber: string;
  trainingNumber: number;
  track: string | null;
  mode: "FIELD" | "SIMULATION";
  students: number;
}

/** الشعب الدراسية: تحدد نوع التدريب (ميداني / بالمحاكاة) لطلابها */
export function SectionsManager({ termId, sections }: { termId: string; sections: SectionRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = (url: string, method: string, body: object, ok: string) =>
    start(async () => {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      setMsg(res.ok ? { ok: true, text: ok } : { ok: false, text: json.details?.[0]?.message ?? json.error });
      if (res.ok) router.refresh();
    });

  return (
    <div className="space-y-4">
      <Table>
        <THead><TR><TH>المقرر</TH><TH>الشعبة</TH><TH>التدريب رقم</TH><TH>المسار</TH><TH>نوع التدريب</TH><TH>الطلاب</TH></TR></THead>
        <TBody>
          {sections.length === 0 && <TR><TD colSpan={6} className="py-6 text-center text-muted-foreground">لا توجد شعب بعد — الطلاب بلا شعبة يُعاملون كتدريب ميداني</TD></TR>}
          {sections.map((s) => (
            <TR key={s.id}>
              <TD><div className="font-medium">{s.courseName}</div>{s.courseCode && <div dir="ltr" className="text-right text-xs text-muted-foreground">{s.courseCode}</div>}</TD>
              <TD className="tabular-nums">{s.sectionNumber}</TD>
              <TD className="tabular-nums">{s.trainingNumber}</TD>
              <TD className="text-xs">{s.track ?? "—"}</TD>
              <TD>
                <Select
                  aria-label={`نوع تدريب الشعبة ${s.sectionNumber}`}
                  className="h-9 w-44"
                  value={s.mode}
                  disabled={pending}
                  onChange={(e) =>
                    send(`/api/sections/${s.id}`, "PATCH", { courseName: s.courseName, courseCode: s.courseCode, sectionNumber: s.sectionNumber, trainingNumber: s.trainingNumber, track: s.track, mode: e.target.value }, "تم تحديث نوع التدريب")
                  }
                >
                  <option value="FIELD">ميداني</option>
                  <option value="SIMULATION">بالمحاكاة</option>
                </Select>
              </TD>
              <TD><Badge variant={s.mode === "SIMULATION" ? "teal" : "muted"}>{s.students}</Badge></TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <form
        className="grid gap-3 rounded-lg bg-muted/50 p-4 md:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const form = e.currentTarget;
          send("/api/sections", "POST", {
            termId,
            courseName: fd.get("courseName"),
            courseCode: fd.get("courseCode") || null,
            sectionNumber: fd.get("sectionNumber"),
            trainingNumber: Number(fd.get("trainingNumber")),
            track: fd.get("track") || null,
            mode: fd.get("mode"),
          }, "تمت إضافة الشعبة");
          form.reset();
        }}
      >
        <div className="space-y-1 md:col-span-2"><Label htmlFor="sec-course">اسم المقرر</Label><Input id="sec-course" name="courseName" required placeholder="التدريب الميداني (1)" /></div>
        <div className="space-y-1"><Label htmlFor="sec-code">رمز المقرر</Label><Input id="sec-code" name="courseCode" dir="ltr" placeholder="SOC 481" /></div>
        <div className="space-y-1"><Label htmlFor="sec-number">رقم الشعبة</Label><Input id="sec-number" name="sectionNumber" required /></div>
        <div className="space-y-1"><Label htmlFor="sec-training">تدريب رقم</Label><Input id="sec-training" name="trainingNumber" type="number" min={1} max={4} defaultValue={1} required /></div>
        <div className="space-y-1">
          <Label htmlFor="sec-mode">نوع التدريب</Label>
          <Select id="sec-mode" name="mode"><option value="FIELD">ميداني</option><option value="SIMULATION">بالمحاكاة</option></Select>
        </div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="sec-track">المسار</Label><Input id="sec-track" name="track" /></div>
        <div className="flex items-end md:col-span-4">
          <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Plus />} إضافة شعبة</Button>
          {msg && <span role="status" className={`ms-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        طلاب شعب المحاكاة: لا نموذج مباشرة، ولا تقرير تعريفي بالمؤسسة، ولا تحضير جغرافي؛ وتُعتمد نماذجهم من المشرف الأكاديمي مباشرة.
      </p>
    </div>
  );
}
