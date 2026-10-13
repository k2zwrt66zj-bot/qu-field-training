import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  fullName: z.string().trim().min(3, "الاسم قصير").max(120),
  universityId: z.string().trim().regex(/^\d{6,12}$/, "الرقم الجامعي أرقام فقط (٦–١٢ خانة)"),
  major: z.enum(["SOCIOLOGY", "SOCIAL_WORK"]),
  gender: z.enum(["MALE", "FEMALE"]),
  city: z.string().trim().min(2, "المدينة مطلوبة").max(60),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  level: z.coerce.number().int().min(1).max(12).default(7),
  gpa: z.coerce.number().min(0).max(5).optional(),
});

/**
 * POST /api/students — إنشاء حساب طالب/ة (رئيس وحدة التدريب).
 * البريد (معرّف الدخول) يُشتق من الرقم الجامعي: <الرقم>@qu.edu.sa
 * تُولَّد كلمة مرور مؤقتة تُعرض مرة واحدة ليسلمها الرئيس للطالب، ويُطلب تغييرها عند أول دخول.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("TRAINING_HEAD");
  const body = await parseBody(req, schema);

  const email = `${body.universityId}@qu.edu.sa`;
  if (await prisma.studentProfile.findUnique({ where: { universityId: body.universityId } }))
    throw new ApiError(409, "الرقم الجامعي مسجّل لطالب آخر");
  if (await prisma.user.findUnique({ where: { email } }))
    throw new ApiError(409, "يوجد مستخدم بنفس معرّف الدخول");

  const tempPassword = `Qu-${randomBytes(4).toString("hex")}`;
  const created = await prisma.user.create({
    data: {
      email,
      fullName: body.fullName,
      phone: body.phone || null,
      gender: body.gender,
      role: "STUDENT",
      passwordHash: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true, // كلمة مرور مؤقتة: تُغيَّر عند أول دخول
      student: {
        create: {
          universityId: body.universityId,
          major: body.major,
          gender: body.gender,
          city: body.city,
          district: body.district || null,
          level: body.level,
          gpa: body.gpa ?? null,
        },
      },
    },
  });
  await audit(user.id, "student.create", "User", created.id, { universityId: body.universityId, major: body.major }, clientIp(req));
  return NextResponse.json({ ok: true, email, tempPassword }, { status: 201 });
});
