import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportStatusBadge } from "@/components/reports/report-status";
import { REPORT_TEMPLATES } from "@/lib/report-templates";
import { formatDateAr } from "@/lib/time";
import { toNum } from "@/lib/utils";

export const metadata = { title: "تقارير الطلاب" };
export const dynamic = "force-dynamic";

export default async function AcademicReportsPage() {
  const user = await requirePageRole("ACADEMIC_SUPERVISOR");
  const reports = await prisma.fieldReport.findMany({
    where: { status: { not: "DRAFT" }, placement: { academicSupervisor: { userId: user.id } } },
    include: { placement: { include: { student: { include: { user: true } }, organization: true } } },
    orderBy: [{ submittedAt: "desc" }],
  });
  const groups = [
    { title: "بانتظار مراجعتك (موقّعة)", items: reports.filter((r) => r.status === "SIGNED") },
    { title: "بانتظار توقيع المشرف الميداني", items: reports.filter((r) => r.status === "SUBMITTED") },
    { title: "معتمدة", items: reports.filter((r) => r.status === "REVIEWED") },
    { title: "معادة للطلاب", items: reports.filter((r) => r.status === "RETURNED") },
  ];

  return (
    <>
      <PageHeader title="تقارير الطلاب الميدانية" description="دراسات الحالة، التدخل الاجتماعي، خدمة الجماعة، البحث الميداني، المسح الاجتماعي، والتقارير الختامية" />
      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g.title}>
            <CardHeader><CardTitle>{g.title} ({g.items.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {g.items.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد</p>}
              {g.items.map((r) => (
                <Link key={r.id} href={`/academic-supervisor/reports/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 transition-colors hover:bg-accent">
                  <div className="min-w-[12rem] flex-1">
                    <div className="line-clamp-2 font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.placement.student.user.fullName} · {REPORT_TEMPLATES[r.template].title} · {r.placement.organization.name}
                      {r.submittedAt && ` · رُفع ${formatDateAr(r.submittedAt)}`}
                    </div>
                  </div>
                  {r.score != null && <span className="text-sm font-semibold tabular-nums">{toNum(r.score)}/100</span>}
                  <ReportStatusBadge status={r.status} />
                  <ChevronLeft className="hidden size-4 text-muted-foreground sm:block" />
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
