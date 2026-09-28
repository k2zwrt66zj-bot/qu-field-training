import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { presentMeeting, transitionMeeting } from "@/server/meetings";

const schema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "RETURN"]),
  imageData: z.string().max(300_000).optional(),
  comment: z.string().trim().max(2000).optional(),
});

/** POST /api/meetings/:id/transition — رفع (الأمين) / اعتماد أو إعادة (رئيس الاجتماع) */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole();
  const body = await parseBody(req, schema);
  const { meeting, access } = await transitionMeeting(user, (await params).id, body, clientIp(req));
  return NextResponse.json({ meeting: await presentMeeting(meeting, access) });
});
