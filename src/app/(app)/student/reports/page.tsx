import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewReport } from "@/components/reports/new-report";
import { ReportStatusBadge } from "@/components/reports/report-status";
import { REPORT_TEMPLATES, templatesForMajor } from "@/lib/report-templates";
import { formatDateAr } from "@/lib/time";

export const metadata = { title: "التقارير الميدانية" };
export const dynamic = "force-dynamic";

export default async function StudentReportsPage() {
  const user = await requirePageRole("STUDENT");
  const placement = await prisma.placement.findFirst({
    where: { student: { userId: user.id } },
    orderBy: { startDate: "desc" },
    include: { student: true, reports: { orderBy: { updatedAt: "desc" } } },
  });
  if (!placement) return <><PageHeader title="التقارير الميدانية" /><Card><CardContent className="p-8 text-center text-muted-foreground">لم يتم توزيعك بعد.</CardContent></Card></>;

  const hasFinal = placement.reports.some((r) => r.template === "FINAL_REPORT");
  const canCreate = ["ASSIGNED", "ACTIVE"].includes(placement.status);
  const cards = templatesForMajor(placement.student.major).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    disabled: !canCreate ? "التدريب غير فعّال" : t.id === "FINAL_REPORT" && hasFinal ? "لديك تقرير ختامي مسبقاً" : undefined,
  }));

  return (
    <>
      <PageHeader title="التقارير الميدانية" description="نماذج مخصصة لتخصصك — تُرفع للمشرف الميداني للتوقيع ثم يراجعها المشرف الأكاديمي" />
      <section className="mb-6 space-y-3">
        <h2 className="font-semibold">إنشاء تقرير جديد</h2>
        <NewReport templates={cards} />
      </section>
      <Card>
        <CardHeader><CardTitle>تقاريري ({placement.reports.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {placement.reports.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لم تنشئ أي تقرير بعد</p>}
          {placement.reports.map((r) => (
            <Link key={r.id} href={`/student/reports/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 transition-colors hover:bg-accent">
              <div className="min-w-[12rem] flex-1">
                <div className="line-clamp-2 font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">{REPORT_TEMPLATES[r.template].title} · آخر تعديل {formatDateAr(r.updatedAt)}</div>
              </div>
              <ReportStatusBadge status={r.status} />
              <ChevronLeft className="hidden size-4 text-muted-foreground sm:block" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
