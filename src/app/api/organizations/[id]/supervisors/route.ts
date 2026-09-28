import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email("بريد غير صحيح"),
  phone: z.string().trim().max(20).optional(),
  gender: z.enum(["MALE", "FEMALE"]),
  jobTitle: z.string().trim().max(120).optional(),
});

/**
 * POST /api/organizations/:id/supervisors — إنشاء حساب مشرف ميداني للجهة
 * تُولَّد كلمة مرور مؤقتة تُعرض مرة واحدة لرئيس الوحدة ليسلمها للمشرف.
 */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id } = await params;
  const body = await parseBody(req, schema);
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) throw new ApiError(404, "الجهة غير موجودة");
  if (await prisma.user.findUnique({ where: { email: body.email } })) throw new ApiError(409, "البريد مسجل لمستخدم آخر");

  const tempPassword = `Qu-${randomBytes(4).toString("hex")}`;
  const created = await prisma.user.create({
    data: {
      email: body.email,
      fullName: body.fullName,
      phone: body.phone,
      gender: body.gender,
      role: "FIELD_SUPERVISOR",
      passwordHash: await bcrypt.hash(tempPassword, 10),
      fieldSupervisor: { create: { organizationId: id, jobTitle: body.jobTitle } },
    },
  });
  await audit(user.id, "field_supervisor.create", "User", created.id, { organizationId: id }, clientIp(req));
  return NextResponse.json({ ok: true, tempPassword }, { status: 201 });
});
