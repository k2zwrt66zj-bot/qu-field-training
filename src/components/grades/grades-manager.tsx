"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Download, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export interface GradeRow {
  placementId: string;
  student: string;
  universityId: string;
  organization: string;
  field: number | null;
  academic: number | null;
  attendance: number | null;
  total: number | null;
  letter: string | null;
  status: "CALCULATED" | "APPROVED" | "PUBLISHED" | null;
  missing: string[];
  /** التدريب بالمحاكاة: لا مشرف مؤسسي، ووزنه منقول إلى الأكاديمي */
  simulation: boolean;
}

export function GradesManager({ termId, rows, weights }: { termId: string; rows: GradeRow[]; weights: { f: number; a: number; t: number } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const approvable = rows.filter((r) => r.status === "CALCULATED" && r.missing.length === 0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const post = (url: string, body: object, ok: (j: Record<string, number>) => string) =>
    start(async () => {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      setMsg(res.ok ? { ok: true, text: ok(json) } : { ok: false, text: json.error });
      setSelected(new Set());
      router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>رصد واعتماد الدرجات النهائية</CardTitle>
          <CardDescription>
            المشرف الميداني {weights.f}% + المشرف الأكاديمي {weights.a}% + التحضير والسجلات {weights.t}%
            {rows.some((r) => r.simulation) && <> · المحاكاة: المشرف الأكاديمي {weights.f + weights.a}% + السجلات {weights.t}%</>}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={() => post("/api/grades/calculate", { termId }, (j) => `تم احتساب ${j.calculated} درجة (${j.incomplete} بتقييمات ناقصة)`)}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Calculator />} احتساب الدرجات
          </Button>
          <Button disabled={pending || selected.size === 0} onClick={() => post("/api/grades/approve", { placementIds: [...selected], publish: true }, (j) => `تم اعتماد ونشر ${j.approved} نتيجة`)}>
            <ShieldCheck /> اعتماد المحدد ({selected.size})
          </Button>
          <a className={buttonVariants({ variant: "teal" })} href={`/api/grades/export?termId=${termId}`}><Download /> كشف الدرجات</a>
        </div>
      </CardHeader>
      {msg && <p className={`mx-5 mb-3 rounded-md p-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR>
              <TH className="w-8">
                <input type="checkbox" aria-label="تحديد كل القابل للاعتماد" checked={approvable.length > 0 && selected.size === approvable.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(approvable.map((r) => r.placementId)) : new Set())} />
              </TH>
              <TH>الطالب/ة</TH><TH>الجهة</TH><TH>الميداني ({weights.f})</TH><TH>الأكاديمي ({weights.a})</TH><TH>التحضير ({weights.t})</TH><TH>المجموع</TH><TH>التقدير</TH><TH>الحالة</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const canApprove = r.status === "CALCULATED" && r.missing.length === 0;
              return (
                <TR key={r.placementId}>
                  <TD>
                    <input type="checkbox" disabled={!canApprove} aria-label={`تحديد ${r.student}`} checked={selected.has(r.placementId)}
                      onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.placementId)) n.delete(r.placementId); else n.add(r.placementId); return n; })} />
                  </TD>
                  <TD>
                    <div className="font-medium">{r.student}</div>
                    <div className="text-xs text-muted-foreground">{r.universityId}{r.simulation && <Badge variant="teal" className="ms-2">محاكاة</Badge>}</div>
                  </TD>
                  <TD className="text-xs">{r.organization}</TD>
                  <TD className="tabular-nums">{r.simulation ? <span className="text-xs text-muted-foreground">لا ينطبق</span> : r.field ?? "—"}</TD>
                  <TD className="tabular-nums">
                    {r.academic ?? "—"}
                    {r.simulation && <span className="ms-1 text-xs text-muted-foreground">من {weights.f + weights.a}</span>}
                  </TD>
                  <TD className="tabular-nums">{r.attendance ?? "—"}</TD>
                  <TD className="font-bold tabular-nums">{r.total ?? "—"}</TD>
                  <TD dir="ltr" className="text-right font-semibold">{r.letter ?? "—"}</TD>
                  <TD>
                    {r.status == null ? <Badge variant="muted">لم تُحتسب</Badge>
                      : r.status !== "CALCULATED" ? <Badge variant="success">معتمدة</Badge>
                      : r.missing.length ? <Badge variant="warning" title={r.missing.join("، ")}>ناقص: {r.missing.join("، ")}</Badge>
                      : <Badge variant="teal">جاهزة للاعتماد</Badge>}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
