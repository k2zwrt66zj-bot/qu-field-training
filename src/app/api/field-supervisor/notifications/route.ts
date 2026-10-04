import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { displaySaudiMobile, normalizeSaudiMobile } from "@/lib/sms-format";
import { smsConfigured } from "@/server/sms";

async function current(userId: string) {
  const profile = await prisma.fieldSupervisorProfile.findUnique({ where: { userId }, select: { smsOnArrival: true, user: { select: { phone: true } } } });
  if (!profile) throw new ApiError(404, "لا يوجد ملف مشرف مؤسسي لهذا الحساب");
  const intl = normalizeSaudiMobile(profile.user.phone);
  return { smsOnArrival: profile.smsOnArrival, phone: intl ? displaySaudiMobile(intl) : profile.user.phone ?? "", smsConfigured: smsConfigured() };
}

/** GET /api/field-supervisor/notifications — إعداد رسالة وصول المتدرب */
export const GET = handler(async () => {
  const user = await requireRole("FIELD_SUPERVISOR");
  return NextResponse.json(await current(user.id));
});

const schema = z.object({
  smsOnArrival: z.boolean(),
  phone: z.string().trim().max(20).optional(),
});

/** PATCH /api/field-supervisor/notifications — تفعيل/إيقاف رسالة الوصول ورقم الجوال */
export const PATCH = handler(async (req: Request) => {
  const user = await requireRole("FIELD_SUPERVISOR");
  const body = await parseBody(req, schema);
  const profile = await prisma.fieldSupervisorProfile.findUnique({ where: { userId: user.id }, select: { id: true, user: { select: { phone: true } } } });
  if (!profile) throw new ApiError(404, "لا يوجد ملف مشرف مؤسسي لهذا الحساب");

  const rawPhone = body.phone ?? profile.user.phone ?? "";
  const intl = rawPhone ? normalizeSaudiMobile(rawPhone) : null;
  if (rawPhone && !intl) throw new ApiError(422, "رقم الجوال غير صالح — اكتبه بصيغة 05XXXXXXXX");
  if (body.smsOnArrival && !intl) throw new ApiError(422, "أضف رقم جوالك أولاً لتصلك الرسائل");

  await prisma.$transaction([
    prisma.fieldSupervisorProfile.update({ where: { id: profile.id }, data: { smsOnArrival: body.smsOnArrival } }),
    ...(body.phone !== undefined ? [prisma.user.update({ where: { id: user.id }, data: { phone: intl ? displaySaudiMobile(intl) : null } })] : []),
  ]);
  await audit(user.id, "supervisor.sms_preference", "FieldSupervisorProfile", profile.id, { smsOnArrival: body.smsOnArrival }, clientIp(req));
  return NextResponse.json(await current(user.id));
});
