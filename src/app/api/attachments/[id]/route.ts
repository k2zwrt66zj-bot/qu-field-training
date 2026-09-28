import { ApiError, handler, requireRole, type SessionUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { loadFormFor } from "@/server/forms/service";
import { storage } from "@/server/storage";

type Ctx = { params: Promise<{ id: string }> };

/** صلاحية الوصول: مرفق نموذج ← صلاحية عرض النموذج؛ ختم مؤسسة ← مشرفوها ورئاسة القسم */
async function authorize(user: SessionUser, id: string, forDelete = false) {
  const a = await prisma.attachment.findUnique({ where: { id } });
  if (!a) throw new ApiError(404, "المرفق غير موجود");
  if (a.formId) {
    await loadFormFor(user, a.formId, forDelete ? "UPLOAD" : "VIEW");
    return a;
  }
  if (a.organizationId) {
    const heads = ["TRAINING_HEAD", "DEPARTMENT_HEAD", "ADMIN"].includes(user.role);
    const ownSupervisor = await prisma.fieldSupervisorProfile.count({ where: { userId: user.id, organizationId: a.organizationId } });
    if (heads || ownSupervisor) return a;
  }
  throw new ApiError(404, "المرفق غير موجود");
}

/** GET /api/attachments/:id — تنزيل عبر الخادم فقط (لا روابط عامة) */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole();
  const { id } = await params;
  const a = await authorize(user, id);
  const bytes = await storage().get(a.storageKey);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});

/** DELETE /api/attachments/:id — حذف مرفق من نموذج قابل للتعديل */
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const a = await authorize(user, id, true);
  await prisma.attachment.delete({ where: { id: a.id } });
  await storage().remove(a.storageKey);
  return Response.json({ ok: true });
});
