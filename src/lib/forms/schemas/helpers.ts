// أدوات مشتركة لمخططات Zod الخاصة بالنماذج الرسمية
import { z } from "zod";
import { narrativeIssues, type NarrativeRule } from "../narrative.ts";

/**
 * الحد الأدنى لطول النصوص السردية عند الرفع — قرار أكاديمي قابل للتعديل من القسم.
 * noBullets: النموذج الرسمي يشترط «سردية علمية وليس نقاط».
 */
export const NARRATIVE_RULES = {
  skills: { minWords: 50, noBullets: true },
  knowledge: { minWords: 50, noBullets: true },
  storyPart: { minWords: 80, noBullets: true }, // الجزء القصصي
  analyticalPart: { minWords: 60, noBullets: true },
  preparationPart: { minWords: 40 },
  planningPart: { minWords: 40 },
  executionPart: { minWords: 60 },
  interviewContent: { minWords: 60 },
  readingBenefit: { minWords: 40 },
  readingPurpose: { minWords: 15 },
  caseAspect: { minWords: 10 },
} satisfies Record<string, NarrativeRule>;

export const MAX = { short: 200, line: 500, prose: 20_000 } as const;

// ---- أنواع الحقول (المسودة: كلها اختيارية، مع ضبط النوع والطول فقط) ----
export const optText = (max: number = MAX.line) => z.string().trim().max(max, `الحد الأقصى ${max} حرف`).optional().nullable();
export const optProse = () => z.string().max(MAX.prose, "النص أطول من المسموح").optional().nullable();
export const optInt = (min: number, max: number) => z.number().int("يجب أن يكون عدداً صحيحاً").min(min, `أقل قيمة ${min}`).max(max, `أكبر قيمة ${max}`).optional().nullable();
export const optBool = () => z.boolean().optional().nullable();
export const optDate = () =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة التاريخ YYYY-MM-DD").refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "تاريخ غير صحيح").optional().nullable();
export const optTime = () => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "صيغة الوقت HH:mm").optional().nullable();
export const strList = (maxItems: number, maxLen: number = MAX.line) =>
  z
    .array(z.string().trim().max(maxLen, `الحد الأقصى ${maxLen} حرف`))
    .max(maxItems, `الحد الأقصى ${maxItems} عناصر`)
    .transform((a) => a.filter(Boolean))
    .optional();
export const optEnum = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).optional().nullable();

// ---- قواعد الرفع ----
export type Issue = { path: (string | number)[]; message: string };

export class Rules<T extends Record<string, unknown>> {
  readonly issues: Issue[] = [];
  readonly d: T;
  constructor(d: T) {
    this.d = d;
  }

  private empty(v: unknown) {
    return v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
  }
  required(key: keyof T & string, label: string) {
    if (this.empty(this.d[key])) this.issues.push({ path: [key], message: `${label}: حقل مطلوب` });
    return this;
  }
  requiredAll(fields: ReadonlyArray<readonly [keyof T & string, string]>) {
    for (const [k, l] of fields) this.required(k, l);
    return this;
  }
  isTrue(key: keyof T & string, message: string) {
    if (this.d[key] !== true) this.issues.push({ path: [key], message });
    return this;
  }
  narrative(key: keyof T & string, label: string, rule: NarrativeRule) {
    for (const message of narrativeIssues(label, this.d[key] as string | null, rule)) this.issues.push({ path: [key], message });
    return this;
  }
  check(ok: boolean, path: (string | number)[], message: string) {
    if (!ok) this.issues.push({ path, message });
    return this;
  }
}

/** يبني مخطط «الرفع» من مخطط «المسودة» + دالة القواعد */
export function withSubmitRules<S extends z.ZodType<Record<string, unknown>>>(draft: S, rules: (r: Rules<z.output<S>>) => void) {
  return draft.superRefine((d, ctx) => {
    const r = new Rules(d as z.output<S>);
    rules(r);
    for (const i of r.issues) ctx.addIssue({ code: "custom", path: i.path, message: i.message });
  });
}
