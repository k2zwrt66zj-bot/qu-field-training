import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";

export const sha256 = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");

/** ينشئ توقيعاً إلكترونياً مرتبطاً ببصمة المحتوى الموقَّع */
export async function createSignature(tx: Prisma.TransactionClient, signerId: string, imageData: string, content: unknown, ip?: string | null) {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(imageData) || imageData.length > 300_000) {
    throw new ApiError(422, "صورة التوقيع غير صالحة");
  }
  return tx.signature.create({ data: { signerId, imageData, contentHash: sha256(content), ipAddress: ip ?? undefined } });
}
