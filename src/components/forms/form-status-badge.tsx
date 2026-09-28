import type { DocumentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

type Variant = "muted" | "warning" | "teal" | "destructive" | "success";

/** نص الحالة يوضح من ينتظر النموذج: المشرف المؤسسي أم الأكاديمي */
export function formStatusLabel(status: DocumentStatus, fieldApproval: boolean): { label: string; variant: Variant } {
  switch (status) {
    case "DRAFT":
      return { label: "مسودة", variant: "muted" };
    case "SUBMITTED":
      return { label: fieldApproval ? "بانتظار توقيع المشرف المؤسسي" : "بانتظار اعتماد المشرف الأكاديمي", variant: "warning" };
    case "SIGNED":
      return { label: "موقّع — بانتظار الاعتماد الأكاديمي", variant: "teal" };
    case "RETURNED":
      return { label: "معاد للتعديل", variant: "destructive" };
    case "REVIEWED":
      return { label: "معتمد", variant: "success" };
  }
}

export function FormStatusBadge({ status, fieldApproval, className }: { status: DocumentStatus; fieldApproval: boolean; className?: string }) {
  const s = formStatusLabel(status, fieldApproval);
  return <Badge variant={s.variant} className={className}>{s.label}</Badge>;
}
