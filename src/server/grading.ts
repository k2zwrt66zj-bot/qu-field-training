import { prisma } from "@/lib/prisma";
import { calculateFinalGrade } from "@/lib/grading/engine";
import { riyadhDateOnly } from "@/lib/time";
import { toNum } from "@/lib/utils";

/** عدد الأسابيع (المتوقع فيها سجل أسبوعي) من بداية التدريب حتى اليوم أو نهايته */
function expectedWeeks(start: Date, end: Date, today = riyadhDateOnly()): number {
  const until = today < end ? today : end;
  const days = Math.floor((until.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(0, Math.floor(days / 7));
}

/**
 * عدد الأسابيع التي رُفع لها سجل: من «نموذج تسجيل المهارات والمعارف» الجديد
 * ومن السجلات الأسبوعية السابقة (الأرشيف)، دون تكرار الأسبوع
 */
async function weeklyLogWeeks(placementId: string) {
  const submitted = { in: ["SUBMITTED", "SIGNED", "REVIEWED"] as ("SUBMITTED" | "SIGNED" | "REVIEWED")[] };
  const [legacy, current] = await Promise.all([
    prisma.logbook.findMany({ where: { placementId, type: "WEEKLY", status: submitted }, select: { weekNumber: true } }),
    prisma.skillsLog.findMany({ where: { form: { placementId, status: submitted } }, select: { weekNumber: true } }),
  ]);
  return new Set([...legacy.map((l) => l.weekNumber), ...current.map((c) => c.weekNumber)].filter((w): w is number => w != null)).size;
}

/** يحسب الدرجة النهائية لإسناد واحد ويخزنها (دون المساس بالدرجات المعتمدة) */
export async function computeAndStoreGrade(placementId: string) {
  const p = await prisma.placement.findUniqueOrThrow({
    where: { id: placementId },
    include: {
      term: true,
      section: { select: { mode: true } },
      evaluations: { where: { status: { in: ["SUBMITTED", "LOCKED"] } } },
      finalGrade: true,
    },
  });
  if (p.finalGrade && p.finalGrade.status !== "CALCULATED") return { skipped: true as const, grade: p.finalGrade };

  const [submittedWeekly, unexcusedAbsences] = await Promise.all([
    weeklyLogWeeks(placementId),
    prisma.attendanceRecord.count({ where: { placementId, status: "ABSENT" } }),
  ]);

  const field = p.evaluations.find((e) => e.type === "FIELD");
  const academic = p.evaluations.find((e) => e.type === "ACADEMIC");

  const g = calculateFinalGrade({
    weights: { fieldWeight: p.term.fieldWeight, academicWeight: p.term.academicWeight, attendanceWeight: p.term.attendanceWeight },
    fieldPercentage: field ? toNum(field.percentage) : null,
    academicPercentage: academic ? toNum(academic.percentage) : null,
    approvedMinutes: p.approvedMinutes,
    requiredHours: p.requiredHours,
    expectedWeeklyLogbooks: expectedWeeks(p.startDate, p.endDate),
    submittedWeeklyLogbooks: submittedWeekly,
    unexcusedAbsences,
    hoursApplicable: p.section?.mode !== "SIMULATION",
    fieldApplicable: p.section?.mode !== "SIMULATION",
  });

  const data = {
    fieldComponent: g.fieldComponent,
    academicComponent: g.academicComponent,
    attendanceComponent: g.attendanceComponent,
    total: g.total,
    letterGrade: g.letterGrade,
    breakdown: { ...g.details, passed: g.passed },
    calculatedAt: new Date(),
  };
  const grade = await prisma.finalGrade.upsert({
    where: { placementId },
    create: { placementId, ...data },
    update: data,
  });
  return { skipped: false as const, grade, missing: g.details.missing };
}
