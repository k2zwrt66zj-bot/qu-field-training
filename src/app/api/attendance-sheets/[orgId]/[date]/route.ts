import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { loadSheet, signSheet } from "@/server/attendance-sheets";

type Ctx = { params: Promise<{ orgId: string; date: string }> };

/** GET /api/attendance-sheets/:orgId/:date — كشف اليوم مع التحقق من سلامة البصمة */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole("FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR", "TRAINING_HEAD", "DEPARTMENT_HEAD");
  const { orgId, date } = await params;
  return NextResponse.json({ sheet: await loadSheet(user, orgId, date) });
});

/** POST /api/attendance-sheets/:orgId/:date {imageData} — توقيع المشرف المؤسسي */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireRole("FIELD_SUPERVISOR");
  const { orgId, date } = await params;
  const body = await parseBody(req, z.object({ imageData: z.string().max(300_000) }));
  return NextResponse.json({ sheet: await signSheet(user, orgId, date, body.imageData, clientIp(req)) });
});
