// سجل مخططات النماذج: لكل نوع مخطط «مسودة» مرن ومخطط «رفع» صارم
import type { z } from "zod";
import type { FormKind, SituationDomain } from "@prisma/client";
import { commencementDraft, commencementSubmit } from "./commencement.ts";
import { organizationProfileDraft, organizationProfileSubmit } from "./organization-profile.ts";
import { trainingPlanDraft, trainingPlanSubmit } from "./training-plan.ts";
import { skillsLogDraft, skillsLogSubmit } from "./skills-log.ts";
import { communityProgramDraft, communityProgramSubmit, groupProgramDraft, groupProgramSubmit } from "./program.ts";
import { medicalSituationDraft, medicalSituationSubmit, schoolSituationDraft, schoolSituationSubmit } from "./quick-situation.ts";
import { caseStudyDraft, caseStudySubmit } from "./case-study.ts";
import { interviewDraft, interviewSubmit } from "./interview.ts";
import { readingDraft, readingSubmit } from "./reading.ts";

export interface FormSchemas {
  draft: z.ZodType<Record<string, unknown>>;
  submit: z.ZodType<Record<string, unknown>>;
}

type OfficialKind = Exclude<FormKind, "CUSTOM">;

const REGISTRY: Record<Exclude<OfficialKind, "QUICK_SITUATION">, FormSchemas> = {
  COMMENCEMENT: { draft: commencementDraft, submit: commencementSubmit },
  ORGANIZATION_PROFILE: { draft: organizationProfileDraft, submit: organizationProfileSubmit },
  TRAINING_PLAN: { draft: trainingPlanDraft, submit: trainingPlanSubmit },
  SKILLS_LOG: { draft: skillsLogDraft, submit: skillsLogSubmit },
  GROUP_PROGRAM: { draft: groupProgramDraft, submit: groupProgramSubmit },
  COMMUNITY_PROGRAM: { draft: communityProgramDraft, submit: communityProgramSubmit },
  CASE_STUDY: { draft: caseStudyDraft, submit: caseStudySubmit },
  INTERVIEW: { draft: interviewDraft, submit: interviewSubmit },
  READING: { draft: readingDraft, submit: readingSubmit },
};

const SITUATION: Record<SituationDomain, FormSchemas> = {
  SCHOOL: { draft: schoolSituationDraft, submit: schoolSituationSubmit },
  MEDICAL: { draft: medicalSituationDraft, submit: medicalSituationSubmit },
};

export function schemasFor(kind: OfficialKind, domain?: SituationDomain | null): FormSchemas {
  if (kind === "QUICK_SITUATION") {
    if (!domain) throw new Error("الموقف السريع يتطلب تحديد المجال (مدرسي / طبي)");
    return SITUATION[domain];
  }
  return REGISTRY[kind];
}

/** نتيجة تحقق موحدة: الأخطاء بمسارات الحقول ورسائل عربية */
export function validateForm(kind: OfficialKind, data: unknown, mode: "draft" | "submit", domain?: SituationDomain | null) {
  const r = schemasFor(kind, domain)[mode].safeParse(data);
  if (r.success) return { ok: true as const, data: r.data };
  return { ok: false as const, issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
}

export { NARRATIVE_RULES } from "./helpers.ts";
