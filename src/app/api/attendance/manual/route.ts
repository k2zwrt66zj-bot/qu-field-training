import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assertPlacementAccess } from "@/server/access";
import { recomputeApprovedMinutes } from "@/server/attendance";
import { assertDayOpen } from "@/server/attendance-sheets";

const schema = z.object({
  placementId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["ABSENT", "EXCUSED", "HOLIDAY"]),
  note: z.string().max(500).optional(),
});

/** POST /api/attendance/manual — تسجيل غياب / عذر / إجازة يدوياً من المشرف المؤسسي */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("FIELD_SUPERVISOR", "TRAINING_HEAD");
  const body = await parseBody(req, schema);
  await assertPlacementAccess(user, body.placementId);
  const date = new Date(`${body.date}T00:00:00.000Z`);
  await assertDayOpen([body.placementId], date);

  const record = await prisma.attendanceRecord.upsert({
    where: { placementId_date: { placementId: body.placementId, date } },
    create: {
      placementId: body.placementId, date, status: body.status, approvalStatus: "APPROVED",
      approvedById: user.id, approvedAt: new Date(), excuseNote: body.note,
    },
    update: { status: body.status, approvalStatus: "APPROVED", approvedById: user.id, approvedAt: new Date(), excuseNote: body.note, workedMinutes: 0 },
  });
  await recomputeApprovedMinutes(body.placementId);
  await audit(user.id, "attendance.manual", "AttendanceRecord", record.id, body);
  return NextResponse.json({ ok: true, record });
});
