import { NextResponse } from "next/server";
import { ApiError, audit, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sectionSchema } from "@/lib/validation/section";

/**
 * PATCH /api/sections/:id — تعديل الشعبة.
 * تغيير النوع (ميداني ↔ محاكاة) ممنوع بعد أن يبدأ طلابها بتعبئة النماذج، لأنه يغيّر مسار الاعتماد.
 */
export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id } = await params;
  const data = await parseBody(req, sectionSchema.omit({ termId: true }));
  const current = await prisma.courseSection.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, "الشعبة غير موجودة");
  if (current.mode !== data.mode) {
    const started = await prisma.fieldForm.count({ where: { placement: { sectionId: id }, status: { not: "DRAFT" } } });
    if (started) throw new ApiError(409, `لا يمكن تغيير نوع التدريب: رفع طلاب الشعبة نماذج بالفعل (${started})`);
  }
  const section = await prisma.courseSection.update({ where: { id }, data });
  await audit(user.id, "section.update", "CourseSection", id, { before: current.mode, after: section.mode });
  return NextResponse.json({ ok: true, section });
});
