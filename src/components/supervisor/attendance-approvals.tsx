"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export interface PendingRecord {
  id: string;
  student: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  /** مدة مقترحة لاعتماد سجل بلا انصراف (حتى نهاية الدوام) */
  suggestedMinutes: number;
  distance: number | null;
  status: string;
  isSuspicious: boolean;
  riskFlags: string[];
}

type Pending =
  | { kind: "adjust"; record: PendingRecord }
  | { kind: "reject"; records: PendingRecord[] };

const duration = (m: number) => `${Math.floor(m / 60)}س ${m % 60}د`;

/**
 * جدول اعتماد الحضور اليومي للمشرف المؤسسي (فردي أو جماعي)
 * - السجل المكتمل (حضور وانصراف): اعتماد مباشر
 * - السجل بلا انصراف (نسي المتدرب أو ما زال في المؤسسة): اعتماد بعد تحديد مدة العمل
 * - الرفض: بسبب اختياري يصل للمتدرب
 */
export function AttendanceApprovals({ records, flagLabels }: { records: PendingRecord[]; flagLabels: Record<string, string> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dialog, setDialog] = useState<Pending | null>(null);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [note, setNote] = useState("");
  const complete = records.filter((r) => r.checkOut);

  const send = (ids: string[], decision: "APPROVED" | "REJECTED", extra: { note?: string; adjustedMinutes?: number } = {}, done?: string) =>
    start(async () => {
      setMsg(null);
      const res = await fetch("/api/attendance/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds: ids, decision, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: json.error ?? "تعذّر تنفيذ الإجراء" });
      setDialog(null);
      setSelected(new Set());
      setMsg({ ok: true, text: done ?? (decision === "APPROVED" ? `اعتُمد ${json.updated} سجل` : `رُفض ${json.updated} سجل`) });
      router.refresh();
    });

  const approve = (r: PendingRecord) => {
    if (r.checkOut) return send([r.id], "APPROVED");
    setHours(Math.floor(r.suggestedMinutes / 60));
    setMinutes(r.suggestedMinutes % 60);
    setMsg(null);
    setDialog({ kind: "adjust", record: r });
  };
  const reject = (rs: PendingRecord[]) => {
    setNote("");
    setMsg(null);
    setDialog({ kind: "reject", records: rs });
  };

  const approveSelected = () => {
    const chosen = records.filter((r) => selected.has(r.id));
    const ok = chosen.filter((r) => r.checkOut);
    const skipped = chosen.length - ok.length;
    if (!ok.length) return setMsg({ ok: false, text: "السجلات المحددة بلا انصراف: اعتمد كل سجل منها بزر ✓ لتحديد مدته" });
    send(ok.map((r) => r.id), "APPROVED", {}, `اعتُمد ${ok.length} سجل${skipped ? ` — ${skipped} بلا انصراف تحتاج تحديد المدة بزر ✓` : ""}`);
  };

  if (!records.length) return <p className="p-6 text-center text-sm text-muted-foreground">لا توجد سجلات بانتظار الاعتماد 👍</p>;

  const adjustTotal = hours * 60 + minutes;
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div data-attendance-approvals>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
        <Button size="sm" disabled={busy || selected.size === 0} onClick={approveSelected}>
          <Check /> اعتماد المحدد ({selected.size})
        </Button>
        <Button size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={() => reject(records.filter((r) => selected.has(r.id)))}>
          <X /> رفض المحدد
        </Button>
        <Button size="sm" variant="outline" disabled={busy || complete.filter((r) => !r.isSuspicious).length === 0} onClick={() => send(complete.filter((r) => !r.isSuspicious).map((r) => r.id), "APPROVED")}>
          اعتماد كل السجلات المكتملة غير المشتبه بها
        </Button>
        {busy && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
        {msg && !dialog && <span role="status" className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{msg.text}</span>}
      </div>
      <Table>
        <THead>
          <TR><TH className="w-8"><span className="sr-only">تحديد</span></TH><TH>الطالب/ة</TH><TH>التاريخ</TH><TH>حضور</TH><TH>انصراف</TH><TH>المدة</TH><TH>المسافة</TH><TH>التحقق</TH><TH>القرار</TH></TR>
        </THead>
        <TBody>
          {records.map((r) => (
            <TR key={r.id} data-record={r.id}>
              <TD>
                <input type="checkbox" aria-label={`تحديد ${r.student}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              </TD>
              <TD className="font-medium">{r.student}</TD>
              <TD className="whitespace-nowrap text-xs">{r.date}</TD>
              <TD className="whitespace-nowrap tabular-nums">{r.checkIn ?? "—"}{r.status === "LATE" && <Badge variant="warning" className="ms-1">متأخر</Badge>}</TD>
              <TD className="tabular-nums">{r.checkOut ?? <Badge variant="muted">لم ينصرف</Badge>}</TD>
              <TD className="tabular-nums">{r.workedMinutes ? duration(r.workedMinutes) : "—"}</TD>
              <TD className="tabular-nums">{r.distance != null ? `${Math.round(r.distance)} م` : "—"}</TD>
              <TD>
                {r.isSuspicious ? (
                  <Badge variant="destructive" title={r.riskFlags.map((f) => flagLabels[f] ?? f).join("، ")}><ShieldAlert className="size-3" /> مشتبه</Badge>
                ) : (
                  <Badge variant="success">سليم</Badge>
                )}
              </TD>
              <TD>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="size-8" disabled={busy} onClick={() => approve(r)}
                    aria-label={`اعتماد ${r.student}`} title={r.checkOut ? "اعتماد" : "اعتماد مع تحديد مدة العمل (لم يُسجَّل الانصراف)"}>
                    <Check className="text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" disabled={busy} onClick={() => reject([r])} aria-label={`رفض ${r.student}`} title="رفض">
                    <X className="text-red-600" />
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {dialog?.kind === "adjust" && (
        <Dialog open onClose={() => setDialog(null)} title="اعتماد الحضور وتحديد مدة العمل" className="max-w-md"
          description={`${dialog.record.student} — ${dialog.record.date}: سُجّل الحضور ${dialog.record.checkIn ?? "—"} ولم يُسجَّل الانصراف. حدّد مدة العمل الفعلية ثم اعتمد.`}>
          <div className="space-y-4 p-4 md:p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="adj-hours">الساعات</Label>
                <Input id="adj-hours" type="number" min={0} max={10} inputMode="numeric" value={hours} onChange={(e) => setHours(Math.max(0, Math.min(10, Number(e.target.value) || 0)))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-minutes">الدقائق</Label>
                <Input id="adj-minutes" type="number" min={0} max={59} step={5} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">المقترح: من وقت الحضور حتى نهاية دوام المؤسسة ({duration(dialog.record.suggestedMinutes)}).</p>
            {msg && !msg.ok && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{msg.text}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button>
              <Button disabled={busy || adjustTotal <= 0 || adjustTotal > 600} onClick={() => send([dialog.record.id], "APPROVED", { adjustedMinutes: adjustTotal }, `اعتُمد حضور ${dialog.record.student} (${duration(adjustTotal)})`)}>
                <Check /> اعتماد {duration(adjustTotal)}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {dialog?.kind === "reject" && (
        <Dialog open onClose={() => setDialog(null)} title={dialog.records.length > 1 ? `رفض ${dialog.records.length} سجلات حضور` : "رفض سجل الحضور"} className="max-w-md"
          description={dialog.records.length > 1 ? undefined : `${dialog.records[0].student} — ${dialog.records[0].date}`}>
          <div className="space-y-4 p-4 md:p-5">
            <div className="space-y-1.5">
              <Label htmlFor="reject-note">سبب الرفض (يظهر للمتدرب)</Label>
              <Textarea id="reject-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: لم يحضر فعلياً في هذا اليوم" />
            </div>
            {msg && !msg.ok && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{msg.text}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button>
              <Button variant="destructive" disabled={busy} onClick={() => send(dialog.records.map((r) => r.id), "REJECTED", { note: note.trim() || undefined })}>
                <X /> تأكيد الرفض
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
