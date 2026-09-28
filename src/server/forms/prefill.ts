// التعبئة المسبقة عند إنشاء نموذج جديد: من الدليل والإسناد والخطة المعتمدة (الطالب يتحقق ويعدّل)
import type { Prisma, SituationDomain } from "@prisma/client";
import { ORG_CATEGORY_LABELS } from "@/lib/labels";
import { WEEKDAY_LABELS } from "@/lib/forms/catalog";
import { riyadhDateOnly } from "@/lib/time";
import type { OfficialKind } from "./include";

type PlacementForPrefill = Prisma.PlacementGetPayload<{
  include: { organization: true; fieldSupervisor: { include: { user: true } } };
}>;

export function weekNumberFor(start: Date, date: Date) {
  return Math.max(1, Math.floor((date.getTime() - start.getTime()) / (7 * 86_400_000)) + 1);
}

export async function prefillDetail(
  tx: Prisma.TransactionClient,
  kind: OfficialKind,
  p: PlacementForPrefill,
  domain: SituationDomain | null
): Promise<Record<string, unknown>> {
  const today = riyadhDateOnly();
  const org = p.organization;
  switch (kind) {
    case "COMMENCEMENT":
      return { commencementDate: p.startDate, fixedTrainingDay: p.workDays[0] ?? 0, shift: p.shift ?? "MORNING", declarationAccepted: false };
    case "ORGANIZATION_PROFILE":
      return {
        organizationName: org.name,
        location: [org.address, org.city].filter(Boolean).join(" — "),
        contactNumbers: [org.phone, org.contactPhone].filter(Boolean).join(" / ") || null,
        workField: ORG_CATEGORY_LABELS[org.category],
        officialHours: `${org.workStartTime} - ${org.workEndTime}`,
        trainingDays: p.workDays.map((d) => WEEKDAY_LABELS[d]).join("، "),
        directorName: org.directorName,
        supervisorName: p.fieldSupervisor?.user.fullName ?? null,
        supervisorMobile: p.fieldSupervisor?.user.phone ?? null,
        socialWorkerRoles: [],
      };
    case "TRAINING_PLAN": {
      // صف لكل أسبوع من أسابيع الفصل (الجدول الرسمي 18 صفاً)
      const weeks = Math.min(18, Math.max(1, Math.ceil((p.endDate.getTime() - p.startDate.getTime() + 86_400_000) / (7 * 86_400_000))));
      return { weeks: { create: Array.from({ length: weeks }, (_, i) => ({ weekNumber: i + 1, tasks: "", responsible: "" })) } };
    }
    case "SKILLS_LOG": {
      const weekNumber = weekNumberFor(p.startDate, today);
      // موضوعات اليوم من أسبوع الخطة المعتمدة (إن وجدت)
      const week = await tx.trainingPlanWeek.findFirst({
        where: { weekNumber, plan: { form: { placementId: p.id, status: { in: ["SIGNED", "REVIEWED"] } } } },
      });
      const topics = week?.tasks.split(/\r?\n|[،؛]/).map((t) => t.trim()).filter(Boolean).slice(0, 6) ?? [];
      return { weekNumber, logDate: today, ...(week ? { planWeek: { connect: { id: week.id } } } : {}), topics, skillsNarrative: "", knowledgeNarrative: "" };
    }
    case "GROUP_PROGRAM":
    case "COMMUNITY_PROGRAM":
      return { programDate: today, programTitle: "", positives: [], negatives: [] };
    case "QUICK_SITUATION":
      return { domain: domain!, situationDate: today, referralSource: "", summary: "", actionsTaken: "" };
    case "CASE_STUDY":
      return { caseAlias: "" };
    case "INTERVIEW":
      return { interviewDate: today, parties: "", goals: "", content: "" };
    case "READING":
      return { sourceType: "JOURNAL_ARTICLE", readingDate: today, authors: [], title: "", apaCitation: "", purpose: "", professionalBenefit: "" };
  }
}

/** مجال الموقف السريع الافتراضي من تصنيف الجهة */
export function defaultDomain(category: string): SituationDomain | null {
  if (category === "MEDICAL") return "MEDICAL";
  if (category === "SCHOOL") return "SCHOOL";
  return null;
}
