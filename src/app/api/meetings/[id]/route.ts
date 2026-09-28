import { NextResponse } from "next/server";
import { audit, handler, requireRole } from "@/lib/api";
import { deleteMeeting, loadMeetingFor, presentMeeting, updateMeeting } from "@/server/meetings";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/meetings/:id */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole();
  const { meeting, access } = await loadMeetingFor(user, (await params).id);
  return NextResponse.json({ meeting: await presentMeeting(meeting, access) });
});

/** PATCH /api/meetings/:id — رئيس الاجتماع: كل البيانات؛ الأمين: المحضر والقرارات (في المسودة) */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireRole();
  const { meeting, access } = await updateMeeting(user, (await params).id, await req.json().catch(() => ({})));
  return NextResponse.json({ meeting: await presentMeeting(meeting, access) });
});

/** DELETE /api/meetings/:id — مسودة لم تُرفع وليس بعدها اجتماع */
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole("ACADEMIC_SUPERVISOR");
  const { id } = await params;
  await deleteMeeting(user, id);
  await audit(user.id, "meeting.delete", "SupervisionMeeting", id);
  return NextResponse.json({ ok: true });
});
