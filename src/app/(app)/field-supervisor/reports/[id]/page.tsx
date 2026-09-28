import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportView } from "@/components/reports/report-view";
import { ReportStatusBadge } from "@/components/reports/report-status";
import { PrintButton } from "@/components/reports/print-button";
import { SigningPanel } from "@/components/supervisor/logbook-signing";
import { REPORT_TEMPLATES } from "@/lib/report-templates";
import { loadReport, toViewProps } from "@/server/reports";

export const dynamic = "force-dynamic";

export default async function FieldReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("FIELD_SUPERVISOR");
  const { id } = await params;
  const report = await loadReport(user, id).catch(() => null);
  if (!report || report.status === "DRAFT") notFound();

  return (
    <>
      <PageHeader title={report.title} description={`${REPORT_TEMPLATES[report.template].title} — ${report.placement.student.user.fullName}`} actions={<><ReportStatusBadge status={report.status} /><PrintButton /></>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <ReportView {...toViewProps(report)} />
        {report.status === "SUBMITTED" && (
          <Card className="print:hidden xl:sticky xl:top-20 xl:self-start">
            <CardHeader>
              <CardTitle>التوقيع الإلكتروني</CardTitle>
              <CardDescription>بتوقيعك تقر بصحة ما ورد عن العمل الميداني للطالب في جهتكم. يُحفظ مع التوقيع بصمة رقمية للمحتوى.</CardDescription>
            </CardHeader>
            <CardContent><SigningPanel endpoint={`/api/reports/${report.id}/sign`} afterHref="/field-supervisor/logbooks" /></CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
