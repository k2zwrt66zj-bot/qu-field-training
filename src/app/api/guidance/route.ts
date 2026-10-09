import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assertPlacementAccess } from "@/server/access";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NOTE"), placementId: z.string(), content: z.string().min(3).max(3000), isPrivate: z.boolean().default(false) }),
  z.object({
    kind: z.literal("TASK"),
    placementId: z.string(),
    title: z.string().min(3).max(200),
    description: z.string().max(3000).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
]);

/** POST /api/guidance — ملاحظة توجيهية أو إسناد مهمة ميدانية (المشرفان) */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR");
  const body = await parseBody(req, schema);
  await assertPlacementAccess(user, body.placementId);
  if (body.kind === "NOTE") {
    const note = await prisma.supervisorNote.create({
      data: { placementId: body.placementId, authorId: user.id, content: body.content, isPrivate: body.isPrivate },
    });
    await audit(user.id, "guidance.note", "SupervisorNote", note.id, { placementId: body.placementId }, clientIp(req));
    return NextResponse.json({ ok: true, note });
  }
  const task = await prisma.task.create({
    data: {
      placementId: body.placementId,
      assignedById: user.id,
      title: body.title,
      description: body.description,
      dueDate: body.dueDate ? new Date(`${body.dueDate}T00:00:00Z`) : undefined,
    },
  });
  await audit(user.id, "guidance.task", "Task", task.id, { placementId: body.placementId }, clientIp(req));
  return NextResponse.json({ ok: true, task });
});
