import { NextResponse } from "next/server";
import { ApiError, handler, requireRole } from "@/lib/api";
import { deleteForm, loadFormFor, presentForm, saveDraft } from "@/server/forms/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/forms/:id — النموذج كاملاً مع الإجراءات المسموحة للمستخدم */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole();
  const { id } = await params;
  const { form, actor } = await loadFormFor(user, id);
  return NextResponse.json({ form: presentForm(form, actor) });
});

/** PATCH /api/forms/:id — حفظ المسودة (تحقق «مسودة»: الأنواع والحدود فقط) */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireRole();
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "صيغة الطلب غير صحيحة");
  }
  const data = (body as { data?: unknown })?.data;
  if (!data || typeof data !== "object") throw new ApiError(422, "أرسل الحقول داخل data");
  const { form, actor } = await saveDraft(user, id, data);
  return NextResponse.json({ ok: true, form: presentForm(form, actor) });
});

/** DELETE /api/forms/:id — حذف مسودة لم تُرفع قط */
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  await deleteForm(user, id);
  return NextResponse.json({ ok: true });
});
