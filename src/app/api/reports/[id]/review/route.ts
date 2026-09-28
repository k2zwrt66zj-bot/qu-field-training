import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { loadReport } from "@/server/reports";

const schema = z
  .object({
    decision: z.enum(["APPROVE", "RETURN"]),
    comment: z.string().trim().max(3000).optional(),
    score: z.number().min(0).max(100).optional(),
  })
  .refine((b) => b.decision !== "RETURN" || !!b.comment, { message: "اكتب سبب الإعادة للطالب", path: ["comment"] });

/**
 * POST /api/reports/:id/review — مراجعة المشرف الأكاديمي
 * الاعتماد يتطلب توقيع المشرف الميداني أولاً؛ الإعادة ممكنة في أي مرحلة بعد الرفع.
 */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("ACADEMIC_SUPERVISOR");
  const { id } = await params;
  const body = await parseBody(req, schema);
  const report = await loadReport(user, id);

  if (body.decision === "APPROVE") {
    if (report.status !== "SIGNED") throw new ApiError(409, "يُعتمد التقرير بعد توقيع المشرف الميداني");
  } else if (!["SUBMITTED", "SIGNED"].includes(report.status)) {
    throw new ApiError(409, "لا يمكن إعادة هذا التقرير في حالته الحالية");
  }

  await prisma.fieldReport.update({
    where: { id },
    data:
      body.decision === "APPROVE"
        ? { status: "REVIEWED", academicComment: body.comment ?? null, score: body.score ?? null, reviewedAt: new Date(), reviewedById: user.id }
        : // الإعادة تُسقط التوقيع السابق لأن المحتوى سيتغير
          { status: "RETURNED", academicComment: body.comment, signatureId: null },
  });
  await audit(user.id, `report.review_${body.decision.toLowerCase()}`, "FieldReport", id, { score: body.score }, clientIp(req));
  return NextResponse.json({ ok: true });
});
