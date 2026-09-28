import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, type SessionUser } from "@/lib/api";
import { placementScope } from "@/server/access";

export const reportInclude = {
  placement: { include: { student: { include: { user: true } }, organization: true, term: true } },
  signature: { include: { signer: { select: { fullName: true } } } },
  reviewedBy: { select: { fullName: true } },
} satisfies Prisma.FieldReportInclude;

/** يحمّل التقرير إن كان ضمن نطاق صلاحية المستخدم */
export async function loadReport(user: SessionUser, id: string) {
  const report = await prisma.fieldReport.findFirst({ where: { id, placement: placementScope(user) }, include: reportInclude });
  if (!report) throw new ApiError(404, "التقرير غير موجود");
  return report;
}

export { signedPayload } from "@/lib/report-signing";

type LoadedReport = Awaited<ReturnType<typeof loadReport>>;

/** تحويل التقرير لخصائص مكوّن العرض */
export function toViewProps(r: LoadedReport) {
  return {
    template: r.template,
    title: r.title,
    content: (r.content ?? {}) as Record<string, unknown>,
    student: { name: r.placement.student.user.fullName, universityId: r.placement.student.universityId, major: r.placement.student.major },
    organization: r.placement.organization.name,
    term: r.placement.term.name,
    submittedAt: r.submittedAt,
    signature: r.signature ? { imageData: r.signature.imageData, signer: r.signature.signer.fullName, signedAt: r.signature.signedAt, contentHash: r.signature.contentHash } : null,
  };
}
