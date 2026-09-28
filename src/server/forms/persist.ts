// تحويل «بيانات النموذج» (بعد التحقق) إلى كتابات Prisma على الجدول التفصيلي
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { formatApa, type ApaSourceType } from "@/lib/forms/apa";
import type { LoadedForm, OfficialKind } from "./include";
import { DETAIL_RELATION } from "./include";

const DATE_KEYS = new Set(["commencementDate", "logDate", "programDate", "situationDate", "interviewDate", "readingDate"]);
const CHILD_KEYS = new Set(["professionals", "weeks", "familyMembers", "difficulties"]);
const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** يبني بيانات التحديث للحقول العددية/النصية المرسلة فقط (تحديث جزئي) */
function scalarUpdate(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (CHILD_KEYS.has(k) || v === undefined) continue;
    out[k] = DATE_KEYS.has(k) && typeof v === "string" ? toDate(v) : v;
  }
  return out;
}

/** يطبق التحديث داخل معاملة ويتحقق من أن المراجع (أسبوع الخطة / دراسة الحالة) تخص نفس الطالب */
export async function persistFormData(tx: Prisma.TransactionClient, form: LoadedForm, data: Record<string, unknown>) {
  const kind = form.kind as OfficialKind;
  const rel = DETAIL_RELATION[kind];
  const update: Record<string, unknown> = scalarUpdate(data);

  // ----- التحقق من المراجع -----
  if (kind === "INTERVIEW" && "caseStudyFormId" in data) {
    delete update.caseStudyFormId;
    if (data.caseStudyFormId) {
      const cs = await tx.caseStudy.findFirst({ where: { formId: data.caseStudyFormId as string, form: { placementId: form.placementId } }, select: { id: true } });
      if (!cs) throw new ApiError(422, "دراسة الحالة لا تخص تدريبك");
      update.caseStudy = { connect: { id: cs.id } };
    } else {
      update.caseStudy = { disconnect: true };
    }
  }
  // سجل المهارات يُربط آلياً بأسبوع الخطة ذي الرقم نفسه
  if (kind === "SKILLS_LOG" && typeof data.weekNumber === "number") {
    const week = await tx.trainingPlanWeek.findFirst({ where: { weekNumber: data.weekNumber, plan: { form: { placementId: form.placementId } } }, select: { id: true } });
    update.planWeek = week ? { connect: { id: week.id } } : { disconnect: true };
  }

  // ----- توليد توثيق APA إن لم يُكتب يدوياً -----
  if (kind === "READING") {
    const merged = { ...form.reading!, ...data } as Record<string, unknown>;
    const manual = typeof data.apaCitation === "string" && data.apaCitation.trim();
    if (!manual && merged.title) {
      update.apaCitation = formatApa({
        sourceType: (merged.sourceType as ApaSourceType) ?? "JOURNAL_ARTICLE",
        authors: (merged.authors as string[]) ?? [],
        publicationYear: merged.publicationYear as number | null,
        title: merged.title as string,
        containerTitle: merged.containerTitle as string | null,
        editors: merged.editors as string | null,
        volume: merged.volume as string | null,
        issue: merged.issue as string | null,
        pages: merged.pages as string | null,
        publisher: merged.publisher as string | null,
        doi: merged.doi as string | null,
        url: merged.url as string | null,
      }).text;
    }
  }

  // ----- الصفوف الفرعية (استبدال كامل، عدا أسابيع الخطة: تحديث حسب رقم الأسبوع) -----
  if (kind === "ORGANIZATION_PROFILE" && data.professionals) {
    update.professionals = { deleteMany: {}, create: (data.professionals as { specialty: string; count: number }[]).filter((p) => p.specialty) };
  }
  if (kind === "CASE_STUDY" && data.familyMembers) {
    const rows = (data.familyMembers as Record<string, unknown>[]).filter((m) => m.name || m.relation);
    update.familyMembers = { deleteMany: {}, create: rows.map((m, i) => ({ ...m, order: i + 1 })) };
  }
  if (kind === "INTERVIEW" && data.difficulties) {
    const rows = (data.difficulties as { difficulty: string; coping: string }[]).filter((d) => d.difficulty.trim() || d.coping.trim());
    update.difficulties = { deleteMany: {}, create: rows.map((d, i) => ({ ...d, order: i + 1 })) };
  }
  if (kind === "TRAINING_PLAN" && data.weeks) {
    // لا نحذف الأسابيع ونعيد إنشاءها حتى لا تنفصل سجلات المهارات المرتبطة بها
    const planId = form.trainingPlan!.id;
    const weeks = data.weeks as { weekNumber: number; tasks: string; responsible: string }[];
    update.weeks = {
      deleteMany: { weekNumber: { notIn: weeks.map((w) => w.weekNumber) } },
      upsert: weeks.map((w) => ({ where: { planId_weekNumber: { planId, weekNumber: w.weekNumber } }, create: w, update: { tasks: w.tasks, responsible: w.responsible } })),
    };
  }

  await tx.fieldForm.update({ where: { id: form.id }, data: { [rel]: { update } } as Prisma.FieldFormUpdateInput });
}
