// 10) تسجيل المقابلة المهنية
import { z } from "zod";
import { MAX, NARRATIVE_RULES, optDate, optInt, optProse, optText, withSubmitRules } from "./helpers.ts";

export const interviewDraft = z.strictObject({
  caseStudyFormId: z.string().max(40).optional().nullable(), // مقابلة ضمن دراسة حالة (معرّف نموذج دراسة الحالة)
  interviewDate: optDate(),
  durationMinutes: optInt(1, 600),
  location: optText(MAX.short),
  parties: optText(MAX.line), // طرف أو أطراف المقابلة
  goals: optProse(),
  content: optProse(),
  skillsUsed: optProse(),
  nextPlan: optProse(),
  positives: optProse(),
  difficulties: z
    .array(z.strictObject({ difficulty: z.string().max(MAX.line * 4).default(""), coping: z.string().max(MAX.line * 4).default("") }))
    .max(15)
    .optional(),
});

export const interviewSubmit = withSubmitRules(interviewDraft, (r) => {
  r.requiredAll([
    ["interviewDate", "تاريخ المقابلة"], ["durationMinutes", "مدة المقابلة"], ["location", "مكان المقابلة"], ["parties", "أطراف المقابلة"],
    ["goals", "أهداف المقابلة"], ["skillsUsed", "المهارات المستخدمة"], ["positives", "الجوانب الإيجابية"],
  ]).narrative("content", "محتوى المقابلة", NARRATIVE_RULES.interviewContent);
  (r.d.difficulties ?? []).forEach((x, i) => {
    if (x.difficulty.trim() || x.coping.trim()) r.check(!!x.difficulty.trim() && !!x.coping.trim(), ["difficulties", i], `الصعوبات (صف ${i + 1}): اذكر الصعوبة وكيفية مواجهتها معاً`);
  });
});
