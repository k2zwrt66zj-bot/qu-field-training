import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, handler, parseBody, requireRole } from "@/lib/api";
import { createMeeting, listMeetingGroups } from "@/server/meetings";

/** GET /api/meetings — المجموعات الإشرافية واجتماعاتها ضمن نطاق المستخدم (الفصل الحالي) */
export const GET = handler(async () => {
  const user = await requireRole();
  const { term, groups } = await listMeetingGroups(user);
  return NextResponse.json({ term: term && { id: term.id, name: term.name }, groups });
});

/** POST /api/meetings {organizationId} — اجتماع جديد برقم تالٍ (المشرف الأكاديمي) */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("ACADEMIC_SUPERVISOR");
  const body = await parseBody(req, z.object({ organizationId: z.string().min(1) }));
  const m = await createMeeting(user, body.organizationId);
  await audit(user.id, "meeting.create", "SupervisionMeeting", m.id, { number: m.number });
  return NextResponse.json({ ok: true, id: m.id, number: m.number }, { status: 201 });
});
