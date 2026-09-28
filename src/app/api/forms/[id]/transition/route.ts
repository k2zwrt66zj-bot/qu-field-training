import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { FORM_ACTIONS } from "@/lib/forms/workflow";
import { presentForm, transitionForm } from "@/server/forms/service";

const schema = z.object({
  action: z.enum(FORM_ACTIONS),
  comment: z.string().max(3000).optional(),
  score: z.number().min(0).max(100).optional(),
  signatures: z
    .array(
      z.object({
        slot: z.enum(["STUDENT", "FIELD_SUPERVISOR", "ORG_DIRECTOR"]),
        imageData: z.string().max(300_000),
        signerName: z.string().trim().min(3).max(120).optional(),
        signerTitle: z.string().trim().max(120).optional(),
        withStamp: z.boolean().optional(),
      })
    )
    .max(3)
    .optional(),
});

/**
 * POST /api/forms/:id/transition
 * { action: SUBMIT | FIELD_SIGN | FIELD_RETURN | ACADEMIC_APPROVE | ACADEMIC_RETURN, signatures?, comment?, score? }
 */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole();
  const { id } = await params;
  const body = await parseBody(req, schema);
  const { form, actor } = await transitionForm(user, id, body, clientIp(req));
  return NextResponse.json({ ok: true, form: presentForm(form, actor) });
});
