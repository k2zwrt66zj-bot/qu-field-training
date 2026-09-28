import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createSignature } from "@/server/signature";
import { loadReport, signedPayload } from "@/server/reports";

const schema = z
  .object({ decision: z.enum(["SIGN", "RETURN"]), comment: z.string().trim().max(3000).optional(), signature: z.string().optional() })
  .refine((b) => b.decision !== "RETURN" || !!b.comment, { message: "اكتب سبب الإعادة للطالب", path: ["comment"] })
  .refine((b) => b.decision !== "SIGN" || !!b.signature, { message: "التوقيع مطلوب", path: ["signature"] });

/** POST /api/reports/:id/sign — توقيع المشرف الميداني أو الإعادة للتعديل */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("FIELD_SUPERVISOR");
  const { id } = await params;
  const body = await parseBody(req, schema);
  const report = await loadReport(user, id);
  if (report.status !== "SUBMITTED") throw new ApiError(409, "التقرير ليس بانتظار التوقيع");
  const ip = clientIp(req);

  if (body.decision === "RETURN") {
    await prisma.fieldReport.update({ where: { id }, data: { status: "RETURNED", fieldComment: body.comment } });
  } else {
    await prisma.$transaction(async (tx) => {
      const sig = await createSignature(tx, user.id, body.signature!, signedPayload(report), ip);
      await tx.fieldReport.update({ where: { id }, data: { status: "SIGNED", fieldComment: body.comment ?? null, signatureId: sig.id } });
    });
  }
  await audit(user.id, `report.${body.decision.toLowerCase()}`, "FieldReport", id, undefined, ip);
  return NextResponse.json({ ok: true });
});
