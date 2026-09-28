import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { issueLetter } from "@/server/letters";

const schema = z.object({
  placementIds: z.array(z.string()).min(1).max(300),
  type: z.enum(["REFERRAL", "COMMENCEMENT", "COMPLETION"]),
});

/** POST /api/letters — إصدار خطابات (فردي أو جماعي) لرئيس التدريب */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("TRAINING_HEAD");
  const body = await parseBody(req, schema);
  const placements = await prisma.placement.findMany({ where: { id: { in: body.placementIds } }, select: { id: true } });

  const letters = [];
  for (const p of placements) letters.push(await issueLetter(p.id, body.type, user.id));
  await audit(user.id, "letter.issue", "Letter", undefined, { type: body.type, count: letters.length });
  return NextResponse.json({ ok: true, letters: letters.map((l) => ({ id: l.id, serialNumber: l.serialNumber, url: `/letters/${l.id}` })) });
});
