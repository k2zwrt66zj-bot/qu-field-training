// 4) نموذج تسجيل المهارات والمعارف الأسبوعية
import { z } from "zod";
import { MAX, NARRATIVE_RULES, optDate, optInt, optProse, strList, withSubmitRules } from "./helpers.ts";

export const skillsLogDraft = z.strictObject({
  weekNumber: optInt(1, 30), // عناصر خطة الأسبوع
  logDate: optDate(), // اليوم والتاريخ
  topics: strList(6, MAX.line), // الموضوعات (الجدول الرسمي 6 صفوف)
  skillsNarrative: optProse(), // المهارات المكتسبة — سردية علمية
  knowledgeNarrative: optProse(), // المعارف المكتسبة — سردية علمية
  difficulties: optProse(), // الصعوبات وكيفية التغلب عليها
});

export const skillsLogSubmit = withSubmitRules(skillsLogDraft, (r) =>
  r
    .requiredAll([["weekNumber", "الأسبوع"], ["logDate", "التاريخ"], ["topics", "موضوعات اليوم"]])
    .narrative("skillsNarrative", "المهارات المكتسبة", NARRATIVE_RULES.skills)
    .narrative("knowledgeNarrative", "المعارف المكتسبة", NARRATIVE_RULES.knowledge)
);
