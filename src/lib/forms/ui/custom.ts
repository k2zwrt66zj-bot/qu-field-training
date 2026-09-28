// النماذج الإضافية (CUSTOM): تحويل قوالب report-templates السابقة إلى نفس الوصف التصريحي،
// ووصف للسجلات القديمة المرحَّلة (عرض فقط)
import { REPORT_TEMPLATES, type Field } from "../../report-templates.ts";
import type { FieldSpec, FormSpec } from "./types.ts";

/** القوالب الإضافية المتاحة للإنشاء الجديد (قرار القسم: تبقى نماذج إضافية) */
export const CUSTOM_CREATABLE = ["FIELD_RESEARCH", "SOCIAL_SURVEY", "FINAL_REPORT"] as const;
export type CustomTemplateKey = (typeof CUSTOM_CREATABLE)[number];

function toField(f: Field): FieldSpec {
  const base = { key: f.key, label: f.label, hint: f.hint };
  switch (f.type) {
    case "textarea":
      return { ...base, wide: true, widget: { type: "prose" } };
    case "text":
      return { ...base, wide: f.wide, widget: { type: "text", placeholder: f.placeholder } };
    case "number":
      return { ...base, widget: { type: "number", min: f.min, max: f.max } };
    case "date":
      return { ...base, widget: { type: "date" } };
    case "select":
      return { ...base, widget: { type: "choice", layout: "inline", options: f.options.map((o) => ({ value: o, label: o })) } };
    case "checkbox":
      return { ...base, wide: true, widget: { type: "consent", text: f.label } };
    case "table":
      return {
        ...base, wide: true,
        widget: { type: "rows", max: f.maxRows ?? 50, columns: f.columns.map((c) => ({ key: c.key, label: c.label, type: c.type === "number" ? "number" : "text", width: c.width })) },
      };
  }
}

const LEGACY_LOGBOOK: FormSpec = {
  sections: [
    {
      id: "legacy", title: "سجل سابق (قبل اعتماد النماذج الرسمية)",
      description: "سجل مرحَّل من النظام السابق للعرض والأرشفة.",
      fields: [
        { key: "weekNumber", label: "الأسبوع", widget: { type: "number" } },
        { key: "periodStart", label: "من", widget: { type: "date" } },
        { key: "periodEnd", label: "إلى", widget: { type: "date" } },
        { key: "activities", label: "الأنشطة والمهام المنفذة", wide: true, widget: { type: "prose" } },
        { key: "skills", label: "المهارات المكتسبة", wide: true, widget: { type: "prose" } },
        { key: "challenges", label: "الصعوبات", wide: true, widget: { type: "prose" } },
        { key: "reflections", label: "التأمل المهني", wide: true, widget: { type: "prose" } },
        { key: "plannedNext", label: "خطة الفترة القادمة", wide: true, widget: { type: "prose" } },
      ],
    },
  ],
};

export function customSpec(templateKey: string | null): FormSpec {
  if (templateKey?.startsWith("LEGACY_LOGBOOK")) return LEGACY_LOGBOOK;
  const t = templateKey ? REPORT_TEMPLATES[templateKey as keyof typeof REPORT_TEMPLATES] : undefined;
  if (!t) return { sections: [] };
  return { sections: t.sections.map((s, i) => ({ id: `s${i}`, title: `${i + 1}. ${s.title}`, description: s.description, fields: s.fields.map(toField) })) };
}

export function customTitle(templateKey: string | null): string {
  if (templateKey === "LEGACY_LOGBOOK_WEEKLY") return "سجل أسبوعي (أرشيف)";
  if (templateKey === "LEGACY_LOGBOOK_DAILY") return "سجل يومي (أرشيف)";
  const t = templateKey ? REPORT_TEMPLATES[templateKey as keyof typeof REPORT_TEMPLATES] : undefined;
  return t ? t.title : "نموذج إضافي";
}

export const isLegacyTemplate = (templateKey: string | null) => !!templateKey?.startsWith("LEGACY_");
