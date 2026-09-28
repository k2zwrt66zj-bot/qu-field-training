import { prisma } from "@/lib/prisma";
import { riyadhDateOnly } from "@/lib/time";
import { toNum } from "@/lib/utils";
import { ORG_CATEGORY_LABELS } from "@/lib/labels";

export async function getActiveTerm() {
  return (await prisma.academicTerm.findFirst({ where: { isActive: true } })) ?? prisma.academicTerm.findFirst({ orderBy: { startDate: "desc" } });
}

/** بيانات لوحة المتابعة اللحظية لرئيس وحدة التدريب */
export async function getTrainingHeadStats(termId: string) {
  const today = riyadhDateOnly();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 13);
  const running = { termId, status: { in: ["ASSIGNED", "ACTIVE"] as ("ASSIGNED" | "ACTIVE")[] } };

  const [active, todayRecords, pendingApprovals, suspiciousOpen, alerts, trendRaw, latestCheckIns, placements] = await Promise.all([
    prisma.placement.count({ where: running }),
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: today, placement: { termId } }, _count: true }),
    prisma.attendanceRecord.count({ where: { approvalStatus: "PENDING", placement: { termId } } }),
    prisma.alert.count({ where: { type: "SUSPICIOUS_GPS", isResolved: false } }),
    prisma.alert.findMany({
      where: { isResolved: false },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
    prisma.attendanceRecord.groupBy({ by: ["date", "status"], where: { date: { gte: from, lte: today }, placement: { termId } }, _count: true }),
    prisma.attendanceRecord.findMany({
      where: { date: today, checkInAt: { not: null }, placement: { termId } },
      orderBy: { checkInAt: "desc" },
      take: 8,
      include: { placement: { select: { student: { select: { user: { select: { fullName: true } } } }, organization: { select: { name: true } } } } },
    }),
    prisma.placement.findMany({
      where: running,
      select: {
        id: true,
        approvedMinutes: true,
        requiredHours: true,
        startDate: true,
        endDate: true,
        student: { select: { universityId: true, user: { select: { fullName: true } } } },
        organization: { select: { name: true } },
        _count: { select: { attendance: { where: { status: "ABSENT" } } } },
      },
    }),
  ]);

  const count = (s: string) => todayRecords.find((r) => r.status === s)?._count ?? 0;
  const presentToday = count("PRESENT") + count("LATE");

  // اتجاه الحضور خلال 14 يوماً
  const days = new Map<string, { date: string; PRESENT: number; LATE: number; ABSENT: number }>();
  for (let d = new Date(from); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    days.set(k, { date: k, PRESENT: 0, LATE: 0, ABSENT: 0 });
  }
  for (const r of trendRaw) {
    const row = days.get(r.date.toISOString().slice(0, 10));
    if (row && (r.status === "PRESENT" || r.status === "LATE" || r.status === "ABSENT")) row[r.status] += r._count;
  }
  // نستبعد أيام العطلة (لا سجلات)
  const trend = [...days.values()].filter((d) => d.PRESENT + d.LATE + d.ABSENT > 0);

  // الحالات الحرجة: غياب متكرر أو تأخر في الساعات
  const critical = placements
    .map((p) => {
      const total = Math.max(1, p.endDate.getTime() - p.startDate.getTime());
      const elapsed = Math.min(1, Math.max(0, (today.getTime() - p.startDate.getTime()) / total));
      const expectedHours = elapsed * p.requiredHours;
      const hours = p.approvedMinutes / 60;
      return {
        id: p.id,
        name: p.student.user.fullName,
        universityId: p.student.universityId,
        org: p.organization.name,
        absences: p._count.attendance,
        hours: Math.round(hours),
        expectedHours: Math.round(expectedHours),
        gap: expectedHours > 0 ? hours / expectedHours : 1,
      };
    })
    .filter((p) => p.absences >= 2 || p.gap < 0.75)
    .sort((a, b) => b.absences - a.absences || a.gap - b.gap)
    .slice(0, 10);

  return {
    kpis: {
      active,
      presentToday,
      lateToday: count("LATE"),
      notYet: Math.max(0, active - presentToday - count("ABSENT") - count("EXCUSED")),
      pendingApprovals,
      suspiciousOpen,
      criticalAlerts: alerts.filter((a) => a.severity === "CRITICAL").length,
    },
    alerts,
    trend,
    latestCheckIns,
    critical,
  };
}

/** بيانات اللوحة الاستراتيجية لرئيس القسم */
export async function getExecutiveStats(termId: string) {
  const [placements, grades, orgs, fieldEvals, attendance] = await Promise.all([
    prisma.placement.findMany({
      where: { termId, status: { notIn: ["DRAFT", "WITHDRAWN"] } },
      select: {
        id: true,
        status: true,
        approvedMinutes: true,
        requiredHours: true,
        organizationId: true,
        student: { select: { major: true, gender: true } },
      },
    }),
    prisma.finalGrade.findMany({ where: { placement: { termId } }, select: { total: true, letterGrade: true, status: true } }),
    prisma.organization.findMany({ where: { isApproved: true }, select: { id: true, name: true, category: true } }),
    prisma.evaluation.findMany({
      where: { type: "FIELD", status: { not: "DRAFT" }, placement: { termId } },
      select: { percentage: true, placement: { select: { organizationId: true } } },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["placementId", "status"],
      where: { placement: { termId }, status: { in: ["PRESENT", "LATE", "ABSENT"] } },
      _count: true,
    }),
  ]);

  const total = placements.length;
  const byMajorGender = (["SOCIOLOGY", "SOCIAL_WORK"] as const).map((major) => ({
    major: major === "SOCIOLOGY" ? "علم الاجتماع" : "الخدمة الاجتماعية",
    طلاب: placements.filter((p) => p.student.major === major && p.student.gender === "MALE").length,
    طالبات: placements.filter((p) => p.student.major === major && p.student.gender === "FEMALE").length,
  }));

  const completion = total
    ? placements.reduce((s, p) => s + Math.min(1, p.approvedMinutes / 60 / p.requiredHours), 0) / total
    : 0;
  const completed = placements.filter((p) => p.status === "COMPLETED").length;

  const avgGrade = grades.length ? grades.reduce((s, g) => s + toNum(g.total), 0) / grades.length : null;
  const passRate = grades.length ? grades.filter((g) => g.letterGrade !== "F").length / grades.length : null;
  const gradeOrder = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"];
  const gradeDist = gradeOrder.map((g) => ({ grade: g, count: grades.filter((x) => x.letterGrade === g).length }));

  // الجهات حسب التصنيف
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const catCount = new Map<string, number>();
  for (const p of placements) {
    const cat = orgById.get(p.organizationId)?.category;
    if (cat) catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
  }
  const byCategory = [...catCount.entries()]
    .map(([cat, count]) => ({ category: ORG_CATEGORY_LABELS[cat as keyof typeof ORG_CATEGORY_LABELS], count }))
    .sort((a, b) => b.count - a.count);

  // أداء الجهات الشريكة
  const attByPlacement = new Map<string, { present: number; all: number }>();
  for (const a of attendance) {
    const cur = attByPlacement.get(a.placementId) ?? { present: 0, all: 0 };
    cur.all += a._count;
    if (a.status !== "ABSENT") cur.present += a._count;
    attByPlacement.set(a.placementId, cur);
  }
  const orgPerf = orgs
    .map((o) => {
      const ps = placements.filter((p) => p.organizationId === o.id);
      if (!ps.length) return null;
      const att = ps.reduce((acc, p) => {
        const a = attByPlacement.get(p.id);
        return { present: acc.present + (a?.present ?? 0), all: acc.all + (a?.all ?? 0) };
      }, { present: 0, all: 0 });
      const evals = fieldEvals.filter((e) => e.placement.organizationId === o.id).map((e) => toNum(e.percentage));
      return {
        id: o.id,
        name: o.name,
        category: ORG_CATEGORY_LABELS[o.category],
        students: ps.length,
        attendanceRate: att.all ? att.present / att.all : null,
        avgFieldEval: evals.length ? evals.reduce((a, b) => a + b, 0) / evals.length : null,
        hoursCompletion: ps.reduce((s, p) => s + Math.min(1, p.approvedMinutes / 60 / p.requiredHours), 0) / ps.length,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.students - a.students);

  return {
    kpis: {
      total,
      male: placements.filter((p) => p.student.gender === "MALE").length,
      female: placements.filter((p) => p.student.gender === "FEMALE").length,
      completion,
      completed,
      avgGrade,
      passRate,
      partners: orgPerf.length,
    },
    byMajorGender,
    byCategory,
    gradeDist,
    orgPerf,
  };
}
