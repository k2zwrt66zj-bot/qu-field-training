import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { LogbookSigning } from "@/components/supervisor/logbook-signing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateAr } from "@/lib/time";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { REPORT_TEMPLATES } from "@/lib/report-templates";

export const metadata = { title: "السجلات والتقارير للتوقيع" };
export const dynamic = "force-dynamic";

const FIELDS = [
  ["activities", "الأنشطة المنفذة"],
  ["skills", "المهارات المكتسبة"],
  ["challenges", "الصعوبات"],
  ["reflections", "التأمل المهني"],
  ["plannedNext", "خطة الفترة القادمة"],
] as const;

export default async function FieldLogbooksPage() {
  const user = await requirePageRole("FIELD_SUPERVISOR");
  const logbooks = await prisma.logbook.findMany({
    where: { status: "SUBMITTED", placement: { fieldSupervisor: { userId: user.id } } },
    include: { placement: { include: { student: { include: { user: true } } } } },
    orderBy: { submittedAt: "asc" },
  });

  const reports = await prisma.fieldReport.findMany({
    where: { status: "SUBMITTED", placement: { fieldSupervisor: { userId: user.id } } },
    include: { placement: { include: { student: { include: { user: true } } } } },
    orderBy: { submittedAt: "asc" },
  });

  return (
    <>
      <PageHeader title="السجلات والتقارير بانتظار التوقيع" description="راجع سجلات المتدربين ووقّعها إلكترونياً؛ يُحفظ مع التوقيع بصمة رقمية للمحتوى تمنع تعديله لاحقاً" />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>التقارير الميدانية ({reports.length})</CardTitle>
          <CardDescription>دراسات الحالة والتدخل والبحوث والمسوح — افتح التقرير لقراءته وتوقيعه</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تقارير بانتظار التوقيع</p>}
          {reports.map((r) => (
            <Link key={r.id} href={`/field-supervisor/reports/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 transition-colors hover:bg-accent">
              <div className="min-w-[12rem] flex-1">
                <div className="line-clamp-2 font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.placement.student.user.fullName} · {REPORT_TEMPLATES[r.template].title}{r.submittedAt && ` · رُفع ${formatDateAr(r.submittedAt)}`}</div>
              </div>
              <ChevronLeft className="hidden size-4 text-muted-foreground sm:block" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <h2 className="mb-3 font-semibold">السجلات اليومية والأسبوعية ({logbooks.length})</h2>
      {logbooks.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد سجلات بانتظار التوقيع</CardContent></Card>}
      <div className="space-y-4">
        {logbooks.map((l) => (
          <Card key={l.id}>
            <CardHeader>
              <CardTitle>{l.placement.student.user.fullName} — {l.type === "WEEKLY" ? `السجل الأسبوعي ${l.weekNumber ?? ""}` : "سجل يومي"}</CardTitle>
              <CardDescription>{formatDateAr(l.periodStart)}{l.type === "WEEKLY" && ` — ${formatDateAr(l.periodEnd)}`}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <dl className="space-y-3 text-sm">
                {FIELDS.filter(([k]) => l[k]).map(([k, label]) => (
                  <div key={k}><dt className="font-semibold text-qu-green-700">{label}</dt><dd className="whitespace-pre-line text-muted-foreground">{l[k]}</dd></div>
                ))}
              </dl>
              <LogbookSigning id={l.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
