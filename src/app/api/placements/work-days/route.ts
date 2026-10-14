import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  placementIds: z.array(z.string().min(1)).min(1, "حدد طالباً واحداً على الأقل").max(500),
  // أيام التدريب الأسبوعية للطالب (0=الأحد ... 6=السبت)؛ تُرتَّب وتُزال المكررات
  workDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, "اختر يوم تدريب واحداً على الأقل")
    .max(7)
    .transform((d) => [...new Set(d)].sort((a, b) => a - b)),
});

/**
 * POST /api/placements/work-days — تحديد يوم/أيام التدريب لطالب أو مجموعة طلاب (رئيس التدريب).
 * يسري على الإسنادات الجارية فقط؛ المنتهية والمنقولة تبقى كما هي لحفظ سجلها.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("TRAINING_HEAD");
  const { placementIds, workDays } = await parseBody(req, schema);
  const ids = [...new Set(placementIds)];
  const { count } = await prisma.placement.updateMany({
    where: { id: { in: ids }, status: { in: ["ASSIGNED", "ACTIVE"] } },
    data: { workDays },
  });
  if (count === 0) throw new ApiError(422, "لا توجد إسنادات جارية ضمن الطلاب المحددين");
  await audit(user.id, "placement.work_days", "Placement", ids.length === 1 ? ids[0] : undefined, { placementIds: ids, workDays }, clientIp(req));
  return NextResponse.json({ ok: true, updated: count, skipped: ids.length - count });
});
