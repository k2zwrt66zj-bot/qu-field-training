import { NextResponse } from "next/server";
import { handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";

/**
 * GET /api/attendance?placementId=&from=YYYY-MM-DD&to=YYYY-MM-DD&approval=PENDING&suspicious=1
 * سجل الحضور مقيداً بصلاحية المستخدم
 */
export const GET = handler(async (req: Request) => {
  const user = await requireRole();
  const url = new URL(req.url);
  const placementId = url.searchParams.get("placementId") ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const approval = url.searchParams.get("approval");

  const records = await prisma.attendanceRecord.findMany({
    where: {
      placement: { ...placementScope(user), ...(placementId ? { id: placementId } : {}) },
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      ...(approval === "PENDING" || approval === "APPROVED" || approval === "REJECTED" ? { approvalStatus: approval } : {}),
      ...(url.searchParams.get("suspicious") === "1" ? { isSuspicious: true } : {}),
    },
    include: { placement: { select: { id: true, student: { select: { universityId: true, user: { select: { fullName: true } } } }, organization: { select: { name: true } } } } },
    orderBy: [{ date: "desc" }],
    take: 500,
  });
  return NextResponse.json({ records });
});
