import { NextResponse } from "next/server";
import { ApiError, audit, clientIp, handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { loadFormFor } from "@/server/forms/service";
import { MAX_ATTACHMENTS_PER_FORM, storeUpload } from "@/server/attachments";

/**
 * POST /api/forms/:id/attachments (multipart: file, caption?)
 * «الصور والشواهد والأدلة» — تُزال منها بيانات الموقع (EXIF) قبل الحفظ
 */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const { form } = await loadFormFor(user, id, "UPLOAD");
  if (form.attachments.length >= MAX_ATTACHMENTS_PER_FORM) throw new ApiError(422, `الحد الأقصى ${MAX_ATTACHMENTS_PER_FORM} مرفقات للنموذج`);

  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "أرفق ملفاً في الحقل file");
  const caption = String(fd?.get("caption") ?? "").trim().slice(0, 300) || null;

  const stored = await storeUpload(file, `forms/${form.id}`, "EVIDENCE", ["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  const a = await prisma.attachment.create({ data: { ...stored, caption, formId: form.id, uploadedById: user.id } });
  await audit(user.id, "attachment.upload", "Attachment", a.id, { formId: form.id, sha256: a.sha256 }, clientIp(req));
  return NextResponse.json({ ok: true, attachment: { id: a.id, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, url: `/api/attachments/${a.id}` } }, { status: 201 });
});
