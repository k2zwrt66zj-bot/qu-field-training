// بصمة كشف الحضور اليومي (نقية — تُستخدم في الخادم والاختبارات)
import { createHash } from "node:crypto";
import { canonicalJson } from "./forms/canonical.ts";

export type RecordForHash = { status: string; checkInAt: Date | null; checkOutAt: Date | null; workedMinutes: number } | null;

/**
 * ما يُقرّ به المشرف المؤسسي عند التوقيع: الحالة والأوقات والمدة لكل متدرب في يوم تدريبه
 * (قرار اعتماد الساعات ليس جزءاً منها: يُعتمد لاحقاً دون أن يغيّر الكشف)
 */
export function sheetRecordsHash(rows: { placementId: string; record: RecordForHash }[]): string {
  const payload = [...rows]
    .sort((a, b) => (a.placementId < b.placementId ? -1 : 1))
    .map(({ placementId, record: r }) => ({
      placementId,
      status: r?.status ?? null,
      checkInAt: r?.checkInAt?.toISOString() ?? null,
      checkOutAt: r?.checkOutAt?.toISOString() ?? null,
      workedMinutes: r?.workedMinutes ?? 0,
    }));
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}
