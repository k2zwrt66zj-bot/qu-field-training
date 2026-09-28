import { handler, requireRole } from "@/lib/api";
import { loadMeetingFor, presentMeeting } from "@/server/meetings";
import { meetingDocPart } from "@/server/pdf/documents";
import { officialDocument } from "@/server/pdf/layout";
import { pdfResponse } from "@/server/pdf/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/meetings/:id/pdf — محضر الاجتماع الإشرافي الجماعي */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole();
  const { meeting, access } = await loadMeetingFor(user, (await params).id);
  const part = meetingDocPart(await presentMeeting(meeting, access));
  return pdfResponse(await officialDocument(part.label, [part]), part.label, req);
});
