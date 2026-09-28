"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export interface PendingRecord {
  id: string;
  student: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  distance: number | null;
  status: string;
  isSuspicious: boolean;
  riskFlags: string[];
}

/** جدول اعتماد الحضور اليومي للمشرف الميداني (فردي أو جماعي) */
export function AttendanceApprovals({ records, flagLabels }: { records: PendingRecord[]; flagLabels: Record<string, string> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ready = records.filter((r) => r.checkOut);

  const decide = (ids: string[], decision: "APPROVED" | "REJECTED") =>
    start(async () => {
      setError(null);
      const note = decision === "REJECTED" ? prompt("سبب الرفض (اختياري)") ?? undefined : undefined;
      const res = await fetch("/api/attendance/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds: ids, decision, note }),
      });
      if (!res.ok) setError((await res.json()).error);
      setSelected(new Set());
      router.refresh();
    });

  if (!records.length) return <p className="p-6 text-center text-sm text-muted-foreground">لا توجد سجلات بانتظار الاعتماد 👍</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
        <Button size="sm" disabled={pending || selected.size === 0} onClick={() => decide([...selected], "APPROVED")}>
          <Check /> اعتماد المحدد ({selected.size})
        </Button>
        <Button size="sm" variant="outline" disabled={pending || ready.length === 0} onClick={() => decide(ready.filter((r) => !r.isSuspicious).map((r) => r.id), "APPROVED")}>
          اعتماد كل السجلات المكتملة غير المشتبه بها
        </Button>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
      <Table>
        <THead>
          <TR><TH className="w-8"></TH><TH>الطالب/ة</TH><TH>التاريخ</TH><TH>حضور</TH><TH>انصراف</TH><TH>المدة</TH><TH>المسافة</TH><TH>التحقق</TH><TH></TH></TR>
        </THead>
        <TBody>
          {records.map((r) => (
            <TR key={r.id}>
              <TD>
                <input type="checkbox" disabled={!r.checkOut} aria-label={`تحديد ${r.student}`} checked={selected.has(r.id)}
                  onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
              </TD>
              <TD className="font-medium">{r.student}</TD>
              <TD className="whitespace-nowrap text-xs">{r.date}</TD>
              <TD className="whitespace-nowrap tabular-nums">{r.checkIn ?? "—"}{r.status === "LATE" && <Badge variant="warning" className="ms-1">متأخر</Badge>}</TD>
              <TD className="tabular-nums">{r.checkOut ?? <Badge variant="muted">لم ينصرف</Badge>}</TD>
              <TD className="tabular-nums">{r.workedMinutes ? `${Math.floor(r.workedMinutes / 60)}س ${r.workedMinutes % 60}د` : "—"}</TD>
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
                  <Button size="icon" variant="ghost" className="size-8" disabled={pending || !r.checkOut} onClick={() => decide([r.id], "APPROVED")} aria-label="اعتماد"><Check className="text-emerald-600" /></Button>
                  <Button size="icon" variant="ghost" className="size-8" disabled={pending} onClick={() => decide([r.id], "REJECTED")} aria-label="رفض"><X className="text-red-600" /></Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
