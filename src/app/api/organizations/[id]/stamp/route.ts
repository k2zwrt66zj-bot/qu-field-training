import { NextResponse } from "next/server";
import { ApiError, audit, clientIp, handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { storeUpload } from "@/server/attachments";
import { storage } from "@/server/storage";

/** POST /api/organizations/:id/stamp — رفع/استبدال الختم الرسمي للمؤسسة (PNG شفاف مفضل) */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("TRAINING_HEAD", "FIELD_SUPERVISOR");
  const { id } = await params;
  if (user.role === "FIELD_SUPERVISOR") {
    const own = await prisma.fieldSupervisorProfile.count({ where: { userId: user.id, organizationId: id } });
    if (!own) throw new ApiError(403, "لا يمكنك رفع ختم لمؤسسة أخرى");
  }
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "أرفق صورة الختم في الحقل file");

  const stored = await storeUpload(file, `stamps/${id}`, "STAMP", ["image/png", "image/jpeg"]);
  const old = await prisma.attachment.findMany({ where: { organizationId: id, kind: "STAMP" } });
  const a = await prisma.$transaction(async (tx) => {
    await tx.attachment.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return tx.attachment.create({ data: { ...stored, organizationId: id, uploadedById: user.id, caption: "الختم الرسمي" } });
  });
  await Promise.all(old.map((o) => storage().remove(o.storageKey)));
  await audit(user.id, "organization.stamp", "Organization", id, { attachmentId: a.id, sha256: a.sha256 }, clientIp(req));
  return NextResponse.json({ ok: true, id: a.id }, { status: 201 });
});
