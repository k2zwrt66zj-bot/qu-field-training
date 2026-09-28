import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";
import { REPORT_TEMPLATES } from "@/lib/report-templates";

/** GET /api/reports?placementId=&status= — قائمة التقارير ضمن نطاق المستخدم */
export const GET = handler(async (req: Request) => {
  const user = await requireRole();
  const url = new URL(req.url);
  const placementId = url.searchParams.get("placementId") ?? undefined;
  const status = url.searchParams.get("status");
  const reports = await prisma.fieldReport.findMany({
    where: {
      placement: { ...placementScope(user), ...(placementId ? { id: placementId } : {}) },
      ...(status ? { status: status as never } : {}),
      // المشرفون لا يرون المسودات
      ...(user.role !== "STUDENT" ? { status: { not: "DRAFT" } } : {}),
    },
    select: { id: true, template: true, title: true, status: true, submittedAt: true, updatedAt: true, score: true, placementId: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ reports });
});

const createSchema = z.object({
  template: z.enum(["CASE_STUDY", "SOCIAL_INTERVENTION", "GROUP_WORK", "FIELD_RESEARCH", "SOCIAL_SURVEY", "FINAL_REPORT"]),
  title: z.string().trim().min(3, "العنوان قصير جداً").max(200),
});

/** POST /api/reports — إنشاء تقرير جديد (مسودة) للطالب */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("STUDENT");
  const body = await parseBody(req, createSchema);
  const placement = await prisma.placement.findFirst({
    where: { student: { userId: user.id }, status: { in: ["ASSIGNED", "ACTIVE"] } },
    include: { student: true },
    orderBy: { startDate: "desc" },
  });
  if (!placement) throw new ApiError(404, "لا يوجد تدريب ميداني فعّال");
  const tpl = REPORT_TEMPLATES[body.template];
  if (!tpl.majors.includes(placement.student.major)) throw new ApiError(422, "هذا النموذج غير مخصص لتخصصك");
  if (body.template === "FINAL_REPORT" && (await prisma.fieldReport.count({ where: { placementId: placement.id, template: "FINAL_REPORT" } }))) {
    throw new ApiError(409, "لديك تقرير ختامي مسبقاً");
  }
  const report = await prisma.fieldReport.create({
    data: { placementId: placement.id, template: body.template, title: body.title, content: {} },
  });
  await audit(user.id, "report.create", "FieldReport", report.id, { template: body.template });
  return NextResponse.json({ ok: true, id: report.id }, { status: 201 });
});
