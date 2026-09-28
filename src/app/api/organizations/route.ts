import { NextResponse } from "next/server";
import { audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { organizationSchema } from "@/lib/validation/organization";

/** GET /api/organizations — دليل الجهات (مع أعداد المتدربين في الفصل المفعّل) */
export const GET = handler(async () => {
  await requireRole("TRAINING_HEAD", "DEPARTMENT_HEAD");
  const term = await prisma.academicTerm.findFirst({ where: { isActive: true } });
  const organizations = await prisma.organization.findMany({
    orderBy: [{ isApproved: "desc" }, { name: "asc" }],
    include: {
      supervisors: { include: { user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } } } },
      _count: { select: { placements: term ? { where: { termId: term.id } } : true } },
    },
  });
  return NextResponse.json({ organizations });
});

/** POST /api/organizations — إضافة جهة تدريب */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("TRAINING_HEAD");
  const data = await parseBody(req, organizationSchema);
  const org = await prisma.organization.create({ data });
  await audit(user.id, "organization.create", "Organization", org.id, { name: org.name }, clientIp(req));
  return NextResponse.json({ ok: true, organization: org }, { status: 201 });
});
