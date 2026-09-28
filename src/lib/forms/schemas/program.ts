// 5-6) تقرير البرنامج الجماعي / المجتمعي
import { z } from "zod";
import { MAX, NARRATIVE_RULES, optDate, optInt, optProse, optText, optTime, strList, withSubmitRules } from "./helpers.ts";

const common = {
  // أولاً: الجزء الإحصائي
  programDate: optDate(),
  startTime: optTime(),
  durationMinutes: optInt(1, 24 * 60),
  membersCount: optInt(0, 100_000),
  supervisorsCount: optInt(0, 1000),
  advisorName: optText(MAX.short), // رائد البرنامج
  leaderName: optText(MAX.short), // قائد البرنامج
  programType: optText(MAX.short),
  programTitle: optText(MAX.short),
  // ثانياً: أهداف البرنامج
  goals: optProse(),
  // التقييم
  positives: strList(10),
  negatives: strList(10),
};

// الجماعي: الإعدادي، القصصي، التحليلي — لا يقبل أجزاء المجتمعي
export const groupProgramDraft = z.strictObject({ ...common, preparationPart: optProse(), narrativePart: optProse(), analyticalPart: optProse() });
// المجتمعي: التخطيطي، التنفيذي
export const communityProgramDraft = z.strictObject({ ...common, planningPart: optProse(), executionPart: optProse() });

const statistical = [
  ["programDate", "تاريخ البرنامج"], ["startTime", "وقت البرنامج"], ["durationMinutes", "مدة البرنامج"],
  ["membersCount", "عدد أعضاء البرنامج"], ["programType", "نوع البرنامج"], ["programTitle", "عنوان البرنامج"],
  ["goals", "أهداف البرنامج"], ["positives", "إيجابيات البرنامج"],
] as const;

export const groupProgramSubmit = withSubmitRules(groupProgramDraft, (r) =>
  r
    .requiredAll(statistical)
    .narrative("preparationPart", "الجزء الإعدادي", NARRATIVE_RULES.preparationPart)
    .narrative("narrativePart", "الجزء القصصي", NARRATIVE_RULES.storyPart)
    .narrative("analyticalPart", "الجزء التحليلي", NARRATIVE_RULES.analyticalPart)
);

export const communityProgramSubmit = withSubmitRules(communityProgramDraft, (r) =>
  r
    .requiredAll(statistical)
    .narrative("planningPart", "الجزء التخطيطي", NARRATIVE_RULES.planningPart)
    .narrative("executionPart", "الجزء التنفيذي", NARRATIVE_RULES.executionPart)
);
