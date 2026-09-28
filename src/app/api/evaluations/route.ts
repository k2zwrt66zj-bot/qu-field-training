import { NextResponse } from "next/server";
import { z } from "zod";
import type { EvaluationType } from "@prisma/client";
import { ApiError, audit, clientIp, handler, parseBody, requireRole, type SessionUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { scoreEvaluation } from "@/lib/grading/engine";
import { toNum } from "@/lib/utils";
import { createSignature } from "@/server/signature";
import { computeAndStoreGrade } from "@/server/grading";

/** من يحق له تعبئة كل نوع تقييم */
async function loadForEvaluator(user: SessionUser, placementId: string, type: EvaluationType) {
  const placement = await prisma.placement.findFirst({
    where: {
      id: placementId,
      ...(type === "FIELD" ? { fieldSupervisor: { userId: user.id } } : { academicSupervisor: { userId: user.id } }),
    },
    include: { student: { include: { user: true } }, organization: true, term: true },
  });
  if (!placement) throw new ApiError(403, "لست المشرف المسند لهذا الطالب");
  return placement;
}

const typeFor = (user: SessionUser): EvaluationType => (user.role === "FIELD_SUPERVISOR" ? "FIELD" : "ACADEMIC");

/** GET /api/evaluations?placementId= — بنود الاستمارة + التقييم المحفوظ */
export const GET = handler(async (req: Request) => {
  const user = await requireRole("FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR");
  const placementId = new URL(req.url).searchParams.get("placementId");
  if (!placementId) throw new ApiError(400, "placementId مطلوب");
  const type = typeFor(user);
  const placement = await loadForEvaluator(user, placementId, type);

  const [criteria, evaluation] = await Promise.all([
    prisma.evaluationCriterion.findMany({
      where: { termId: placement.termId, type, OR: [{ major: null }, { major: placement.student.major }] },
      orderBy: { order: "asc" },
    }),
    prisma.evaluation.findUnique({
      where: { placementId_type: { placementId, type } },
      include: { items: true },
    }),
  ]);

  return NextResponse.json({
    type,
    student: { name: placement.student.user.fullName, universityId: placement.student.universityId, major: placement.student.major },
    organization: placement.organization.name,
    criteria,
    evaluation: evaluation && {
      status: evaluation.status,
      percentage: toNum(evaluation.percentage),
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
      comments: evaluation.comments,
      items: evaluation.items.map((i) => ({ criterionId: i.criterionId, score: toNum(i.score), comment: i.comment })),
    },
  });
});

const saveSchema = z.object({
  placementId: z.string(),
  items: z.array(z.object({ criterionId: z.string(), score: z.number().min(0), comment: z.string().max(500).optional() })).min(1),
  strengths: z.string().max(2000).optional(),
  improvements: z.string().max(2000).optional(),
  comments: z.string().max(2000).optional(),
  submit: z.boolean().default(false),
  signature: z.string().optional(), // مطلوب عند الاعتماد النهائي
});

/** POST /api/evaluations — حفظ مسودة أو اعتماد التقييم نهائياً */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR");
  const body = await parseBody(req, saveSchema);
  const type = typeFor(user);
  const placement = await loadForEvaluator(user, body.placementId, type);

  const existing = await prisma.evaluation.findUnique({ where: { placementId_type: { placementId: placement.id, type } } });
  if (existing && existing.status !== "DRAFT") throw new ApiError(409, "تم اعتماد التقييم مسبقاً ولا يمكن تعديله");

  const criteria = await prisma.evaluationCriterion.findMany({
    where: { termId: placement.termId, type, OR: [{ major: null }, { major: placement.student.major }] },
  });
  const byId = new Map(criteria.map((c) => [c.id, c]));
  if (body.items.some((i) => !byId.has(i.criterionId))) throw new ApiError(422, "بند تقييم غير معروف");
  if (body.submit && body.items.length !== criteria.length) throw new ApiError(422, "يجب تقييم جميع البنود قبل الاعتماد");
  if (body.submit && !body.signature) throw new ApiError(422, "التوقيع الإلكتروني مطلوب لاعتماد التقييم");

  const score = scoreEvaluation(body.items.map((i) => ({ score: i.score, maxScore: byId.get(i.criterionId)!.maxScore })));
  // عند الحفظ الجزئي: النسبة من البنود المعبأة فقط لا تُعتمد؛ المعتمد هو النسبة عند الإرسال
  const ip = clientIp(req);

  const evaluation = await prisma.$transaction(async (tx) => {
    const signature = body.submit
      ? await createSignature(tx, user.id, body.signature!, { placementId: placement.id, type, items: body.items, score }, ip)
      : null;
    const data = {
      rawScore: score.raw,
      maxScore: score.max,
      percentage: score.percentage,
      strengths: body.strengths,
      improvements: body.improvements,
      comments: body.comments,
      status: body.submit ? ("SUBMITTED" as const) : ("DRAFT" as const),
      submittedAt: body.submit ? new Date() : null,
      signatureId: signature?.id,
      evaluatorId: user.id,
    };
    const ev = await tx.evaluation.upsert({
      where: { placementId_type: { placementId: placement.id, type } },
      create: { placementId: placement.id, type, ...data },
      update: data,
    });
    await tx.evaluationItem.deleteMany({ where: { evaluationId: ev.id } });
    await tx.evaluationItem.createMany({
      data: body.items.map((i) => ({ evaluationId: ev.id, criterionId: i.criterionId, score: i.score, comment: i.comment })),
    });
    return ev;
  });

  if (body.submit) {
    await computeAndStoreGrade(placement.id); // تحديث الدرجة المبدئية آلياً
    await audit(user.id, "evaluation.submit", "Evaluation", evaluation.id, { type, percentage: score.percentage }, ip);
  }
  return NextResponse.json({ ok: true, status: evaluation.status, ...score });
});
