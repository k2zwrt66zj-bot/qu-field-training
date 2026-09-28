// رفع المرفقات: فحص النوع من المحتوى، إزالة البيانات الوصفية، البصمة، ثم التخزين
import { createHash, randomUUID } from "node:crypto";
import type { AttachmentKind } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { EXTENSIONS, sanitizeUpload, type AllowedMime } from "@/lib/files/sanitize";
import { storage } from "./storage";

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024);
export const MAX_ATTACHMENTS_PER_FORM = 10;

export interface StoredFile {
  kind: AttachmentKind;
  fileName: string;
  mimeType: AllowedMime;
  sizeBytes: number;
  storageKey: string;
  sha256: string;
}

/** يقرأ ملف FormData، يتحقق منه، ينظفه ويخزنه — يعيد بيانات صف Attachment */
export async function storeUpload(file: File, prefix: string, kind: AttachmentKind, allowed: AllowedMime[]): Promise<StoredFile> {
  if (file.size === 0) throw new ApiError(422, "الملف فارغ");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, `حجم الملف يتجاوز ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجابايت`);
  const clean = sanitizeUpload(new Uint8Array(await file.arrayBuffer()));
  if (!clean || !allowed.includes(clean.mime)) throw new ApiError(415, "نوع الملف غير مسموح (المسموح: صور JPEG/PNG/WEBP أو PDF)");

  const storageKey = `${prefix}/${randomUUID()}.${EXTENSIONS[clean.mime]}`;
  await storage().put(storageKey, clean.bytes, clean.mime);
  const safeName = file.name.replace(/[^\p{L}\p{N}._\- ]/gu, "_").slice(0, 120) || `file.${EXTENSIONS[clean.mime]}`;
  return {
    kind,
    fileName: safeName,
    mimeType: clean.mime,
    sizeBytes: clean.bytes.length,
    storageKey,
    sha256: createHash("sha256").update(clean.bytes).digest("hex"),
  };
}
