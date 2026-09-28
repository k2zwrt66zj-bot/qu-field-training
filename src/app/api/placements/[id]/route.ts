import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ sectionId: z.string().nullable() });

/**
 * PATCH /api/placements/:id — إسناد الطالب لشعبة (تحدد نوع التدريب: ميداني / محاكاة).
 * يُمنع نقل طالب بين نوعين مختلفين بعد رفعه نماذج.
 */
export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id } = await params;
  const { sectionId } = await parseBody(req, schema);
  const placement = await prisma.placement.findUnique({ where: { id }, include: { section: true } });
  if (!placement) throw new ApiError(404, "الإسناد غير موجود");
  const target = sectionId ? await prisma.courseSection.findUnique({ where: { id: sectionId } }) : null;
  if (sectionId && (!target || target.termId !== placement.termId)) throw new ApiError(422, "الشعبة غير موجودة في فصل الإسناد");
  const fromMode = placement.section?.mode ?? "FIELD";
  const toMode = target?.mode ?? "FIELD";
  if (fromMode !== toMode) {
    const started = await prisma.fieldForm.count({ where: { placementId: id, status: { not: "DRAFT" } } });
    if (started) throw new ApiError(409, "لا يمكن تغيير نوع تدريب طالب رفع نماذج بالفعل");
  }
  await prisma.placement.update({ where: { id }, data: { sectionId } });
  await audit(user.id, "placement.section", "Placement", id, { from: placement.sectionId, to: sectionId });
  return NextResponse.json({ ok: true });
});
