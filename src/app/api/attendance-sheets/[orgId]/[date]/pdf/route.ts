import { handler, requireRole } from "@/lib/api";
import { loadSheet } from "@/server/attendance-sheets";
import { sheetDocPart } from "@/server/pdf/documents";
import { officialDocument } from "@/server/pdf/layout";
import { pdfResponse } from "@/server/pdf/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/attendance-sheets/:orgId/:date/pdf — كشف الحضور والانصراف الموقَّع */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ orgId: string; date: string }> }) => {
  const user = await requireRole("FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR", "TRAINING_HEAD", "DEPARTMENT_HEAD");
  const { orgId, date } = await params;
  const part = sheetDocPart(await loadSheet(user, orgId, date));
  return pdfResponse(await officialDocument(part.label, [part]), `attendance-${date}`, req);
});
