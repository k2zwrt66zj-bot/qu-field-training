// 3) نموذج خطة التدريب الميداني
import { z } from "zod";
import { MAX, optProse, withSubmitRules } from "./helpers.ts";

export const trainingPlanDraft = z.strictObject({
  generalGoal: optProse(), // الهدف العام
  weeks: z
    .array(
      z.strictObject({
        weekNumber: z.number().int().min(1).max(30), // الأسبوع
        tasks: z.string().max(MAX.prose).default(""), // المهام
        responsible: z.string().trim().max(MAX.short).default(""), // المسؤول عن أداء المهمة
      })
    )
    .max(30)
    .optional(),
});

export const trainingPlanSubmit = withSubmitRules(trainingPlanDraft, (r) => {
  r.required("generalGoal", "الهدف العام");
  const weeks = (r.d.weeks ?? []).filter((w) => w.tasks.trim() || w.responsible);
  r.check(weeks.length > 0, ["weeks"], "أضف مهام أسبوع واحد على الأقل");
  const nums = weeks.map((w) => w.weekNumber);
  r.check(new Set(nums).size === nums.length, ["weeks"], "رقم الأسبوع مكرر في الخطة");
  weeks.forEach((w) => {
    r.check(!!w.tasks.trim(), ["weeks", w.weekNumber, "tasks"], `الأسبوع ${w.weekNumber}: المهام مطلوبة`);
    r.check(!!w.responsible, ["weeks", w.weekNumber, "responsible"], `الأسبوع ${w.weekNumber}: حدد المسؤول عن أداء المهمة`);
  });
});
