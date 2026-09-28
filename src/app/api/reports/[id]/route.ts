import { NextResponse } from "next/server";
import { ApiError, handler, requireRole } from "@/lib/api";
import { loadReport } from "@/server/reports";
import { legacyGone } from "@/server/legacy";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/reports/:id — تقرير قديم (أرشيف للقراءة فقط) */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole();
  const { id } = await params;
  const report = await loadReport(user, id);
  if (user.role !== "STUDENT" && report.status === "DRAFT") throw new ApiError(404, "التقرير غير موجود");
  return NextResponse.json({ report });
});

/** التعديل والحذف متوقفان بعد التحول إلى النماذج الرسمية */
export const PATCH = legacyGone;
export const DELETE = legacyGone;
