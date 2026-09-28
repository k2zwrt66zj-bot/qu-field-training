import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, parseBody, requireRole } from "@/lib/api";
import { addComment } from "@/server/forms/service";

const schema = z.object({ body: z.string().trim().min(2).max(3000) });

/** POST /api/forms/:id/comments — ملاحظة مراجعة (المشاركون في النموذج؛ رئيس القسم قراءة فقط) */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole();
  const { id } = await params;
  const { body } = await parseBody(req, schema);
  const c = await addComment(user, id, body);
  return NextResponse.json({ ok: true, id: c.id }, { status: 201 });
});
