import { NextResponse } from "next/server";
import { handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { listSheetDays, sheetOrganizations } from "@/server/attendance-sheets";
import { FIELD_MODE_ONLY } from "@/server/attendance";

/** GET /api/attendance-sheets?organizationId= — أيام التدريب وحالة كشف كل يوم */
export const GET = handler(async (req: Request) => {
  const user = await requireRole("FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR", "TRAINING_HEAD", "DEPARTMENT_HEAD");
  const scope = await sheetOrganizations(user);
  const organizations = await prisma.organization.findMany({
    where: { ...(scope === "ALL" ? {} : { id: { in: scope } }), placements: { some: { status: { in: ["ACTIVE", "COMPLETED"] }, ...FIELD_MODE_ONLY } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const orgId = new URL(req.url).searchParams.get("organizationId") ?? organizations[0]?.id;
  const days = orgId ? await listSheetDays(user, orgId) : { organization: null, days: [] };
  return NextResponse.json({ organizations, ...days });
});
