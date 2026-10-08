import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { afterFailedLogin, passwordProblem } from "@/lib/auth/password-policy";

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

/**
 * POST /api/account/password — تغيير كلمة المرور لصاحب الحساب
 * كلمة المرور الحالية الخاطئة تُحتسب ضمن محاولات القفل؛ والتغيير يُنهي جلسات الأجهزة الأخرى
 */
export const POST = handler(async (req: Request) => {
  const session = await requireRole();
  const body = await parseBody(req, schema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });

  if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
    await prisma.user.update({ where: { id: user.id }, data: afterFailedLogin(user.failedLogins) });
    throw new ApiError(422, "كلمة المرور الحالية غير صحيحة");
  }
  const problem = passwordProblem(body.newPassword, { email: user.email, current: body.currentPassword });
  if (problem) throw new ApiError(422, problem);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(body.newPassword, 10), mustChangePassword: false, passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null },
  });
  await audit(user.id, "account.password_change", "User", user.id, undefined, clientIp(req));
  return NextResponse.json({ ok: true });
});
