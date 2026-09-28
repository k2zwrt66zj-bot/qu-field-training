// اشتقاق «الحقول الناقصة» من قواعد الرفع نفسها (مصدر واحد للحقيقة مع الخادم)
import type { FormKind, SituationDomain } from "@prisma/client";
import { validateForm } from "../schemas/index.ts";

export interface SubmitCheck {
  ready: boolean;
  /** رسائل لكل حقل (المفتاح الأعلى في المسار) */
  byField: Record<string, string[]>;
  messages: string[];
}

export function checkSubmit(kind: Exclude<FormKind, "CUSTOM">, data: Record<string, unknown>, domain?: SituationDomain | null): SubmitCheck {
  const r = validateForm(kind, data, "submit", domain);
  if (r.ok) return { ready: true, byField: {}, messages: [] };
  const byField: Record<string, string[]> = {};
  for (const i of r.issues) {
    const key = i.path.split(".")[0] || "_";
    (byField[key] ??= []).push(i.message);
  }
  return { ready: false, byField, messages: r.issues.map((i) => i.message) };
}
