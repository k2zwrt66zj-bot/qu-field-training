import { NextResponse } from "next/server";
import { audit, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sectionSchema } from "@/lib/validation/section";


/** GET /api/sections?termId= — الشعب (المقرر، رقم الشعبة، رقم التدريب، ميداني/محاكاة) */
export const GET = handler(async (req: Request) => {
  await requireRole("TRAINING_HEAD", "DEPARTMENT_HEAD");
  const termId = new URL(req.url).searchParams.get("termId") ?? undefined;
  const sections = await prisma.courseSection.findMany({
    where: { termId },
    include: { academicSupervisor: { include: { user: { select: { fullName: true } } } }, _count: { select: { placements: true } } },
    orderBy: [{ trainingNumber: "asc" }, { sectionNumber: "asc" }],
  });
  return NextResponse.json({ sections });
});

/** POST /api/sections — إنشاء شعبة */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("TRAINING_HEAD");
  const data = await parseBody(req, sectionSchema);
  const section = await prisma.courseSection.create({ data });
  await audit(user.id, "section.create", "CourseSection", section.id, { mode: section.mode, sectionNumber: section.sectionNumber });
  return NextResponse.json({ ok: true, section }, { status: 201 });
});
