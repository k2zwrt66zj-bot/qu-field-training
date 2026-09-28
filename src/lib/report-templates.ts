// =====================================================================
//  قوالب التقارير الميدانية (تعريف تصريحي واحد يولّد: النموذج + العرض + التحقق)
//  لتعديل قالب أو إضافة حقل: عدّل هذا الملف فقط.
// =====================================================================
import { z } from "zod";
import type { Major, ReportTemplate } from "@prisma/client";

export interface Column {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string[];
  width?: string;
}

export type Field =
  | { key: string; label: string; type: "text" | "textarea" | "date"; required?: boolean; hint?: string; placeholder?: string; wide?: boolean; max?: number }
  | { key: string; label: string; type: "number"; required?: boolean; hint?: string; min?: number; max?: number }
  | { key: string; label: string; type: "select"; options: string[]; required?: boolean; hint?: string }
  | { key: string; label: string; type: "checkbox"; required?: boolean; hint?: string }
  | { key: string; label: string; type: "table"; columns: Column[]; minRows?: number; maxRows?: number; required?: boolean; hint?: string };

export interface Section {
  title: string;
  description?: string;
  fields: Field[];
}

export interface TemplateDef {
  id: ReportTemplate;
  title: string;
  description: string;
  majors: Major[];
  notice?: string; // تنبيه أخلاقي/منهجي يظهر أعلى النموذج
  sections: Section[];
}

const SAMPLING = ["عشوائية بسيطة", "عشوائية طبقية", "عنقودية", "منتظمة", "عمدية (قصدية)", "كرة الثلج", "حصصية", "متاحة"];

export const REPORT_TEMPLATES: Record<ReportTemplate, TemplateDef> = {
  // -------------------------------------------------------------- خدمة الفرد
  CASE_STUDY: {
    id: "CASE_STUDY",
    title: "دراسة حالة",
    description: "دراسة حالة فردية وفق مراحل الممارسة المهنية: الدراسة، التشخيص، العلاج، التقويم.",
    majors: ["SOCIAL_WORK"],
    notice: "التزاماً بأخلاقيات المهنة وسرية المعلومات: لا تكتب الاسم الحقيقي للعميل أو رقم هويته أو أي بيانات تدل عليه، واستخدم اسماً رمزياً.",
    sections: [
      {
        title: "البيانات الأولية",
        fields: [
          { key: "caseCode", label: "الاسم الرمزي للحالة", type: "text", required: true, placeholder: "مثال: الحالة (أ)", hint: "لا تستخدم الاسم الحقيقي" },
          { key: "gender", label: "الجنس", type: "select", options: ["ذكر", "أنثى"], required: true },
          { key: "age", label: "العمر", type: "number", min: 0, max: 120, required: true },
          { key: "maritalStatus", label: "الحالة الاجتماعية", type: "select", options: ["أعزب/عزباء", "متزوج/ة", "مطلق/ة", "أرمل/ة"] },
          { key: "education", label: "المستوى التعليمي", type: "text" },
          { key: "occupation", label: "المهنة / مصدر الدخل", type: "text" },
          { key: "referralSource", label: "مصدر التحويل", type: "select", options: ["حضور ذاتي", "تحويل داخلي", "جهة خارجية", "الأسرة", "أخرى"], required: true },
          { key: "firstContact", label: "تاريخ أول مقابلة", type: "date", required: true },
        ],
      },
      {
        title: "المشكلة",
        fields: [
          { key: "presentingProblem", label: "المشكلة كما يعرضها العميل", type: "textarea", required: true },
          { key: "problemHistory", label: "تاريخ المشكلة وتطورها", type: "textarea", required: true },
        ],
      },
      {
        title: "الدراسة وجمع البيانات",
        fields: [
          {
            key: "interviews",
            label: "المقابلات ومصادر المعلومات",
            type: "table",
            minRows: 1,
            maxRows: 20,
            required: true,
            columns: [
              { key: "date", label: "التاريخ", type: "date", width: "130px" },
              { key: "source", label: "المصدر", type: "select", options: ["العميل", "الأسرة", "فريق العمل", "السجلات والوثائق", "زيارة منزلية", "أخرى"], width: "150px" },
              { key: "purpose", label: "الهدف", type: "text" },
              { key: "outcome", label: "أبرز ما توصلت إليه", type: "text" },
            ],
          },
          { key: "familyContext", label: "البيئة الأسرية", type: "textarea", required: true },
          { key: "socioEconomic", label: "الظروف الاجتماعية والاقتصادية والصحية", type: "textarea" },
          { key: "strengths", label: "نقاط القوة والموارد المتاحة", type: "textarea", required: true },
        ],
      },
      {
        title: "التشخيص المهني",
        fields: [
          { key: "diagnosis", label: "التشخيص وتحديد العوامل المسببة", type: "textarea", required: true },
          {
            key: "theoreticalModel",
            label: "المدخل / النموذج النظري الموجِّه",
            type: "select",
            required: true,
            options: ["حل المشكلة", "المعرفي السلوكي", "الأنساق الإيكولوجي", "التدخل في الأزمات", "التركيز على المهام", "التمكين", "الواقعي", "أخرى"],
          },
          { key: "modelJustification", label: "مبررات اختيار النموذج", type: "textarea" },
        ],
      },
      {
        title: "خطة التدخل المهني",
        fields: [
          {
            key: "plan",
            label: "أهداف التدخل",
            type: "table",
            minRows: 1,
            maxRows: 15,
            required: true,
            columns: [
              { key: "goal", label: "الهدف", type: "text" },
              { key: "techniques", label: "الأساليب والتكنيكات", type: "text" },
              { key: "timeline", label: "المدة", type: "text", width: "110px" },
              { key: "indicator", label: "مؤشر التحقق", type: "text" },
            ],
          },
        ],
      },
      {
        title: "التقويم والإنهاء",
        fields: [
          { key: "progress", label: "ما تحقق من أهداف التدخل", type: "textarea", required: true },
          { key: "evaluation", label: "تقويم الطالب لأدائه المهني", type: "textarea" },
          { key: "recommendations", label: "التوصيات والمتابعة", type: "textarea", required: true },
          { key: "consent", label: "أقر بالحصول على موافقة العميل وإخفاء جميع البيانات الدالة على هويته", type: "checkbox", required: true },
        ],
      },
    ],
  },

  // -------------------------------------------------------------- تنظيم المجتمع
  SOCIAL_INTERVENTION: {
    id: "SOCIAL_INTERVENTION",
    title: "خطة تدخل اجتماعي",
    description: "مشروع تدخل مهني على مستوى المؤسسة أو المجتمع المحلي: تقدير الاحتياجات، الأهداف، التنفيذ، التقويم.",
    majors: ["SOCIAL_WORK"],
    sections: [
      {
        title: "تحديد الاحتياج",
        fields: [
          { key: "projectTitle", label: "عنوان المشروع / التدخل", type: "text", required: true, wide: true },
          { key: "targetGroup", label: "الفئة المستهدفة", type: "text", required: true },
          { key: "beneficiaries", label: "العدد التقديري للمستفيدين", type: "number", min: 1, max: 100000 },
          { key: "needsAssessment", label: "تقدير الاحتياجات وأدواته", type: "textarea", required: true, hint: "مثل: استبانة، مقابلات، مجموعات بؤرية، بيانات الجهة" },
          { key: "problemStatement", label: "تحديد المشكلة / الاحتياج ذي الأولوية", type: "textarea", required: true },
        ],
      },
      {
        title: "التخطيط",
        fields: [
          { key: "generalGoal", label: "الهدف العام", type: "textarea", required: true },
          {
            key: "objectives",
            label: "الأهداف التفصيلية والأنشطة",
            type: "table",
            minRows: 1,
            maxRows: 15,
            required: true,
            columns: [
              { key: "objective", label: "الهدف", type: "text" },
              { key: "activities", label: "الأنشطة", type: "text" },
              { key: "resources", label: "الموارد", type: "text" },
              { key: "timeline", label: "التوقيت", type: "text", width: "110px" },
              { key: "indicator", label: "مؤشر الأداء", type: "text" },
            ],
          },
          { key: "partners", label: "الشركاء والجهات المتعاونة", type: "textarea" },
          { key: "risks", label: "المعوقات المتوقعة وطرق التعامل معها", type: "textarea" },
        ],
      },
      {
        title: "التنفيذ والتقويم",
        fields: [
          { key: "implementation", label: "ما تم تنفيذه فعلياً", type: "textarea", required: true },
          { key: "evaluationMethod", label: "أسلوب التقويم", type: "textarea", required: true },
          { key: "results", label: "النتائج والأثر", type: "textarea", required: true },
          { key: "sustainability", label: "الاستدامة والتوصيات", type: "textarea" },
        ],
      },
    ],
  },

  // -------------------------------------------------------------- خدمة الجماعة
  GROUP_WORK: {
    id: "GROUP_WORK",
    title: "خدمة الجماعة",
    description: "تقرير العمل مع جماعة: تكوين الجماعة، أهدافها، الاجتماعات، التفاعل الجماعي، والتقويم.",
    majors: ["SOCIAL_WORK"],
    notice: "استخدم أسماء رمزية لأعضاء الجماعة.",
    sections: [
      {
        title: "بيانات الجماعة",
        fields: [
          { key: "groupName", label: "اسم الجماعة", type: "text", required: true },
          { key: "groupType", label: "نوع الجماعة", type: "select", required: true, options: ["علاجية", "تعليمية", "نمو وتنمية", "ترويحية", "مهام / لجان", "دعم ومساندة"] },
          { key: "membersCount", label: "عدد الأعضاء", type: "number", min: 2, max: 100, required: true },
          { key: "ageRange", label: "الفئة العمرية", type: "text" },
          { key: "formation", label: "أسس اختيار الأعضاء وتكوين الجماعة", type: "textarea", required: true },
          { key: "groupGoals", label: "أهداف الجماعة", type: "textarea", required: true },
        ],
      },
      {
        title: "الاجتماعات",
        fields: [
          {
            key: "sessions",
            label: "سجل الاجتماعات",
            type: "table",
            minRows: 1,
            maxRows: 30,
            required: true,
            columns: [
              { key: "no", label: "رقم", type: "number", width: "70px" },
              { key: "date", label: "التاريخ", type: "date", width: "130px" },
              { key: "topic", label: "الموضوع / البرنامج", type: "text" },
              { key: "attendance", label: "الحضور", type: "number", width: "80px" },
              { key: "observations", label: "الملاحظات", type: "text" },
            ],
          },
        ],
      },
      {
        title: "التحليل والتقويم",
        fields: [
          { key: "groupDynamics", label: "التفاعل الجماعي (الأدوار، القيادة، التماسك، الصراع)", type: "textarea", required: true },
          { key: "workerRole", label: "دور الأخصائي مع الجماعة", type: "textarea", required: true },
          { key: "evaluation", label: "تقويم تحقق الأهداف", type: "textarea", required: true },
          { key: "recommendations", label: "التوصيات", type: "textarea" },
        ],
      },
    ],
  },

  // -------------------------------------------------------------- علم الاجتماع
  FIELD_RESEARCH: {
    id: "FIELD_RESEARCH",
    title: "بحث ميداني",
    description: "بحث اجتماعي تطبيقي مصغّر في جهة التدريب: المشكلة، المنهج، العينة، الأدوات، النتائج.",
    majors: ["SOCIOLOGY"],
    notice: "احصل على موافقة جهة التدريب والمبحوثين قبل جمع البيانات، والتزم بسرية الاستجابات.",
    sections: [
      {
        title: "الإطار العام",
        fields: [
          { key: "researchTitle", label: "عنوان البحث", type: "text", required: true, wide: true },
          { key: "problem", label: "مشكلة البحث", type: "textarea", required: true },
          { key: "importance", label: "أهمية البحث (النظرية والتطبيقية)", type: "textarea", required: true },
          { key: "objectives", label: "أهداف البحث", type: "textarea", required: true },
          { key: "questions", label: "تساؤلات البحث / فروضه", type: "textarea", required: true },
          { key: "concepts", label: "المفاهيم الإجرائية", type: "textarea" },
          { key: "theory", label: "الإطار النظري الموجِّه", type: "textarea", required: true, hint: "مثل: البنائية الوظيفية، التفاعلية الرمزية، نظرية الصراع، رأس المال الاجتماعي" },
        ],
      },
      {
        title: "الإجراءات المنهجية",
        fields: [
          { key: "method", label: "المنهج", type: "select", required: true, options: ["الوصفي التحليلي", "المسح الاجتماعي", "دراسة الحالة", "المقارن", "النوعي (الكيفي)", "المختلط"] },
          { key: "population", label: "مجتمع البحث", type: "text", required: true },
          { key: "sampleType", label: "نوع العينة", type: "select", required: true, options: SAMPLING },
          { key: "sampleSize", label: "حجم العينة", type: "number", min: 1, max: 100000, required: true },
          { key: "tools", label: "أدوات جمع البيانات", type: "text", required: true, placeholder: "استبانة، مقابلة، ملاحظة..." },
          { key: "validity", label: "الصدق والثبات", type: "textarea" },
          { key: "fieldworkPeriod", label: "فترة العمل الميداني", type: "text" },
          { key: "analysis", label: "أساليب التحليل", type: "text", placeholder: "تكرارات ونسب، متوسطات، تحليل موضوعي..." },
        ],
      },
      {
        title: "النتائج",
        fields: [
          { key: "findings", label: "عرض النتائج", type: "textarea", required: true },
          { key: "discussion", label: "مناقشة النتائج في ضوء الإطار النظري والدراسات السابقة", type: "textarea", required: true },
          { key: "recommendations", label: "التوصيات", type: "textarea", required: true },
          { key: "references", label: "المراجع", type: "textarea", required: true },
        ],
      },
    ],
  },

  SOCIAL_SURVEY: {
    id: "SOCIAL_SURVEY",
    title: "مسح اجتماعي",
    description: "مسح اجتماعي لخصائص فئة أو ظاهرة في نطاق جهة التدريب مع عرض المؤشرات الكمية.",
    majors: ["SOCIOLOGY"],
    sections: [
      {
        title: "تصميم المسح",
        fields: [
          { key: "surveyTitle", label: "عنوان المسح", type: "text", required: true, wide: true },
          { key: "objective", label: "هدف المسح", type: "textarea", required: true },
          { key: "area", label: "النطاق الجغرافي / المؤسسي", type: "text", required: true },
          { key: "population", label: "المجتمع المستهدف", type: "text", required: true },
          { key: "sampleMethod", label: "أسلوب المعاينة", type: "select", required: true, options: ["شامل", ...SAMPLING] },
          { key: "sampleSize", label: "حجم العينة المستهدف", type: "number", min: 1, max: 100000, required: true },
          { key: "responses", label: "عدد الاستجابات الصالحة", type: "number", min: 0, max: 100000, required: true },
          { key: "instrument", label: "أداة المسح", type: "select", required: true, options: ["استبانة ورقية", "استبانة إلكترونية", "مقابلة مقننة", "دليل ملاحظة"] },
          { key: "period", label: "فترة جمع البيانات", type: "text" },
        ],
      },
      {
        title: "المتغيرات",
        fields: [
          {
            key: "variables",
            label: "متغيرات المسح",
            type: "table",
            minRows: 1,
            maxRows: 30,
            required: true,
            columns: [
              { key: "name", label: "المتغير", type: "text" },
              { key: "kind", label: "النوع", type: "select", options: ["ديموغرافي", "مستقل", "تابع", "وسيط"], width: "130px" },
              { key: "measure", label: "طريقة القياس", type: "text" },
            ],
          },
        ],
      },
      {
        title: "النتائج",
        fields: [
          {
            key: "indicators",
            label: "المؤشرات الرئيسية",
            type: "table",
            minRows: 1,
            maxRows: 40,
            required: true,
            columns: [
              { key: "indicator", label: "المؤشر / الفئة", type: "text" },
              { key: "count", label: "التكرار", type: "number", width: "100px" },
              { key: "percent", label: "النسبة %", type: "number", width: "100px" },
            ],
          },
          { key: "keyFindings", label: "أبرز النتائج", type: "textarea", required: true },
          { key: "limitations", label: "حدود المسح وصعوباته", type: "textarea" },
          { key: "recommendations", label: "التوصيات", type: "textarea", required: true },
        ],
      },
    ],
  },

  // -------------------------------------------------------------- للتخصصين
  FINAL_REPORT: {
    id: "FINAL_REPORT",
    title: "التقرير الختامي",
    description: "تقرير نهاية التدريب: التعريف بالجهة، ما أُنجز، المهارات، وربط النظرية بالتطبيق.",
    majors: ["SOCIAL_WORK", "SOCIOLOGY"],
    sections: [
      {
        title: "جهة التدريب",
        fields: [
          { key: "orgOverview", label: "نبذة عن الجهة ورسالتها", type: "textarea", required: true },
          { key: "orgServices", label: "الخدمات والبرامج المقدمة", type: "textarea", required: true },
          { key: "professionalRole", label: "دور الأخصائي الاجتماعي / الباحث الاجتماعي في الجهة", type: "textarea", required: true },
        ],
      },
      {
        title: "التدريب",
        fields: [
          { key: "activitiesSummary", label: "ملخص الأنشطة والمهام المنجزة", type: "textarea", required: true },
          { key: "skillsAcquired", label: "المهارات المهنية المكتسبة", type: "textarea", required: true },
          { key: "theoryPractice", label: "ربط المقررات النظرية بالممارسة الميدانية", type: "textarea", required: true },
          { key: "challenges", label: "الصعوبات وكيفية التغلب عليها", type: "textarea", required: true },
        ],
      },
      {
        title: "المقترحات",
        fields: [
          { key: "suggestionsOrg", label: "مقترحات لجهة التدريب", type: "textarea" },
          { key: "suggestionsDept", label: "مقترحات لتطوير التدريب الميداني بالقسم", type: "textarea" },
          { key: "reflection", label: "التأمل الذاتي والخلاصة", type: "textarea", required: true },
        ],
      },
    ],
  },
};

export const templatesForMajor = (major: Major) => Object.values(REPORT_TEMPLATES).filter((t) => t.majors.includes(major));

export type ReportContent = Record<string, unknown>;

const allFields = (t: TemplateDef) => t.sections.flatMap((s) => s.fields);

/** قيمة فارغة؟ (للحقول المطلوبة) */
export function isEmptyValue(field: Field, v: unknown): boolean {
  if (field.type === "checkbox") return v !== true;
  if (field.type === "table") {
    const rows = Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
    return rows.filter((r) => Object.values(r).some((c) => c !== "" && c != null)).length < (field.minRows ?? 1);
  }
  return v == null || (typeof v === "string" && v.trim() === "");
}

/** نسبة اكتمال الحقول المطلوبة */
export function completion(t: TemplateDef, content: ReportContent) {
  const req = allFields(t).filter((f) => f.required);
  const done = req.filter((f) => !isEmptyValue(f, content[f.key])).length;
  return { done, total: req.length, missing: req.filter((f) => isEmptyValue(f, content[f.key])).map((f) => f.label) };
}

function cellSchema(c: Column) {
  if (c.type === "number") return z.union([z.number().finite(), z.literal(""), z.null()]).optional();
  if (c.type === "select") return z.union([z.enum(c.options as [string, ...string[]]), z.literal("")]).optional();
  return z.string().max(1000).optional();
}

function fieldSchema(f: Field) {
  switch (f.type) {
    case "text":
    case "date":
      return z.string().max(f.type === "text" ? (f.max ?? 300) : 10).optional();
    case "textarea":
      return z.string().max(f.max ?? 8000).optional();
    case "number": {
      let n = z.number().finite();
      if (f.min != null) n = n.min(f.min, `${f.label}: أقل قيمة ${f.min}`);
      if (f.max != null) n = n.max(f.max, `${f.label}: أكبر قيمة ${f.max}`);
      return z.union([n, z.null()]).optional();
    }
    case "select":
      return z.union([z.enum(f.options as [string, ...string[]]), z.literal("")]).optional();
    case "checkbox":
      return z.boolean().optional();
    case "table":
      return z
        .array(z.strictObject(Object.fromEntries(f.columns.map((c) => [c.key, cellSchema(c)]))))
        .max(f.maxRows ?? 50, `${f.label}: الحد الأقصى ${f.maxRows ?? 50} صفاً`)
        .optional();
  }
}

/**
 * يتحقق من محتوى التقرير:
 *  - دائماً: الحقول معروفة وأنواعها صحيحة (strict — يرفض أي مفاتيح غريبة)
 *  - عند الرفع: الحقول المطلوبة مكتملة
 */
export function validateContent(templateId: ReportTemplate, content: unknown, forSubmit: boolean) {
  const t = REPORT_TEMPLATES[templateId];
  const schema = z.strictObject(Object.fromEntries(allFields(t).map((f) => [f.key, fieldSchema(f)])));
  const parsed = schema.parse(content) as ReportContent;
  if (forSubmit) {
    const { missing } = completion(t, parsed);
    if (missing.length) return { ok: false as const, missing, content: parsed };
  }
  return { ok: true as const, missing: [] as string[], content: parsed };
}
