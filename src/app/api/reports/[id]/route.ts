import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { validateContent } from "@/lib/report-templates";
import { loadReport } from "@/server/reports";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/reports/:id */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole();
  const { id } = await params;
  const report = await loadReport(user, id);
  if (user.role !== "STUDENT" && report.status === "DRAFT") throw new ApiError(404, "التقرير غير موجود");
  return NextResponse.json({ report });
});

const patchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  content: z.record(z.string(), z.unknown()),
  submit: z.boolean().default(false),
});

/** PATCH /api/reports/:id — حفظ المسودة أو رفعها للمشرف الميداني (الطالب) */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  const report = await loadReport(user, id);
  if (!["DRAFT", "RETURNED"].includes(report.status)) throw new ApiError(409, "التقرير مرفوع ولا يمكن تعديله");

  const v = validateContent(report.template, body.content, body.submit);
  if (!v.ok) throw new ApiError(422, "أكمل الحقول الإلزامية قبل الرفع", v.missing.map((m) => ({ path: "content", message: m })));

  const updated = await prisma.fieldReport.update({
    where: { id },
    data: {
      title: body.title,
      content: v.content as object,
      ...(body.submit ? { status: "SUBMITTED", submittedAt: new Date() } : {}),
    },
  });
  if (body.submit) await audit(user.id, "report.submit", "FieldReport", id, undefined, clientIp(req));
  return NextResponse.json({ ok: true, status: updated.status, updatedAt: updated.updatedAt });
});

/** DELETE /api/reports/:id — حذف مسودة لم تُرفع قط */
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const report = await loadReport(user, id);
  if (report.status !== "DRAFT" || report.submittedAt) throw new ApiError(409, "لا يمكن حذف تقرير سبق رفعه");
  await prisma.fieldReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
