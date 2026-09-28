"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle, Shuffle, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export interface PlacementRow {
  id: string;
  student: string;
  universityId: string;
  major: string;
  gender: string;
  organization: string;
  category: string;
  fieldSupervisor: string | null;
  academicSupervisor: string | null;
  status: string;
  statusLabel: string;
  letters: { id: string; type: string; serialNumber: string }[];
  sectionId: string | null;
}

export interface SectionOption { id: string; label: string; mode: "FIELD" | "SIMULATION" }

const LETTER_TYPES = [
  { v: "REFERRAL", l: "خطاب توجيه" },
  { v: "COMMENCEMENT", l: "خطاب مباشرة" },
  { v: "COMPLETION", l: "إفادة إتمام" },
];

interface AssignPreview {
  assigned: { studentName: string; organizationName: string; reason: string }[];
  unassigned: { studentName: string }[];
}

export function PlacementsManager({ termId, rows, unplacedCount, sections }: { termId: string; rows: PlacementRow[]; unplacedCount: number; sections: SectionOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [letterType, setLetterType] = useState("REFERRAL");
  const [preview, setPreview] = useState<AssignPreview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const assign = (dryRun: boolean) =>
    start(async () => {
      const res = await fetch("/api/placements/auto-assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ termId, dryRun }) });
      const json = await res.json();
      if (!res.ok) return setMsg(json.error);
      if (dryRun) setPreview(json);
      else {
        setPreview(null);
        setMsg(`تم توزيع ${json.assigned.length} طالب/طالبة`);
        router.refresh();
      }
    });

  const issue = () =>
    start(async () => {
      const res = await fetch("/api/letters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placementIds: [...selected], type: letterType }) });
      const json = await res.json();
      if (!res.ok) return setMsg(json.error);
      setMsg(`تم إصدار ${json.letters.length} خطاب`);
      if (json.letters.length === 1) window.open(json.letters[0].url, "_blank");
      setSelected(new Set());
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shuffle className="size-5 text-primary" /> التوزيع الآلي</CardTitle>
          <CardDescription>
            {unplacedCount} طالب/طالبة بلا جهة تدريب. يراعي التوزيع الرغبات بالترتيب، المعدل، الطاقة الاستيعابية لكل جنس، التخصص، وقرب الجهة من السكن.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={pending || unplacedCount === 0} onClick={() => assign(true)}>
              {pending ? <LoaderCircle className="animate-spin" /> : <WandSparkles />} معاينة التوزيع
            </Button>
            {preview && preview.assigned.length > 0 && (
              <Button disabled={pending} onClick={() => assign(false)}>اعتماد التوزيع ({preview.assigned.length})</Button>
            )}
          </div>
          {preview && (
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              <Table>
                <THead><TR><TH>الطالب/ة</TH><TH>الجهة المقترحة</TH><TH>السبب</TH></TR></THead>
                <TBody>
                  {preview.assigned.map((a) => (
                    <TR key={a.studentName}><TD>{a.studentName}</TD><TD>{a.organizationName}</TD><TD><Badge variant="muted">{a.reason}</Badge></TD></TR>
                  ))}
                  {preview.unassigned.map((a) => (
                    <TR key={a.studentName}><TD>{a.studentName}</TD><TD colSpan={2}><Badge variant="destructive">لا توجد جهة متاحة - يحتاج توزيعاً يدوياً</Badge></TD></TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>الإسنادات والخطابات الرسمية</CardTitle>
            <CardDescription>حدد الطلاب ثم أصدر الخطاب؛ يحمل الخطاب شعار الجامعة وتوقيع رئيس الوحدة ورئيس القسم ورمز تحقق QR</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={letterType} onChange={(e) => setLetterType(e.target.value)} className="w-40">
              {LETTER_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </Select>
            <Button variant="teal" disabled={pending || selected.size === 0} onClick={issue}>
              <FileText /> إصدار ({selected.size})
            </Button>
          </div>
        </CardHeader>
        {msg && <p className="mx-5 mb-3 rounded-md bg-accent p-2 text-sm">{msg}</p>}
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-8"><input type="checkbox" aria-label="تحديد الكل" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} /></TH>
                <TH>الطالب/ة</TH><TH>التخصص</TH><TH>الشعبة</TH><TH>جهة التدريب</TH><TH>المشرف الميداني</TH><TH>المشرف الأكاديمي</TH><TH>الحالة</TH><TH>الخطابات</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id} data-state={selected.has(r.id) ? "selected" : undefined} className="data-[state=selected]:bg-accent">
                  <TD><input type="checkbox" aria-label={`تحديد ${r.student}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></TD>
                  <TD><div className="font-medium">{r.student}</div><div className="text-xs text-muted-foreground">{r.universityId} · {r.gender}</div></TD>
                  <TD className="text-xs">{r.major}</TD>
                  <TD>
                    <select
                      aria-label={`شعبة ${r.student}`}
                      className="h-8 max-w-40 rounded-md border border-input bg-card px-2 text-xs"
                      value={r.sectionId ?? ""}
                      disabled={pending}
                      onChange={(e) =>
                        start(async () => {
                          const res = await fetch(`/api/placements/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId: e.target.value || null }) });
                          setMsg(res.ok ? "تم تحديث الشعبة" : (await res.json()).error);
                          router.refresh();
                        })
                      }
                    >
                      <option value="">— بلا شعبة (ميداني) —</option>
                      {sections.map((s) => <option key={s.id} value={s.id}>{s.label}{s.mode === "SIMULATION" ? " · محاكاة" : ""}</option>)}
                    </select>
                  </TD>
                  <TD><div>{r.organization}</div><div className="text-xs text-muted-foreground">{r.category}</div></TD>
                  <TD className="text-xs">{r.fieldSupervisor ?? <Badge variant="warning">غير محدد</Badge>}</TD>
                  <TD className="text-xs">{r.academicSupervisor ?? <Badge variant="warning">غير محدد</Badge>}</TD>
                  <TD><Badge variant={r.status === "ACTIVE" ? "success" : r.status === "COMPLETED" ? "default" : "muted"}>{r.statusLabel}</Badge></TD>
                  <TD>
                    <div className="flex flex-col gap-1">
                      {r.letters.map((l) => (
                        <a key={l.id} href={`/letters/${l.id}`} target="_blank" className="text-xs text-primary hover:underline">
                          {LETTER_TYPES.find((t) => t.v === l.type)?.l} · {l.serialNumber}
                        </a>
                      ))}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
