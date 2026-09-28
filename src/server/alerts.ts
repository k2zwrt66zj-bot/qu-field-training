import { prisma } from "@/lib/prisma";
import { riyadhDateOnly } from "@/lib/time";

/**
 * مهمة يومية (Cron) بعد نهاية الدوام:
 * 1) تسجيل الغياب آلياً لكل يوم تدريب مضى بلا تحضير.
 * 2) رفع تنبيه حرج عند تجاوز الغياب المتتالي الحد المسموح.
 * 3) تنبيه الطلاب المتأخرين في الساعات عن المعدل المتوقع.
 */
export async function runDailyAttendanceSweep(now = new Date()) {
  const today = riyadhDateOnly(now);
  const placements = await prisma.placement.findMany({
    where: { status: { in: ["ASSIGNED", "ACTIVE"] }, startDate: { lte: today } },
    include: { term: true, student: { include: { user: true } }, organization: true },
  });

  let absencesMarked = 0;
  let alertsCreated = 0;

  for (const p of placements) {
    const until = p.endDate < today ? p.endDate : today;
    const existing = await prisma.attendanceRecord.findMany({ where: { placementId: p.id }, select: { date: true, status: true } });
    const byDay = new Map(existing.map((r) => [r.date.toISOString().slice(0, 10), r.status]));

    // (1) تعليم الغياب
    const cur = new Date(p.startDate);
    const missing: Date[] = [];
    while (cur <= until) {
      if (p.workDays.includes(cur.getUTCDay()) && !byDay.has(cur.toISOString().slice(0, 10))) missing.push(new Date(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    if (missing.length) {
      await prisma.attendanceRecord.createMany({
        data: missing.map((date) => ({ placementId: p.id, date, status: "ABSENT", approvalStatus: "APPROVED" })),
        skipDuplicates: true,
      });
      absencesMarked += missing.length;
      for (const d of missing) byDay.set(d.toISOString().slice(0, 10), "ABSENT");
    }

    // (2) الغياب المتتالي (أيام العمل الأخيرة)
    const workdays = [...byDay.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
    let streak = 0;
    for (const [, status] of workdays) {
      if (status === "ABSENT") streak++;
      else if (status !== "HOLIDAY") break;
    }
    if (streak >= p.term.maxConsecutiveAbsences) {
      const exists = await prisma.alert.findFirst({
        where: { placementId: p.id, type: "CONSECUTIVE_ABSENCE", isResolved: false },
      });
      if (!exists) {
        await prisma.alert.create({
          data: {
            type: "CONSECUTIVE_ABSENCE",
            severity: "CRITICAL",
            title: `غياب متتالٍ: ${p.student.user.fullName}`,
            message: `تغيب ${streak} أيام متتالية عن ${p.organization.name}`,
            placementId: p.id,
          },
        });
        alertsCreated++;
      }
    }

    // (3) انخفاض الساعات عن المعدل المتوقع بأكثر من 25%
    const totalDays = Math.max(1, (p.endDate.getTime() - p.startDate.getTime()) / 86_400_000);
    const elapsed = Math.max(0, (until.getTime() - p.startDate.getTime()) / 86_400_000);
    const expectedMinutes = (elapsed / totalDays) * p.requiredHours * 60;
    if (expectedMinutes > 600 && p.approvedMinutes < expectedMinutes * 0.75) {
      const exists = await prisma.alert.findFirst({ where: { placementId: p.id, type: "LOW_HOURS", isResolved: false } });
      if (!exists) {
        await prisma.alert.create({
          data: {
            type: "LOW_HOURS",
            severity: "WARNING",
            title: `تأخر في الساعات: ${p.student.user.fullName}`,
            message: `المنجز ${Math.round(p.approvedMinutes / 60)} ساعة من المتوقع ${Math.round(expectedMinutes / 60)} حتى الآن`,
            placementId: p.id,
          },
        });
        alertsCreated++;
      }
    }
  }
  return { placements: placements.length, absencesMarked, alertsCreated };
}
