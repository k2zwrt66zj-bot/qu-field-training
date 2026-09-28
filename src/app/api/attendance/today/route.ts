import { NextResponse } from "next/server";
import { handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getActivePlacementForStudent } from "@/server/attendance";
import { riyadhDateOnly, riyadhWeekday } from "@/lib/time";

/** GET /api/attendance/today — بيانات شاشة التحضير للطالب */
export const GET = handler(async () => {
  const user = await requireRole("STUDENT");
  const today = riyadhDateOnly();
  const placement = await getActivePlacementForStudent(user.id, today);
  if (!placement) return NextResponse.json({ placement: null });

  const record = await prisma.attendanceRecord.findUnique({
    where: { placementId_date: { placementId: placement.id, date: today } },
  });
  const o = placement.organization;
  return NextResponse.json({
    placement: {
      id: placement.id,
      requiredHours: placement.requiredHours,
      approvedHours: Math.round((placement.approvedMinutes / 60) * 10) / 10,
      isWorkDay: placement.workDays.includes(riyadhWeekday()),
      organization: {
        name: o.name,
        latitude: o.latitude,
        longitude: o.longitude,
        radius: o.geofenceRadius,
        workStartTime: o.workStartTime,
        workEndTime: o.workEndTime,
        address: o.address,
      },
    },
    record: record && {
      status: record.status,
      checkInAt: record.checkInAt,
      checkOutAt: record.checkOutAt,
      workedMinutes: record.workedMinutes,
      approvalStatus: record.approvalStatus,
      isSuspicious: record.isSuspicious,
    },
  });
});
