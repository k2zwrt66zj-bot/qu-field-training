// =====================================================================
//  كتالوج النماذج الرسمية وسياسة كل نموذج في سير العمل
//  (ملف نقي: لا يعتمد على قاعدة البيانات — تستورده الواجهة والخادم والاختبارات)
// =====================================================================
import type { FormKind, SignatureSlot, SituationDomain } from "@prisma/client";

export const FORM_KINDS = [
  "COMMENCEMENT", "ORGANIZATION_PROFILE", "TRAINING_PLAN", "SKILLS_LOG", "GROUP_PROGRAM",
  "COMMUNITY_PROGRAM", "QUICK_SITUATION", "CASE_STUDY", "INTERVIEW", "READING", "CUSTOM",
] as const satisfies readonly FormKind[];

export interface FormPolicy {
  kind: FormKind;
  /** العنوان كما ورد في الدليل الرسمي */
  title: string;
  /** ترتيب النموذج في «السجل المهني» المطبوع */
  portfolioOrder: number;
  /** نموذج واحد فقط لكل إسناد (المباشرة، التعريفي، الخطة) */
  singleton: boolean;
  /** يُطبع «رقم ( )» */
  numbered: boolean;
  /** يمرّ على المشرف المؤسسي قبل الأكاديمي */
  fieldApproval: boolean;
  /** خانات التوقيع المطلوبة عند كل انتقال */
  slotsOnSubmit: SignatureSlot[];
  slotsOnFieldSign: SignatureSlot[];
  /** يضع المشرف الأكاديمي درجة استرشادية */
  academicScore: boolean;
  /** يستطيع المشرف المؤسسي تعديل المحتوى أثناء المراجعة (الخطة تُعدّ بالتشارك) */
  fieldCanEditWhileSubmitted: boolean;
}

const base = { singleton: false, numbered: false, fieldApproval: true, slotsOnSubmit: [], slotsOnFieldSign: ["FIELD_SUPERVISOR"], academicScore: false, fieldCanEditWhileSubmitted: false } satisfies Partial<FormPolicy>;

export const FORM_POLICIES: Record<FormKind, FormPolicy> = {
  COMMENCEMENT: {
    ...base, kind: "COMMENCEMENT", portfolioOrder: 1, title: "مباشرة الطالب/ـة لمؤسسة التدريب الميداني", singleton: true,
    slotsOnSubmit: ["STUDENT"], slotsOnFieldSign: ["FIELD_SUPERVISOR", "ORG_DIRECTOR"],
  },
  ORGANIZATION_PROFILE: { ...base, kind: "ORGANIZATION_PROFILE", portfolioOrder: 2, title: "تقرير تعريفي بمؤسسة التدريب الميداني", singleton: true },
  TRAINING_PLAN: { ...base, kind: "TRAINING_PLAN", portfolioOrder: 3, title: "نموذج خطة التدريب الميداني", singleton: true, fieldCanEditWhileSubmitted: true },
  SKILLS_LOG: { ...base, kind: "SKILLS_LOG", portfolioOrder: 4, title: "نموذج تسجيل المهارات والمعارف الأسبوعية" },
  GROUP_PROGRAM: { ...base, kind: "GROUP_PROGRAM", portfolioOrder: 5, title: "تقرير البرنامج الجماعي", numbered: true, academicScore: true },
  COMMUNITY_PROGRAM: { ...base, kind: "COMMUNITY_PROGRAM", portfolioOrder: 6, title: "تقرير البرنامج المجتمعي", numbered: true, academicScore: true },
  QUICK_SITUATION: { ...base, kind: "QUICK_SITUATION", portfolioOrder: 7, title: "تسجيل الموقف السريع" },
  CASE_STUDY: { ...base, kind: "CASE_STUDY", portfolioOrder: 8, title: "دراسة الحالة وفقاً لخطوات التدخل المهني", academicScore: true },
  INTERVIEW: { ...base, kind: "INTERVIEW", portfolioOrder: 9, title: "تسجيل المقابلة المهنية", numbered: true },
  READING: { ...base, kind: "READING", portfolioOrder: 10, title: "نموذج القراءة", numbered: true, fieldApproval: false, slotsOnFieldSign: [] },
  CUSTOM: { ...base, kind: "CUSTOM", portfolioOrder: 99, title: "نموذج إضافي", academicScore: true },
};

export const SITUATION_TITLES: Record<SituationDomain, string> = {
  SCHOOL: "تسجيل الموقف السريع بالمدرسة",
  MEDICAL: "تسجيل الموقف السريع بالمستشفى",
};

export const SLOT_LABELS: Record<SignatureSlot, string> = {
  STUDENT: "توقيع الطالب/ـة",
  FIELD_SUPERVISOR: "توقيع المشرف المؤسسي",
  ORG_DIRECTOR: "مدير المؤسسة (الختم والتوقيع)",
  ACADEMIC_SUPERVISOR: "المشرف الأكاديمي",
  TRAINING_HEAD: "رئيس وحدة التدريب الميداني",
  MEETING_CHAIR: "رئيس الاجتماع",
  MEETING_SECRETARY: "أمين الاجتماع",
  MEETING_MEMBER: "الأعضاء",
};

export const WEEKDAY_LABELS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;

/** عنوان النموذج كما يُعرض ويُطبع: «تقرير البرنامج الجماعي رقم (2)» */
export function formDisplayTitle(kind: FormKind, sequence: number, domain?: SituationDomain | null) {
  const p = FORM_POLICIES[kind];
  const title = kind === "QUICK_SITUATION" && domain ? SITUATION_TITLES[domain] : p.title;
  return p.numbered ? `${title} رقم (${sequence})` : title;
}
