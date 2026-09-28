// 9) دراسة الحالة وفقاً لخطوات التدخل المهني
import { z } from "zod";
import { MAX, NARRATIVE_RULES, optBool, optEnum, optInt, optProse, optText, strList, withSubmitRules } from "./helpers.ts";

const familyMember = z.strictObject({
  name: z.string().trim().max(MAX.short).default(""), // يُفضَّل رمزياً
  age: optInt(0, 120),
  relation: z.string().trim().max(60).default(""),
  education: optText(60),
  occupation: optText(60),
  healthStatus: optText(MAX.short),
  maritalStatus: optText(40),
  notes: optText(),
});

export const caseStudyDraft = z.strictObject({
  caseAlias: optText(60),
  consentConfirmed: optBool(),
  // أولاً: التقدير
  physicalAspect: optProse(),
  psychologicalAspect: optProse(),
  mentalAspect: optProse(),
  behavioralAspect: optProse(),
  familyMembers: z.array(familyMember).max(25).optional(), // جدول التكوين الأسري (من الأكبر إلى الأصغر)
  familyDynamics: optProse(),
  otherSystemsRelations: optProse(),
  mainProblem: optProse(),
  subProblems: strList(15),
  strengths: optProse(),
  // ثانياً: التخطيط
  participatingSystems: optProse(),
  mainGoal: optProse(),
  subGoals: strList(15),
  professionalContract: optProse(),
  // ثالثاً: التدخل المهني
  therapeuticModels: strList(10),
  techniques: strList(20),
  // رابعاً: التقييم
  initProblemsWellFormulated: optBool(),
  initGoalsMeasurable: optBool(),
  initGoalsAchievable: optBool(),
  initTechniquesAppropriate: optBool(),
  initResponsibilitiesClear: optBool(),
  assessmentPositives: optProse(),
  assessmentNegatives: optProse(),
  planningPositives: optProse(),
  planningNegatives: optProse(),
  interventionPositives: optProse(),
  interventionNegatives: optProse(),
  finalOutcome: optEnum(["POSITIVE_CHANGE", "NO_CHANGE", "DETERIORATED"] as const),
  // خامساً: الإنهاء
  terminationType: optEnum(["PLANNED", "UNPLANNED"] as const),
  plannedGoalsAchieved: optBool(),
  plannedTimeAppropriate: optBool(),
  plannedProblemHandled: optBool(),
  plannedResourcesUsed: optBool(),
  plannedNeedsReferral: optBool(),
  unplannedWorkerFactors: optProse(),
  unplannedClientFactors: optProse(),
  unplannedSharedFactors: optProse(),
  // سادساً: المتابعة
  followUpInterval: optEnum(["CLOSE", "SPACED"] as const),
  followUpPurposes: z.array(z.enum(["SERVICE_EVALUATION", "COMMUNITY_ACCOUNTABILITY", "CLIENT_ATTACHMENT"])).max(3).optional(),
  followUpMethods: z.array(z.enum(["PHONE_CALLS", "HOME_VISITS", "MAILED_SURVEYS"])).max(3).optional(),
  resultPerformsSocialRole: optBool(),
  resultUsesLearnedSkills: optBool(),
  resultNeedsOtherServices: optBool(),
});

const aspect = NARRATIVE_RULES.caseAspect;

export const caseStudySubmit = withSubmitRules(caseStudyDraft, (r) => {
  const d = r.d;
  r.required("caseAlias", "الاسم الرمزي للحالة").isTrue("consentConfirmed", "يجب الإقرار بموافقة العميل وإخفاء هويته");
  // التقدير
  r.narrative("physicalAspect", "الجانب الجسمي", aspect)
    .narrative("psychologicalAspect", "الجانب النفسي", aspect)
    .narrative("mentalAspect", "الجانب العقلي", aspect)
    .narrative("behavioralAspect", "الجانب السلوكي", aspect)
    .requiredAll([["familyDynamics", "ديناميكية الأسرة"], ["mainProblem", "المشكلة الرئيسية"], ["strengths", "جوانب القوى"]]);
  const members = (d.familyMembers ?? []).filter((m) => m.name || m.relation);
  r.check(members.length > 0, ["familyMembers"], "جدول التكوين الأسري: أضف فرداً واحداً على الأقل");
  members.forEach((m, i) => r.check(!!m.name && !!m.relation, ["familyMembers", i], `التكوين الأسري (صف ${i + 1}): الاسم والصلة بالعميل مطلوبان`));
  // التخطيط والتدخل
  r.requiredAll([
    ["participatingSystems", "الأنساق المشاركة"], ["mainGoal", "الهدف الرئيسي"], ["subGoals", "الأهداف الفرعية"],
    ["professionalContract", "التعاقد المهني"], ["therapeuticModels", "النموذج العلاجي المستخدم"], ["techniques", "الأساليب العلاجية"],
  ]);
  // التقييم المبدئي: كل جانب يحتاج علامة
  for (const [k, l] of [
    ["initProblemsWellFormulated", "صياغة المشكلات"], ["initGoalsMeasurable", "قابلية الأهداف للقياس"], ["initGoalsAchievable", "واقعية الأهداف"],
    ["initTechniquesAppropriate", "مناسبة الأساليب العلاجية"], ["initResponsibilitiesClear", "وضوح مسئوليات الأنساق"],
  ] as const) r.check(d[k] != null, [k], `التقييم المبدئي: حدد (√) ${l}`);
  r.requiredAll([["assessmentPositives", "التقييم المرحلي — خطوة التقدير"], ["planningPositives", "التقييم المرحلي — خطوة التخطيط"], ["interventionPositives", "التقييم المرحلي — خطوة التدخل المهني"], ["finalOutcome", "التقييم النهائي"]]);
  // الإنهاء
  r.required("terminationType", "نوع الإنهاء (مخطط / غير مخطط)");
  if (d.terminationType === "PLANNED") {
    for (const [k, l] of [
      ["plannedGoalsAchieved", "تحقيق أهداف التدخل"], ["plannedTimeAppropriate", "مناسبة الوقت المتفق عليه"], ["plannedProblemHandled", "مستوى التعامل مع المشكلة"],
      ["plannedResourcesUsed", "استثمار الموارد"], ["plannedNeedsReferral", "الحاجة للتحويل"],
    ] as const) r.check(d[k] != null, [k], `الإنهاء المخطط: أجب عن «${l}»`);
  }
  if (d.terminationType === "UNPLANNED") {
    r.check(!!(d.unplannedWorkerFactors || d.unplannedClientFactors || d.unplannedSharedFactors), ["unplannedWorkerFactors"], "الإنهاء غير المخطط: حدد العوامل التي أدت إليه");
  }
  // المتابعة
  r.requiredAll([["followUpInterval", "الفترة الزمنية للمتابعة"], ["followUpPurposes", "الهدف من المتابعة"], ["followUpMethods", "منهج المتابعة"]]);
  r.check(!!(d.resultPerformsSocialRole || d.resultUsesLearnedSkills || d.resultNeedsOtherServices), ["resultPerformsSocialRole"], "حدد نتيجة عملية المتابعة");
});
