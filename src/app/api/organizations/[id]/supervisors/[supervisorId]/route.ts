import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  fullName: z.string().trim().min(3, "الاسم 3 أحرف على الأقل").max(120).optional(),
  email: z.string().trim().toLowerCase().email("بريد غير صحيح").optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/organizations/:id/supervisors/:supervisorId — تعديل بيانات مشرف مؤسسي للجهة.
 * رئيسة الوحدة / الإدارة فقط. لا يغيّر كلمة المرور.
 */
export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string; supervisorId: string }> }) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id, supervisorId } = await params;
  const body = await parseBody(req, schema);

  const profile = await prisma.fieldSupervisorProfile.findUnique({ where: { id: supervisorId }, include: { user: true } });
  if (!profile || profile.organizationId !== id) throw new ApiError(404, "المشرف غير موجود في هذه الجهة");

  // تغيير البريد: يجب أن يبقى فريداً (هو معرّف الدخول)
  if (body.email && body.email !== profile.user.email) {
    const taken = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (taken) throw new ApiError(409, "البريد مسجل لمستخدم آخر");
  }

  const userData = {
    ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
    ...(body.email !== undefined ? { email: body.email } : {}),
    ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
    ...(body.gender !== undefined ? { gender: body.gender } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
  };

  await prisma.$transaction([
    prisma.user.update({ where: { id: profile.userId }, data: userData }),
    prisma.fieldSupervisorProfile.update({ where: { id: supervisorId }, data: { ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle || null } : {}) } }),
  ]);

  await audit(user.id, "field_supervisor.update", "User", profile.userId, { organizationId: id, fields: Object.keys(body) }, clientIp(req));
  return NextResponse.json({ ok: true });
});
