import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { ReportForm } from "@/components/reports/report-form";
import { ReportView } from "@/components/reports/report-view";
import { ReportComments } from "@/components/reports/comments";
import { ReportStatusBadge } from "@/components/reports/report-status";
import { PrintButton } from "@/components/reports/print-button";
import { DeleteDraftButton } from "@/components/reports/delete-draft";
import { REPORT_TEMPLATES } from "@/lib/report-templates";
import { loadReport, toViewProps } from "@/server/reports";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudentReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("STUDENT");
  const { id } = await params;
  const report = await loadReport(user, id).catch(() => null);
  if (!report) notFound();
  const editable = report.status === "DRAFT" || report.status === "RETURNED";

  return (
    <>
      <PageHeader
        title={report.title}
        description={REPORT_TEMPLATES[report.template].title}
        actions={
          <>
            <ReportStatusBadge status={report.status} />
            {editable ? report.status === "DRAFT" && !report.submittedAt && <DeleteDraftButton id={report.id} /> : <PrintButton />}
          </>
        }
      />
      <div className="mb-4">
        <ReportComments field={report.fieldComment} academic={report.academicComment} score={report.score == null ? null : toNum(report.score)} />
      </div>
      {editable ? (
        <ReportForm id={report.id} template={report.template} initialTitle={report.title} initialContent={(report.content ?? {}) as Record<string, unknown>} />
      ) : (
        <ReportView {...toViewProps(report)} />
      )}
    </>
  );
}
