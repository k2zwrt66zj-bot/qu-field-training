import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { computeAndStoreGrade } from "@/server/grading";

const schema = z.object({ termId: z.string(), placementIds: z.array(z.string()).optional() });

/** POST /api/grades/calculate — احتساب/إعادة احتساب الدرجات النهائية (رئيس التدريب) */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("TRAINING_HEAD");
  const body = await parseBody(req, schema);
  const placements = await prisma.placement.findMany({
    where: { termId: body.termId, status: { in: ["ACTIVE", "COMPLETED"] }, ...(body.placementIds ? { id: { in: body.placementIds } } : {}) },
    select: { id: true },
  });

  let calculated = 0, skipped = 0, incomplete = 0;
  for (const p of placements) {
    const r = await computeAndStoreGrade(p.id);
    if (r.skipped) skipped++;
    else {
      calculated++;
      if (r.missing?.length) incomplete++;
    }
  }
  await audit(user.id, "grade.calculate", "FinalGrade", undefined, { termId: body.termId, calculated });
  return NextResponse.json({ ok: true, calculated, skipped, incomplete });
});
