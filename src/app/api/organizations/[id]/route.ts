import { NextResponse } from "next/server";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { organizationSchema } from "@/lib/validation/organization";
import { haversineMeters } from "@/lib/geo/geofence";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/organizations/:id — تعديل بيانات الجهة (بما فيها الإحداثيات ونصف القطر) */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id } = await params;
  const data = await parseBody(req, organizationSchema);
  const before = await prisma.organization.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "الجهة غير موجودة");

  const org = await prisma.organization.update({ where: { id }, data });
  const moved = haversineMeters(before, org);
  // تغيير الموقع يؤثر مباشرة على تحضير الطلاب، لذا يُوثَّق بالتفصيل
  await audit(
    user.id,
    moved > 1 || before.geofenceRadius !== org.geofenceRadius ? "organization.relocate" : "organization.update",
    "Organization",
    id,
    moved > 1 || before.geofenceRadius !== org.geofenceRadius
      ? { from: [before.latitude, before.longitude, before.geofenceRadius], to: [org.latitude, org.longitude, org.geofenceRadius], movedMeters: Math.round(moved) }
      : undefined,
    clientIp(req)
  );
  return NextResponse.json({ ok: true, organization: org, movedMeters: Math.round(moved) });
});

/** DELETE /api/organizations/:id — حذف جهة لم يُسند إليها أي طالب (وإلا يجب إيقافها بدلاً من الحذف) */
export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id } = await params;
  const count = await prisma.placement.count({ where: { organizationId: id } });
  if (count > 0) throw new ApiError(409, `لا يمكن حذف الجهة لارتباطها بإسنادات طلاب (${count})؛ يمكنك إيقافها بدلاً من ذلك`);
  const supervisors = await prisma.fieldSupervisorProfile.findMany({ where: { organizationId: id }, select: { userId: true } });
  await prisma.$transaction([
    prisma.trainingPreference.updateMany({ where: { organizationId: id }, data: { organizationId: null } }),
    prisma.fieldSupervisorProfile.deleteMany({ where: { organizationId: id } }),
    prisma.user.updateMany({ where: { id: { in: supervisors.map((s) => s.userId) } }, data: { isActive: false } }),
    prisma.organization.delete({ where: { id } }),
  ]);
  await audit(user.id, "organization.delete", "Organization", id, undefined, clientIp(req));
  return NextResponse.json({ ok: true });
});
