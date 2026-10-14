import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    fieldWeight: z.number().int().min(0).max(100),
    academicWeight: z.number().int().min(0).max(100),
    attendanceWeight: z.number().int().min(0).max(100),
    requiredHours: z.number().int().min(10).max(1000),
    lateAfterMinutes: z.number().int().min(0).max(120),
    minDailyMinutes: z.number().int().min(0).max(600),
    maxConsecutiveAbsences: z.number().int().min(1).max(15),
    // أيام التدريب الافتراضية للإسنادات الجديدة (0=الأحد ... 6=السبت)؛ تُرتَّب وتُزال المكررات
    workDays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "اختر يوم تدريب واحداً على الأقل")
      .max(7)
      .transform((d) => [...new Set(d)].sort((a, b) => a - b))
      .optional(),
  })
  .refine((t) => t.fieldWeight + t.academicWeight + t.attendanceWeight === 100, {
    message: "مجموع أوزان الدرجة يجب أن يساوي 100",
    path: ["attendanceWeight"],
  });

/** PATCH /api/terms/:id — أوزان الدرجة وإعدادات الحضور وأيام التدريب للفصل */
export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id } = await params;
  const body = await parseBody(req, schema);
  const term = await prisma.academicTerm.findUnique({ where: { id } });
  if (!term) throw new ApiError(404, "الفصل غير موجود");

  const weightsChanged =
    term.fieldWeight !== body.fieldWeight || term.academicWeight !== body.academicWeight || term.attendanceWeight !== body.attendanceWeight;
  if (weightsChanged) {
    const approved = await prisma.finalGrade.count({ where: { placement: { termId: id }, status: { not: "CALCULATED" } } });
    if (approved) throw new ApiError(409, `لا يمكن تغيير الأوزان بعد اعتماد نتائج في هذا الفصل (${approved})`);
  }

  await prisma.$transaction([
    prisma.academicTerm.update({ where: { id }, data: body }),
    // الساعات المطلوبة تسري على الإسنادات الجارية؛ أما أيام التدريب فلكل طالب يومه، والإعداد هنا افتراضي للتوزيع الجديد فقط
    prisma.placement.updateMany({ where: { termId: id, status: { in: ["ASSIGNED", "ACTIVE"] } }, data: { requiredHours: body.requiredHours } }),
  ]);
  await audit(user.id, "term.update", "AcademicTerm", id, { before: term, after: body }, clientIp(req));
  return NextResponse.json({ ok: true, weightsChanged });
});
