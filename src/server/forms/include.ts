import type { Prisma } from "@prisma/client";

/** كل ما يلزم لتحميل نموذج كامل (المظروف + التفاصيل + الأطراف) */
export const FORM_INCLUDE = {
  placement: {
    include: {
      student: { include: { user: { select: { id: true, fullName: true } } } },
      organization: true,
      fieldSupervisor: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      academicSupervisor: { include: { user: { select: { id: true, fullName: true } } } },
      section: true,
    },
  },
  commencement: true,
  organizationProfile: { include: { professionals: { orderBy: { id: "asc" } } } },
  trainingPlan: { include: { weeks: { orderBy: { weekNumber: "asc" } } } },
  skillsLog: true,
  program: true,
  quickSituation: true,
  caseStudy: { include: { familyMembers: { orderBy: { order: "asc" } }, interviews: { select: { id: true, formId: true } } } },
  interview: { include: { difficulties: { orderBy: { order: "asc" } }, caseStudy: { select: { formId: true } } } },
  reading: true,
  signatures: { include: { signature: true }, orderBy: { createdAt: "asc" } },
  attachments: { orderBy: { createdAt: "asc" } },
  comments: { include: { author: { select: { fullName: true, role: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.FieldFormInclude;

export type LoadedForm = Prisma.FieldFormGetPayload<{ include: typeof FORM_INCLUDE }>;

/** اسم علاقة الجدول التفصيلي لكل نوع */
export const DETAIL_RELATION = {
  COMMENCEMENT: "commencement",
  ORGANIZATION_PROFILE: "organizationProfile",
  TRAINING_PLAN: "trainingPlan",
  SKILLS_LOG: "skillsLog",
  GROUP_PROGRAM: "program",
  COMMUNITY_PROGRAM: "program",
  QUICK_SITUATION: "quickSituation",
  CASE_STUDY: "caseStudy",
  INTERVIEW: "interview",
  READING: "reading",
} as const;

export type OfficialKind = keyof typeof DETAIL_RELATION;
