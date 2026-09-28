import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, handler, parseBody, requireRole } from "@/lib/api";
import { autoAssign } from "@/server/distribution";

const schema = z.object({ termId: z.string(), dryRun: z.boolean().default(true) });

/** POST /api/placements/auto-assign — معاينة أو تنفيذ التوزيع الآلي (رئيس التدريب) */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("TRAINING_HEAD");
  const body = await parseBody(req, schema);
  const result = await autoAssign(body.termId, body.dryRun);
  if (!body.dryRun) await audit(user.id, "placement.auto_assign", "Placement", undefined, { termId: body.termId, count: result.assigned.length });
  return NextResponse.json(result);
});
