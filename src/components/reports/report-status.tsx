import type { DocumentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

export const REPORT_STATUS: Record<DocumentStatus, { label: string; variant: "muted" | "warning" | "teal" | "destructive" | "success" }> = {
  DRAFT: { label: "مسودة", variant: "muted" },
  SUBMITTED: { label: "بانتظار توقيع المشرف الميداني", variant: "warning" },
  SIGNED: { label: "موقّع — بانتظار المراجعة الأكاديمية", variant: "teal" },
  RETURNED: { label: "معاد للتعديل", variant: "destructive" },
  REVIEWED: { label: "معتمد أكاديمياً", variant: "success" },
};

export function ReportStatusBadge({ status }: { status: DocumentStatus }) {
  const s = REPORT_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
