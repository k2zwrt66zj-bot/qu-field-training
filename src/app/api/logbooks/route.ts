import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";
import { getActivePlacementForStudent } from "@/server/attendance";

/** GET /api/logbooks?placementId= */
export const GET = handler(async (req: Request) => {
  const user = await requireRole();
  const placementId = new URL(req.url).searchParams.get("placementId") ?? undefined;
  const logbooks = await prisma.logbook.findMany({
    where: { placement: { ...placementScope(user), ...(placementId ? { id: placementId } : {}) } },
    include: { signature: { select: { signedAt: true, signer: { select: { fullName: true } } } } },
    orderBy: { periodStart: "desc" },
  });
  return NextResponse.json({ logbooks });
});

const schema = z.object({
  type: z.enum(["DAILY", "WEEKLY"]),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekNumber: z.number().int().min(1).max(30).optional(),
  activities: z.string().min(20, "صف الأنشطة المنفذة بشكل أوفى (20 حرفاً على الأقل)").max(8000),
  skills: z.string().max(4000).optional(),
  challenges: z.string().max(4000).optional(),
  reflections: z.string().max(4000).optional(),
  plannedNext: z.string().max(4000).optional(),
  submit: z.boolean().default(false),
});

/** POST /api/logbooks — إنشاء/تحديث سجل يومي أو أسبوعي (الطالب) */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("STUDENT");
  const body = await parseBody(req, schema);
  const placement = await getActivePlacementForStudent(user.id);
  if (!placement) throw new ApiError(404, "لا يوجد تدريب فعّال");
  const periodStart = new Date(`${body.periodStart}T00:00:00Z`);
  const periodEnd = new Date(`${body.periodEnd}T00:00:00Z`);
  if (periodEnd < periodStart) throw new ApiError(422, "تاريخ النهاية قبل البداية");

  const existing = await prisma.logbook.findUnique({
    where: { placementId_type_periodStart: { placementId: placement.id, type: body.type, periodStart } },
  });
  if (existing && !["DRAFT", "RETURNED"].includes(existing.status)) throw new ApiError(409, "السجل مرفوع مسبقاً ولا يمكن تعديله");

  const { submit, periodStart: _s, periodEnd: _e, ...fields } = body;
  const data = { ...fields, periodStart, periodEnd, status: submit ? ("SUBMITTED" as const) : ("DRAFT" as const), submittedAt: submit ? new Date() : null };
  const logbook = existing
    ? await prisma.logbook.update({ where: { id: existing.id }, data })
    : await prisma.logbook.create({ data: { ...data, placementId: placement.id } });
  return NextResponse.json({ ok: true, logbook });
});
