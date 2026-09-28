import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportView } from "@/components/reports/report-view";
import { ReportComments } from "@/components/reports/comments";
import { ReportStatusBadge } from "@/components/reports/report-status";
import { ReviewPanel } from "@/components/reports/review-panel";
import { PrintButton } from "@/components/reports/print-button";
import { REPORT_TEMPLATES } from "@/lib/report-templates";
import { loadReport, toViewProps } from "@/server/reports";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AcademicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("ACADEMIC_SUPERVISOR");
  const { id } = await params;
  const report = await loadReport(user, id).catch(() => null);
  if (!report || report.status === "DRAFT") notFound();
  const reviewable = report.status === "SUBMITTED" || report.status === "SIGNED";

  return (
    <>
      <PageHeader title={report.title} description={`${REPORT_TEMPLATES[report.template].title} — ${report.placement.student.user.fullName}`} actions={<><ReportStatusBadge status={report.status} /><PrintButton /></>} />
      <div className="mb-4"><ReportComments field={report.fieldComment} academic={report.academicComment} score={report.score == null ? null : toNum(report.score)} /></div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <ReportView {...toViewProps(report)} />
        {reviewable && (
          <Card className="print:hidden xl:sticky xl:top-20 xl:self-start">
            <CardHeader><CardTitle>المراجعة الأكاديمية</CardTitle></CardHeader>
            <CardContent><ReviewPanel id={report.id} canApprove={report.status === "SIGNED"} /></CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
