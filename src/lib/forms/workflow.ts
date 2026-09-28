// =====================================================================
//  آلة حالات النماذج (نقية)
//  DRAFT ─submit→ SUBMITTED ─field_sign→ SIGNED ─academic_approve→ REVIEWED
//     ▲               │                    │
//     └── RETURNED ◄──┴──── return ────────┘      (القراءات: SUBMITTED ─academic_approve→ REVIEWED)
// =====================================================================
import type { DocumentStatus, SignatureSlot } from "@prisma/client";
import type { FormPolicy } from "./catalog.ts";

export const FORM_ACTIONS = ["SUBMIT", "FIELD_SIGN", "FIELD_RETURN", "ACADEMIC_APPROVE", "ACADEMIC_RETURN"] as const;
export type FormAction = (typeof FORM_ACTIONS)[number];

export const ACTION_LABELS: Record<FormAction, string> = {
  SUBMIT: "رفع النموذج",
  FIELD_SIGN: "توقيع المشرف المؤسسي واعتماده",
  FIELD_RETURN: "إعادة من المشرف المؤسسي",
  ACADEMIC_APPROVE: "اعتماد المشرف الأكاديمي",
  ACADEMIC_RETURN: "إعادة من المشرف الأكاديمي",
};

export type TransitionResult =
  | { ok: true; to: DocumentStatus; requiredSlots: SignatureSlot[]; clearSignatures: boolean; requiresComment: boolean }
  | { ok: false; error: string };

export function nextState(policy: FormPolicy, from: DocumentStatus, action: FormAction, opts: { locked?: boolean } = {}): TransitionResult {
  const fail = (error: string): TransitionResult => ({ ok: false, error });
  if (opts.locked) return fail("النموذج مقفل بعد اعتماد النتيجة النهائية");

  switch (action) {
    case "SUBMIT":
      if (from !== "DRAFT" && from !== "RETURNED") return fail("لا يمكن رفع النموذج في حالته الحالية");
      return { ok: true, to: "SUBMITTED", requiredSlots: policy.slotsOnSubmit, clearSignatures: false, requiresComment: false };

    case "FIELD_SIGN":
      if (!policy.fieldApproval) return fail("هذا النموذج لا يتطلب توقيع المشرف المؤسسي");
      if (from !== "SUBMITTED") return fail("النموذج ليس بانتظار توقيع المشرف المؤسسي");
      return { ok: true, to: "SIGNED", requiredSlots: policy.slotsOnFieldSign, clearSignatures: false, requiresComment: false };

    case "FIELD_RETURN":
      if (!policy.fieldApproval) return fail("هذا النموذج لا يمرّ على المشرف المؤسسي");
      if (from !== "SUBMITTED") return fail("لا يمكن إعادة النموذج في حالته الحالية");
      return { ok: true, to: "RETURNED", requiredSlots: [], clearSignatures: true, requiresComment: true };

    case "ACADEMIC_APPROVE": {
      const ready = policy.fieldApproval ? from === "SIGNED" : from === "SUBMITTED";
      if (!ready) return fail(policy.fieldApproval ? "يُعتمد النموذج أكاديمياً بعد توقيع المشرف المؤسسي" : "النموذج ليس بانتظار الاعتماد");
      return { ok: true, to: "REVIEWED", requiredSlots: [], clearSignatures: false, requiresComment: false };
    }

    case "ACADEMIC_RETURN":
      if (from !== "SUBMITTED" && from !== "SIGNED") return fail("لا يمكن إعادة النموذج في حالته الحالية");
      // إعادة نموذج موقَّع تُسقط التواقيع لأن المحتوى سيتغير
      return { ok: true, to: "RETURNED", requiredSlots: [], clearSignatures: true, requiresComment: true };
  }
}

/** هل يمكن تعديل محتوى النموذج في هذه الحالة (للطالب)؟ */
export const isEditableStatus = (s: DocumentStatus) => s === "DRAFT" || s === "RETURNED";
