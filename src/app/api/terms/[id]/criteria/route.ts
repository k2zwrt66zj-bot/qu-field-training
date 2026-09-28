import { NextResponse } from "next/server";
import { z } from "zod";
import type { EvaluationType, Major } from "@prisma/client";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };
const typeSchema = z.enum(["FIELD", "ACADEMIC"]);

/** هل رُصد أي تقييم نهائي بهذه الاستمارة؟ عندها تُقفل البنود حفاظاً على عدالة المقارنة */
async function lockedCount(termId: string, type: EvaluationType) {
  return prisma.evaluation.count({ where: { type, status: { not: "DRAFT" }, placement: { termId } } });
}

/** GET /api/terms/:id/criteria?type=FIELD|ACADEMIC */
export const GET = handler(async (req: Request, { params }: Ctx) => {
  await requireRole("TRAINING_HEAD");
  const { id } = await params;
  const type = typeSchema.parse(new URL(req.url).searchParams.get("type"));
  const [criteria, locked] = await Promise.all([
    prisma.evaluationCriterion.findMany({ where: { termId: id, type }, orderBy: { order: "asc" } }),
    lockedCount(id, type),
  ]);
  return NextResponse.json({ criteria, locked });
});

const putSchema = z.object({
  type: typeSchema,
  criteria: z
    .array(
      z.object({
        id: z.string().optional(),
        section: z.string().trim().min(2, "اسم المحور مطلوب").max(80),
        label: z.string().trim().min(3, "نص البند مطلوب").max(200),
        maxScore: z.number().int().min(1, "أقل درجة 1").max(100),
        major: z.enum(["SOCIOLOGY", "SOCIAL_WORK"]).nullable(),
      })
    )
    .min(1, "يجب أن تحتوي الاستمارة على بند واحد على الأقل")
    .max(60),
});

/** PUT /api/terms/:id/criteria — حفظ الاستمارة كاملة (إضافة/تعديل/حذف/ترتيب) */
export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id: termId } = await params;
  const body = await parseBody(req, putSchema);

  const locked = await lockedCount(termId, body.type);
  if (locked) throw new ApiError(409, `الاستمارة مقفلة لرصد تقييمات نهائية بها في هذا الفصل (${locked})`);

  // كل تخصص يجب أن يجد بنوداً تنطبق عليه
  for (const major of ["SOCIOLOGY", "SOCIAL_WORK"] as Major[]) {
    if (!body.criteria.some((c) => c.major === null || c.major === major)) {
      throw new ApiError(422, `لا توجد بنود تنطبق على تخصص ${major === "SOCIOLOGY" ? "علم الاجتماع" : "الخدمة الاجتماعية"}`);
    }
  }

  const existing = await prisma.evaluationCriterion.findMany({ where: { termId, type: body.type }, select: { id: true } });
  const keepIds = new Set(body.criteria.flatMap((c) => (c.id ? [c.id] : [])));
  if ([...keepIds].some((id) => !existing.some((e) => e.id === id))) throw new ApiError(422, "بند غير معروف");
  const removed = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);

  await prisma.$transaction(async (tx) => {
    // بنود محذوفة: نزيل درجاتها من المسودات أولاً (التقييمات النهائية ممنوعة أصلاً بالقفل)
    await tx.evaluationItem.deleteMany({ where: { criterionId: { in: removed } } });
    await tx.evaluationCriterion.deleteMany({ where: { id: { in: removed } } });
    for (const [order, c] of body.criteria.entries()) {
      const data = { section: c.section, label: c.label, maxScore: c.maxScore, major: c.major, order };
      if (c.id) await tx.evaluationCriterion.update({ where: { id: c.id }, data });
      else await tx.evaluationCriterion.create({ data: { ...data, termId, type: body.type } });
    }
  });
  await audit(user.id, "criteria.update", "EvaluationCriterion", termId, { type: body.type, count: body.criteria.length, removed: removed.length }, clientIp(req));
  return NextResponse.json({ ok: true });
});
