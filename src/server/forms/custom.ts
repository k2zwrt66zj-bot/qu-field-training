// النماذج الإضافية (CUSTOM): التحقق من المحتوى حسب القالب
import { z } from "zod";
import { validateContent, REPORT_TEMPLATES } from "@/lib/report-templates";

/** السجلات القديمة المرحَّلة (تبقى قابلة للمراجعة والتوقيع، ويُصحَّح المعاد منها) */
const legacyLogbookSchema = z.strictObject({
  type: z.enum(["DAILY", "WEEKLY"]).optional(),
  weekNumber: z.number().int().min(1).max(30).nullable().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  activities: z.string().max(8000).optional(),
  skills: z.string().max(4000).nullable().optional(),
  challenges: z.string().max(4000).nullable().optional(),
  reflections: z.string().max(4000).nullable().optional(),
  plannedNext: z.string().max(4000).nullable().optional(),
});

export type CustomValidation = { ok: true; data: Record<string, unknown> } | { ok: false; issues: { path: string; message: string }[] };

export function validateCustom(templateKey: string | null, data: unknown, mode: "draft" | "submit"): CustomValidation {
  if (templateKey?.startsWith("LEGACY_LOGBOOK")) {
    const r = legacyLogbookSchema.safeParse(data);
    if (!r.success) return { ok: false, issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
    if (mode === "submit" && !(r.data.activities ?? "").trim()) return { ok: false, issues: [{ path: "activities", message: "الأنشطة المنفذة: حقل مطلوب" }] };
    return { ok: true, data: r.data };
  }
  if (!templateKey || !(templateKey in REPORT_TEMPLATES)) return { ok: false, issues: [{ path: "", message: "قالب غير معروف" }] };
  try {
    const v = validateContent(templateKey as keyof typeof REPORT_TEMPLATES, data, mode === "submit");
    if (!v.ok) return { ok: false, issues: v.missing.map((m) => ({ path: "", message: `${m}: حقل مطلوب` })) };
    return { ok: true, data: v.content };
  } catch (e) {
    const issues = e instanceof z.ZodError ? e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) : [{ path: "", message: "بيانات غير صالحة" }];
    return { ok: false, issues };
  }
}

/** المحتوى دون مفاتيح النظام (_legacy) */
export const customContent = (data: unknown): Record<string, unknown> => {
  const { _legacy: _l, ...rest } = (data ?? {}) as Record<string, unknown>;
  return rest;
};
