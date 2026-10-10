"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, FileText, History, LoaderCircle, Shuffle, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export interface PlacementRow {
  id: string;
  student: string;
  universityId: string;
  major: string;
  gender: string;
  organization: string;
  organizationId: string;
  category: string;
  fieldSupervisor: string | null;
  fieldSupervisorId: string | null;
  academicSupervisor: string | null;
  status: string;
  statusLabel: string;
  letters: { id: string; type: string; serialNumber: string }[];
  sectionId: string | null;
  canTransfer: boolean;
  approvedHours: number;
}

export interface SectionOption { id: string; label: string; mode: "FIELD" | "SIMULATION" }

export interface TransferOrg {
  id: string;
  name: string;
  geofenceRadius: number;
  workStartTime: string;
  workEndTime: string;
  fieldSupervisors: { id: string; name: string }[];
}

export interface TransferHistoryItem {
  id: string;
  student: string;
  universityId: string;
  fromOrg: string;
  toOrg: string;
  fromSupervisor: string | null;
  toSupervisor: string | null;
  reason: string;
  carryOverHours: boolean;
  carriedHours: number;
  by: string;
  date: string;
}

const LETTER_TYPES = [
  { v: "REFERRAL", l: "خطاب توجيه" },
  { v: "COMMENCEMENT", l: "خطاب مباشرة" },
  { v: "COMPLETION", l: "إفادة إتمام" },
];

interface AssignPreview {
  assigned: { studentName: string; organizationName: string; reason: string }[];
  unassigned: { studentName: string }[];
}

export function PlacementsManager({ termId, rows, unplacedCount, sections, orgs, transfers }: { termId: string; rows: PlacementRow[]; unplacedCount: number; sections: SectionOption[]; orgs: TransferOrg[]; transfers: TransferHistoryItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [letterType, setLetterType] = useState("REFERRAL");
  const [preview, setPreview] = useState<AssignPreview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [transferRow, setTransferRow] = useState<PlacementRow | null>(null);
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
                <TH>الطالب/ة</TH><TH>التخصص</TH><TH>الشعبة</TH><TH>جهة التدريب</TH><TH>المشرف المؤسسي</TH><TH>المشرف الأكاديمي</TH><TH>الحالة</TH><TH>الخطابات</TH><TH></TH>
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
                  <TD>
                    {r.canTransfer && (
                      <Button variant="outline" size="sm" className="h-8 whitespace-nowrap text-xs" onClick={() => { setMsg(null); setTransferRow(r); }} data-transfer={r.universityId}>
                        <ArrowLeftRight className="size-3.5" /> نقل
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {transfers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><History className="size-5 text-qu-teal-700" /> سجل نقل الطلاب</CardTitle>
            <CardDescription>تاريخ إعادة التوزيع: المقر السابق والجديد وسبب النقل ومنفّذه — سجلات تاريخية محفوظة</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <THead><TR><TH>الطالب/ة</TH><TH>من مقر</TH><TH>إلى مقر</TH><TH>الساعات السابقة</TH><TH>السبب</TH><TH>نفّذ النقل</TH><TH>التاريخ</TH></TR></THead>
                <TBody>
                  {transfers.map((t) => (
                    <TR key={t.id} data-transfer-row={t.universityId}>
                      <TD><div className="font-medium">{t.student}</div><div className="text-xs tabular-nums text-muted-foreground">{t.universityId}</div></TD>
                      <TD className="text-xs">{t.fromOrg}{t.fromSupervisor && <div className="text-muted-foreground">{t.fromSupervisor}</div>}</TD>
                      <TD className="text-xs">{t.toOrg}{t.toSupervisor && <div className="text-muted-foreground">{t.toSupervisor}</div>}</TD>
                      <TD className="whitespace-nowrap text-xs">
                        {t.carryOverHours ? <Badge variant="teal">احتُسبت ({t.carriedHours} س)</Badge> : <Badge variant="muted">لم تُحتسب</Badge>}
                      </TD>
                      <TD className="max-w-xs text-xs text-muted-foreground">{t.reason}</TD>
                      <TD className="whitespace-nowrap text-xs">{t.by}</TD>
                      <TD className="whitespace-nowrap text-xs tabular-nums">{t.date}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <TransferDialog row={transferRow} orgs={orgs} onClose={() => setTransferRow(null)} onDone={(m) => { setTransferRow(null); setMsg(m); router.refresh(); }} />
    </div>
  );
}

/** نافذة نقل الطالب إلى مقر تدريب آخر */
function TransferDialog({ row, orgs, onClose, onDone }: { row: PlacementRow | null; orgs: TransferOrg[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [toOrg, setToOrg] = useState("");
  const [toFs, setToFs] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [carryOverHours, setCarryOverHours] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // عند فتح النافذة لصف جديد: تصفير الحقول
  const [lastId, setLastId] = useState<string | null>(null);
  if (row && row.id !== lastId) {
    setLastId(row.id);
    setToOrg(""); setToFs(""); setReason(""); setCarryOverHours(true); setErr(null);
    setEffectiveDate(new Date().toISOString().slice(0, 10));
  }

  const org = orgs.find((o) => o.id === toOrg);
  const supervisors = org?.fieldSupervisors ?? [];

  const submit = () =>
    start(async () => {
      setErr(null);
      if (!row) return;
      const res = await fetch(`/api/placements/${row.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toOrganizationId: toOrg, toFieldSupervisorId: toFs || null, reason: reason.trim(), effectiveDate, carryOverHours }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json.error ?? "تعذّر تنفيذ النقل");
      onDone(`تم نقل ${row.student} إلى ${org?.name ?? "المقر الجديد"} — بانتظار نموذج مباشرة جديد`);
    });

  return (
    <Dialog open={!!row} onClose={onClose} title={row ? `نقل الطالب: ${row.student}` : "نقل الطالب"} description="يؤرشف الإسناد الحالي كبيانات تاريخية، وينشئ إسناداً جديداً يبدأ بنموذج مباشرة جديد" className="max-w-xl">
      {row && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-qu-gray-50 p-3 text-sm dark:bg-muted/40">
            <div className="text-muted-foreground">المقر الحالي</div>
            <div className="font-medium">{row.organization}{row.fieldSupervisor && <span className="font-normal text-muted-foreground"> · {row.fieldSupervisor}</span>}</div>
            <div className="mt-1 text-xs text-muted-foreground">الساعات المنجزة حتى الآن: <b className="tabular-nums text-foreground">{row.approvedHours}</b> ساعة</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to-org">جهة التدريب الجديدة</Label>
            <Select id="to-org" value={toOrg} onChange={(e) => { setToOrg(e.target.value); setToFs(""); }}>
              <option value="">— اختر المقر الجديد —</option>
              {orgs.map((o) => <option key={o.id} value={o.id} disabled={o.id === row.organizationId}>{o.name}{o.id === row.organizationId ? " (المقر الحالي)" : ""}</option>)}
            </Select>
            {org && <p className="text-xs text-muted-foreground">نطاق GPS {org.geofenceRadius} م · الدوام {org.workStartTime}–{org.workEndTime} (تُطبَّق إعدادات المقر الجديد من تاريخ النقل)</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="to-fs">المشرف المؤسسي الجديد</Label>
            <Select id="to-fs" value={toFs} onChange={(e) => setToFs(e.target.value)} disabled={!org}>
              <option value="">{org ? "— بلا مشرف الآن (يُضاف لاحقاً) —" : "اختر المقر أولاً"}</option>
              {supervisors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eff-date">تاريخ سريان النقل</Label>
            <Input id="eff-date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">احتساب ساعات المقر القديم ({row.approvedHours} ساعة)</legend>
            <label className="flex items-start gap-2 rounded-lg border p-2.5 text-sm has-[:checked]:border-qu-teal-400 has-[:checked]:bg-qu-teal-500/10">
              <input type="radio" name="carry" checked={carryOverHours} onChange={() => setCarryOverHours(true)} className="mt-0.5" />
              <span>تُحتسب للطالب — يطالبه المقر الجديد بالساعات المتبقية فقط</span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border p-2.5 text-sm has-[:checked]:border-qu-teal-400 has-[:checked]:bg-qu-teal-500/10">
              <input type="radio" name="carry" checked={!carryOverHours} onChange={() => setCarryOverHours(false)} className="mt-0.5" />
              <span>تبدأ من الصفر في المقر الجديد — تبقى ساعات القديم مؤرشفة للاطلاع</span>
            </label>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="reason">سبب النقل</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: إغلاق قسم الخدمة الاجتماعية بالمؤسسة، أو بناءً على طلب الجهة" rows={3} />
          </div>

          {err && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</p>}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={onClose} disabled={pending}>إلغاء</Button>
            <Button onClick={submit} disabled={pending || !toOrg || reason.trim().length < 5}>
              {pending ? <LoaderCircle className="animate-spin" /> : <ArrowLeftRight />} تأكيد النقل
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
