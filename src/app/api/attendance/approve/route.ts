import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recomputeApprovedMinutes } from "@/server/attendance";

const schema = z.object({
  recordIds: z.array(z.string()).min(1).max(200),
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(500).optional(),
  /** تعديل مدة العمل عند الحاجة (بالدقائق) - لسجل واحد فقط */
  adjustedMinutes: z.number().int().min(0).max(600).optional(),
});

/**
 * POST /api/attendance/approve — اعتماد/رفض حضور يومي (المشرف الميداني)
 * رئيس التدريب يمكنه أيضاً الاعتماد في الحالات الاستثنائية
 */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("FIELD_SUPERVISOR", "TRAINING_HEAD");
  const body = await parseBody(req, schema);
  if (body.adjustedMinutes != null && body.recordIds.length !== 1) throw new ApiError(422, "تعديل المدة متاح لسجل واحد فقط");

  const records = await prisma.attendanceRecord.findMany({
    where: {
      id: { in: body.recordIds },
      ...(user.role === "FIELD_SUPERVISOR" ? { placement: { fieldSupervisor: { userId: user.id } } } : {}),
    },
    select: { id: true, placementId: true, checkOutAt: true },
  });
  if (records.length !== body.recordIds.length) throw new ApiError(403, "بعض السجلات لا تتبع طلابك");
  if (body.decision === "APPROVED" && records.some((r) => !r.checkOutAt) && body.adjustedMinutes == null) {
    throw new ApiError(422, "لا يمكن اعتماد يوم لم يُسجَّل فيه الانصراف (يمكنك تحديد المدة يدوياً)");
  }

  const placementIds = [...new Set(records.map((r) => r.placementId))];
  await prisma.$transaction(async (tx) => {
    await tx.attendanceRecord.updateMany({
      where: { id: { in: body.recordIds } },
      data: {
        approvalStatus: body.decision,
        approvedById: user.id,
        approvedAt: new Date(),
        supervisorNote: body.note,
        ...(body.adjustedMinutes != null ? { workedMinutes: body.adjustedMinutes } : {}),
      },
    });
    for (const pid of placementIds) await recomputeApprovedMinutes(pid, tx);
  });

  await audit(user.id, `attendance.${body.decision.toLowerCase()}`, "AttendanceRecord", undefined, { ids: body.recordIds }, clientIp(req));
  return NextResponse.json({ ok: true, updated: records.length });
});
