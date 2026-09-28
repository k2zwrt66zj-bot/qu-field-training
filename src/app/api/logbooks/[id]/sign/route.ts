import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createSignature } from "@/server/signature";

const schema = z.object({
  decision: z.enum(["SIGN", "RETURN"]),
  comment: z.string().max(2000).optional(),
  signature: z.string().optional(),
});

/** POST /api/logbooks/:id/sign — توقيع السجل إلكترونياً أو إعادته للطالب (المشرف الميداني) */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("FIELD_SUPERVISOR");
  const { id } = await params;
  const body = await parseBody(req, schema);
  const logbook = await prisma.logbook.findFirst({ where: { id, placement: { fieldSupervisor: { userId: user.id } } } });
  if (!logbook) throw new ApiError(404, "السجل غير موجود");
  if (logbook.status !== "SUBMITTED") throw new ApiError(409, "السجل ليس بانتظار التوقيع");

  if (body.decision === "RETURN") {
    await prisma.logbook.update({ where: { id }, data: { status: "RETURNED", fieldComment: body.comment } });
    return NextResponse.json({ ok: true, status: "RETURNED" });
  }
  if (!body.signature) throw new ApiError(422, "التوقيع مطلوب");
  const ip = clientIp(req);
  await prisma.$transaction(async (tx) => {
    const { id: _id, status: _st, signatureId: _sig, updatedAt: _u, ...content } = logbook;
    const sig = await createSignature(tx, user.id, body.signature!, content, ip);
    await tx.logbook.update({ where: { id }, data: { status: "SIGNED", fieldComment: body.comment, signatureId: sig.id } });
  });
  await audit(user.id, "logbook.sign", "Logbook", id, undefined, ip);
  return NextResponse.json({ ok: true, status: "SIGNED" });
});
