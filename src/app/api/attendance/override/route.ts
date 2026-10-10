import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { recordManualOverride } from "@/server/attendance";

const schema = z.object({
  placementId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح"),
  reason: z.string().trim().min(5, "سبب التجاوز إلزامي (5 أحرف على الأقل)").max(500),
});

/**
 * POST /api/attendance/override — تحضير يدوي استثنائي من المشرف المؤسسي
 * (تعذّر جوال/إنترنت الطالب). المشرف المؤسسي المسند لهذا الطالب حصراً.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("FIELD_SUPERVISOR");
  const body = await parseBody(req, schema);
  const ip = clientIp(req);
  const result = await recordManualOverride(user, body);
  await audit(user.id, "attendance.override", "AttendanceRecord", result.recordId, { placementId: body.placementId, date: body.date, reason: body.reason, minutes: result.workedMinutes }, ip);
  return NextResponse.json({ ok: true, ...result });
});
