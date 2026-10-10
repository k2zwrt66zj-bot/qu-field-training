import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  fullName: z.string().trim().min(3, "الاسم 3 أحرف على الأقل").max(120).optional(),
  email: z.string().trim().toLowerCase().email("بريد غير صحيح").optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  academicRank: z.string().trim().max(60).nullable().optional(),
  maxStudents: z.number().int().min(1, "الحد الأدنى طالب واحد").max(50, "الحد الأقصى 50").optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/academic-supervisors/:id — تعديل بيانات مشرف أكاديمي.
 * رئيسة الوحدة / الإدارة فقط. لا يغيّر كلمة المرور.
 */
export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id } = await params;
  const body = await parseBody(req, schema);

  const profile = await prisma.academicSupervisorProfile.findUnique({ where: { id }, include: { user: true } });
  if (!profile) throw new ApiError(404, "المشرف الأكاديمي غير موجود");

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
  const profileData = {
    ...(body.academicRank !== undefined ? { academicRank: body.academicRank || null } : {}),
    ...(body.maxStudents !== undefined ? { maxStudents: body.maxStudents } : {}),
  };

  await prisma.$transaction([
    prisma.user.update({ where: { id: profile.userId }, data: userData }),
    prisma.academicSupervisorProfile.update({ where: { id }, data: profileData }),
  ]);

  await audit(user.id, "academic_supervisor.update", "User", profile.userId, { fields: Object.keys(body) }, clientIp(req));
  return NextResponse.json({ ok: true });
});
