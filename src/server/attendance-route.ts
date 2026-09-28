import { NextResponse } from "next/server";
import { z } from "zod";
import type { AttemptType } from "@prisma/client";
import { audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { recordAttendance } from "@/server/attendance";

const sampleSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative(),
  altitude: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  timestamp: z.number().int().positive(),
});

export const attendanceBodySchema = z.object({
  samples: z.array(sampleSchema).min(1).max(10),
  deviceId: z.string().min(8).max(100).optional(),
  isMocked: z.boolean().optional(), // من غلاف التطبيق الأصلي إن وُجد
});

/** مصنع لمسارَي الحضور والانصراف (منطق مشترك) */
export function attendanceRoute(type: AttemptType) {
  return handler(async (req: Request) => {
    const user = await requireRole("STUDENT");
    const body = await parseBody(req, attendanceBodySchema);
    const ip = clientIp(req);
    const result = await recordAttendance({
      userId: user.id,
      type,
      samples: body.samples,
      deviceId: body.deviceId,
      isMocked: body.isMocked,
      userAgent: req.headers.get("user-agent"),
      ip,
    });
    await audit(user.id, type === "CHECK_IN" ? "attendance.check_in" : "attendance.check_out", "AttendanceRecord",
      result.ok ? result.recordId : undefined, { ok: result.ok, flags: result.riskFlags }, ip);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  });
}
