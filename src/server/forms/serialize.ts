// تحويل صفوف القاعدة إلى «بيانات النموذج» بنفس شكل مخططات Zod (للعرض والتحقق والبصمة والطباعة)
import type { LoadedForm, OfficialKind } from "./include";
import { DETAIL_RELATION } from "./include";
import { customContent } from "./custom";

const DATE_KEYS = new Set(["commencementDate", "logDate", "programDate", "situationDate", "interviewDate", "readingDate"]);
// المعرّفات الداخلية والعلاقات (تُسلسل الصفوف الفرعية أدناه)؛ «المجال» في المظروف لا في البيانات
const OMIT = new Set(["id", "formId", "domain", "interviews", "familyMembers", "professionals", "weeks", "difficulties", "caseStudyId", "caseStudy", "planWeekId"]);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

function scalars(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (OMIT.has(k)) continue;
    out[k] = v instanceof Date ? (DATE_KEYS.has(k) ? ymd(v) : v.toISOString()) : v;
  }
  return out;
}

/**
 * أعمدة مشتركة في جدول واحد لا تخص هذا النوع/المجال (مثلاً: البرنامج الجماعي لا يحوي الجزء التخطيطي،
 * والموقف الطبي لا يحوي «الصف الدراسي») — تُستبعد لتطابق البيانات مخطط النموذج بدقة
 */
const NOT_APPLICABLE: Record<string, string[]> = {
  GROUP_PROGRAM: ["planningPart", "executionPart"],
  COMMUNITY_PROGRAM: ["preparationPart", "narrativePart", "analyticalPart"],
  "QUICK_SITUATION:SCHOOL": ["medicalFileNumber", "medicalVisitType", "hospitalDepartment"],
  "QUICK_SITUATION:MEDICAL": ["schoolGrade"],
};

export function serializeForm(form: LoadedForm): Record<string, unknown> {
  if (form.kind === "CUSTOM") return customContent(form.data);
  const kind = form.kind as OfficialKind;
  const detail = form[DETAIL_RELATION[kind]] as Record<string, unknown> | null;
  if (!detail) return {};
  const data = scalars(detail);
  const variant = kind === "QUICK_SITUATION" ? `${kind}:${form.quickSituation!.domain}` : kind;
  for (const k of NOT_APPLICABLE[variant] ?? []) delete data[k];

  switch (kind) {
    case "ORGANIZATION_PROFILE":
      data.professionals = form.organizationProfile!.professionals.map((p) => ({ specialty: p.specialty, count: p.count }));
      break;
    case "TRAINING_PLAN":
      data.weeks = form.trainingPlan!.weeks.map((w) => ({ weekNumber: w.weekNumber, tasks: w.tasks, responsible: w.responsible }));
      break;
    case "CASE_STUDY":
      data.familyMembers = form.caseStudy!.familyMembers.map(({ id: _i, caseStudyId: _c, order: _o, ...m }) => m);
      break;
    case "INTERVIEW":
      data.difficulties = form.interview!.difficulties.map((d) => ({ difficulty: d.difficulty, coping: d.coping }));
      data.caseStudyFormId = form.interview!.caseStudy?.formId ?? null;
      break;
  }
  return data;
}

/**
 * حقول يملكها الخادم لا الطالب: تُعرض وتُطبع لكن لا تدخل في تحقق المحتوى
 * (لقطات المباشرة تُسجَّل لحظة توقيع المشرف المؤسسي)
 */
const SERVER_OWNED: Partial<Record<OfficialKind, string[]>> = {
  COMMENCEMENT: ["supervisorMobile", "organizationEmail", "directorName"],
};

/** بيانات الطالب فقط — للتحقق عند الرفع */
export function editableData(form: LoadedForm): Record<string, unknown> {
  const data = serializeForm(form);
  for (const k of SERVER_OWNED[form.kind as OfficialKind] ?? []) delete data[k];
  return data;
}
