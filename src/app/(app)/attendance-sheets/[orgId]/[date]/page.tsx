import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileDown, ChevronLeft, ChevronRight, CircleAlert, MapPin, ShieldAlert, ShieldCheck } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "@/components/attendance/print-button";
import { SignSheetButton } from "@/components/attendance/sign-sheet-button";
import { loadSheet } from "@/server/attendance-sheets";
import { WEEKDAY_LABELS } from "@/lib/forms/catalog";
import { ATTENDANCE_STATUS_LABELS, INSTITUTION } from "@/lib/labels";
import { formatTimeAr } from "@/lib/time";

export const metadata = { title: "كشف الحضور والانصراف" };
export const dynamic = "force-dynamic";

const arDate = (s: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`));
const shift = (s: string, days: number) => new Date(new Date(`${s}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

export default async function SheetPage({ params }: { params: Promise<{ orgId: string; date: string }> }) {
  const user = await requirePageRole("FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR", "TRAINING_HEAD", "DEPARTMENT_HEAD");
  const { orgId, date } = await params;
  const s = await loadSheet(user, orgId, date).catch((e) => {
    if (e instanceof ApiError) return null;
    throw e;
  });
  if (!s) notFound();
  const h = s.header;
  const headerRows: [string, string | number | null, string, string | number | null][] = [
    ["اسم المؤسسة", h.organization, "رقم هاتف المؤسسة", h.phone],
    ["اسم مدير المؤسسة", h.director, "البريد الالكتروني للمؤسسة", h.email],
    ["اسم المشرف المؤسسي", h.fieldSupervisors, "إجمالي عدد المتدربين بالمؤسسة", h.trainees],
    ["اسم المشرف الأكاديمي", h.academicSupervisors, "تاريخ بدء التدريب", h.startDate && arDate(h.startDate)],
    ["عنوان المؤسسة", h.address, "تاريخ إنتهاء التدريب", h.endDate && arDate(h.endDate)],
  ];
  const studentSig = (r: (typeof s.rows)[number]) =>
    !r.record ? "—" : r.record.geo ? <span className="inline-flex items-center gap-1 text-emerald-700"><MapPin className="size-3.5" /> تحضير جغرافي</span> : <span className="text-muted-foreground">يدوي</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/attendance-sheets?org=${orgId}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="size-4" /> كشوف الحضور اليومية</Link>
        <div className="flex gap-2 text-sm">
          <Link href={`/attendance-sheets/${orgId}/${shift(date, -1)}`} className="flex items-center gap-1 rounded-md border px-2.5 py-1 hover:bg-muted"><ChevronRight className="size-4" /> اليوم السابق</Link>
          {!s.isToday && <Link href={`/attendance-sheets/${orgId}/${shift(date, 1)}`} className="flex items-center gap-1 rounded-md border px-2.5 py-1 hover:bg-muted">اليوم التالي <ChevronLeft className="size-4" /></Link>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <article className="min-w-0 space-y-4 rounded-xl border bg-card p-4 md:p-6">
          <header className="text-center">
            <div className="text-xs text-muted-foreground">{INSTITUTION.university} — {INSTITUTION.college} — {INSTITUTION.department}</div>
            <h1 className="mt-2 text-lg font-bold text-qu-navy-800 md:text-xl">سجل الحضور والانصراف لمتدربين قسم الاجتماع والخدمة الاجتماعية بجامعة القصيم</h1>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border text-sm">
              <tbody>
                {headerRows.map(([k1, v1, k2, v2]) => (
                  <tr key={k1} className="border-b">
                    <th className="w-40 bg-qu-navy-700 p-2 text-start text-xs font-medium text-white">{k1}</th>
                    <td className="p-2">{v1 ?? "—"}</td>
                    <th className="w-44 bg-qu-navy-700 p-2 text-start text-xs font-medium text-white">{k2}</th>
                    <td className="p-2 tabular-nums">{v2 ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex flex-wrap gap-x-8 gap-y-1 text-sm font-medium">
            <span>الأسبوع / <span className="tabular-nums">{s.weekNumber ?? "—"}</span></span>
            <span>اليوم / {WEEKDAY_LABELS[s.weekday]}</span>
            <span>التاريخ / {arDate(s.date)}</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border text-sm" aria-label="الحضور والانصراف">
              <thead className="bg-qu-navy-700 text-xs text-white">
                <tr>{["م", "اسم الطالب/ـة", "وقت الحضور", "التوقيع", "وقت الانصراف", "التوقيع"].map((c, i) => <th key={i} className="p-2 text-start font-medium">{c}</th>)}</tr>
              </thead>
              <tbody>
                {s.rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">ليس يوم تدريب لأي متدرب في هذه المؤسسة</td></tr>}
                {s.rows.map((r, i) => {
                  const present = !!r.record && ["PRESENT", "LATE"].includes(r.record.status);
                  return (
                    <tr key={r.placementId} className="border-t align-top odd:bg-qu-gray-100/60" data-row={r.universityId}>
                      <td className="p-2 tabular-nums">{i + 1}</td>
                      <td className="p-2">
                        <div className="font-medium">{r.name}</div>
                        {!r.record && <Badge variant="muted">لم يُسجَّل حضور</Badge>}
                        {r.record && !present && <Badge variant={r.record.status === "ABSENT" ? "destructive" : "muted"}>{ATTENDANCE_STATUS_LABELS[r.record.status]}</Badge>}
                        {r.record?.status === "LATE" && <Badge variant="warning">متأخر</Badge>}
                        {r.record?.isSuspicious && <Badge variant="warning">موقع مشبوه</Badge>}
                      </td>
                      <td className="p-2 tabular-nums">{r.record?.checkInAt ? formatTimeAr(r.record.checkInAt) : "—"}</td>
                      <td className="p-2 text-xs">{present ? studentSig(r) : "—"}</td>
                      <td className="p-2 tabular-nums">{r.record?.checkOutAt ? formatTimeAr(r.record.checkOutAt) : "—"}</td>
                      <td className="p-2 text-xs">{present && r.record?.checkOutAt ? studentSig(r) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-col items-end gap-1 pt-2">
            <div className="text-sm font-semibold text-qu-navy-800">توقيع المشرف المؤسسي</div>
            {s.sheet ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.sheet.imageData && <img src={s.sheet.imageData} alt="توقيع المشرف المؤسسي" className="h-16 object-contain" />}
                <div className="text-sm">{s.sheet.signerName}</div>
                <div className="text-xs tabular-nums text-muted-foreground">{formatTimeAr(s.sheet.signedAt)}</div>
              </>
            ) : <div className="w-56 rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">لم يُوقَّع بعد</div>}
          </footer>
        </article>

        <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start print:hidden">
          <div className="rounded-xl border bg-card p-4">
            <dl className="grid grid-cols-2 gap-2 text-center">
              {([["حضور", s.summary.present, "text-emerald-700"], ["غياب", s.summary.absent, "text-red-700"], ["بعذر / إجازة", s.summary.excused, "text-muted-foreground"], ["بلا تسجيل", s.summary.missing, "text-amber-700"]] as const).map(([k, v, c]) => (
                <div key={k} className="rounded-lg bg-qu-gray-100 p-2"><dd className={`text-xl font-bold tabular-nums ${c}`}>{v}</dd><dt className="text-[11px] text-muted-foreground">{k}</dt></div>
              ))}
            </dl>
            {s.summary.pendingApproval > 0 && <p className="mt-3 text-xs text-muted-foreground">{s.summary.pendingApproval} سجل بانتظار اعتماد الساعات (يُعتمد من «المتدربون والحضور»، ولا يغيّر الكشف).</p>}
          </div>
          {s.sheet ? (
            <p className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${s.sheet.intact ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`} data-integrity={s.sheet.intact ? "intact" : "changed"}>
              {s.sheet.intact ? <ShieldCheck className="mt-0.5 size-4 shrink-0" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" />}
              {s.sheet.intact ? "الكشف موقّع، وسجلات اليوم مطابقة لما وُقّع عليه." : "تغيّرت سجلات هذا اليوم بعد التوقيع — راجع سجل التدقيق."}
            </p>
          ) : s.canSign ? (
            <div className="space-y-2 rounded-xl border bg-card p-4">
              {s.isToday && s.open.length > 0 ? (
                <p className="flex items-start gap-2 text-sm text-amber-800"><CircleAlert className="mt-0.5 size-4 shrink-0" /> بانتظار تسجيل الانصراف: {s.open.join("، ")}</p>
              ) : <SignSheetButton organizationId={orgId} date={date} missing={s.summary.missing} />}
            </div>
          ) : null}
          <a href={`/api/attendance-sheets/${orgId}/${date}/pdf`} target="_blank" rel="noopener" className={buttonVariants({ className: "w-full" })}><FileDown /> تنزيل الكشف PDF</a>
          <PrintButton />
        </aside>
      </div>
    </div>
  );
}
