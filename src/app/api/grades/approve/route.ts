import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ placementIds: z.array(z.string()).min(1).max(500), publish: z.boolean().default(false) });

/**
 * POST /api/grades/approve — اعتماد النتائج النهائية (رئيس وحدة التدريب الميداني)
 * يقفل التقييمات، ويغلق الإسناد كمكتمل، ويمنع أي تعديل لاحق.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("TRAINING_HEAD");
  const body = await parseBody(req, schema);

  const grades = await prisma.finalGrade.findMany({
    where: { placementId: { in: body.placementIds } },
    select: { placementId: true, breakdown: true },
  });
  if (grades.length !== body.placementIds.length) throw new ApiError(422, "بعض الطلاب لم تُحتسب درجاتهم بعد");
  const incomplete = grades.filter((g) => ((g.breakdown as { missing?: string[] })?.missing?.length ?? 0) > 0);
  if (incomplete.length) throw new ApiError(422, `لا يمكن الاعتماد: ${incomplete.length} طالب/طالبة بتقييمات ناقصة`);

  await prisma.$transaction([
    prisma.finalGrade.updateMany({
      where: { placementId: { in: body.placementIds } },
      data: { status: body.publish ? "PUBLISHED" : "APPROVED", approvedById: user.id, approvedAt: new Date() },
    }),
    prisma.evaluation.updateMany({ where: { placementId: { in: body.placementIds } }, data: { status: "LOCKED" } }),
    prisma.placement.updateMany({ where: { id: { in: body.placementIds } }, data: { status: "COMPLETED" } }),
    // قفل النماذج الرسمية: لا تعديل ولا إعادة بعد اعتماد النتيجة
    prisma.fieldForm.updateMany({ where: { placementId: { in: body.placementIds }, lockedAt: null }, data: { lockedAt: new Date() } }),
  ]);
  await audit(user.id, "grade.approve", "FinalGrade", undefined, body, clientIp(req));
  return NextResponse.json({ ok: true, approved: body.placementIds.length });
});
