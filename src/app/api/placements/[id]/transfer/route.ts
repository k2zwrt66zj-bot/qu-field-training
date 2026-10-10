import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, parseBody, requireRole } from "@/lib/api";
import { transferPlacement } from "@/server/placement-transfer";

const schema = z.object({
  toOrganizationId: z.string().min(1, "اختر جهة التدريب الجديدة"),
  toFieldSupervisorId: z.string().min(1).nullable().default(null),
  reason: z.string().trim().min(5, "اذكر سبب النقل (5 أحرف على الأقل)").max(1000),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ النقل غير صحيح"),
  carryOverHours: z.boolean(),
});

/**
 * POST /api/placements/:id/transfer — نقل الطالب إلى مقر تدريب آخر.
 * يؤرشف الإسناد الحالي (TRANSFERRED) وينشئ إسناداً جديداً، ويسجّل العملية في سجل التدقيق.
 * رئيسة الوحدة / الإدارة فقط.
 */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id } = await params;
  const body = await parseBody(req, schema);
  const result = await transferPlacement(user, { placementId: id, ...body });
  return NextResponse.json({ ok: true, ...result });
});
