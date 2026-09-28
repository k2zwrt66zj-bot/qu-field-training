import type { AttemptType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { checkGeofence } from "@/lib/geo/geofence";
import { assessLocationRisk, RISK_FLAG_LABELS, type PositionSample, type RiskFlag } from "@/lib/geo/anti-spoof";
import { hhmmToMinutes, riyadhDateOnly, riyadhMinutesOfDay, riyadhWeekday } from "@/lib/time";

const MAX_ACCURACY = Number(process.env.GPS_MAX_ACCURACY_METERS ?? 100);
const MAX_AGE_SEC = Number(process.env.GPS_MAX_POSITION_AGE_SECONDS ?? 120);
const ENFORCE_DEVICE = (process.env.GPS_ENFORCE_DEVICE_BINDING ?? "true") === "true";
const MAX_SHIFT_MINUTES = 10 * 60;

/** الإسناد الفعّال للطالب اليوم (حسب تاريخ البداية والنهاية) */
export async function getActivePlacementForStudent(userId: string, date = riyadhDateOnly()) {
  return prisma.placement.findFirst({
    where: {
      student: { userId },
      status: { in: ["ASSIGNED", "ACTIVE"] },
      startDate: { lte: date },
      endDate: { gte: date },
    },
    include: { organization: true, term: true, student: { include: { user: true } }, fieldSupervisor: true },
  });
}

export interface AttendanceActionInput {
  userId: string;
  type: AttemptType;
  samples: PositionSample[];
  deviceId?: string | null;
  isMocked?: boolean;
  userAgent?: string | null;
  ip?: string | null;
}

export type AttendanceActionResult =
  | { ok: true; recordId: string; flagged: boolean; distance: number; riskFlags: string[]; workedMinutes?: number; status: string }
  | { ok: false; reason: string; distance?: number; riskFlags: string[] };

export async function recordAttendance(input: AttendanceActionInput): Promise<AttendanceActionResult> {
  const now = new Date();
  const today = riyadhDateOnly(now);
  const placement = await getActivePlacementForStudent(input.userId, today);
  if (!placement) throw new ApiError(404, "لا يوجد تدريب ميداني فعّال لك اليوم");
  if (!placement.workDays.includes(riyadhWeekday(now))) throw new ApiError(422, "اليوم ليس من أيام التدريب المعتمدة");

  const org = placement.organization;
  const user = placement.student.user;

  // آخر محاولة مقبولة لاكتشاف السفر المستحيل
  const lastAttempt = await prisma.attendanceAttempt.findFirst({
    where: { placementId: placement.id, result: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
  });

  const risk = assessLocationRisk({
    samples: input.samples,
    serverNow: now.getTime(),
    isMockedByOS: input.isMocked,
    deviceId: input.deviceId,
    registeredDeviceId: user.deviceId,
    enforceDeviceBinding: ENFORCE_DEVICE,
    previous: lastAttempt ? { latitude: lastAttempt.latitude, longitude: lastAttempt.longitude, at: lastAttempt.createdAt.getTime() } : null,
    maxAccuracy: MAX_ACCURACY,
    maxPositionAgeSec: MAX_AGE_SEC,
  });

  const best = risk.best;
  const fence = best
    ? checkGeofence(best, { latitude: org.latitude, longitude: org.longitude }, org.geofenceRadius, best.accuracy)
    : null;

  let verdict = risk.verdict;
  let rejectReason: string | null = null;
  if (verdict === "REJECTED") {
    rejectReason = risk.flags.map((f) => RISK_FLAG_LABELS[f as RiskFlag]).join("، ");
  } else if (!fence?.inside) {
    verdict = "REJECTED";
    rejectReason = `أنت خارج النطاق الجغرافي لجهة التدريب (تبعد ${Math.round(fence?.distance ?? 0)} م، والمسموح ${org.geofenceRadius} م)`;
  }

  const attemptData: Prisma.AttendanceAttemptUncheckedCreateInput = {
    placementId: placement.id,
    type: input.type,
    result: verdict,
    latitude: best?.latitude ?? 0,
    longitude: best?.longitude ?? 0,
    accuracy: best?.accuracy,
    altitude: best?.altitude ?? undefined,
    speed: best?.speed ?? undefined,
    heading: best?.heading ?? undefined,
    distance: fence?.distance,
    positionTime: best ? new Date(best.timestamp) : undefined,
    sampleCount: input.samples.length,
    sampleSpread: risk.spread,
    riskScore: risk.riskScore,
    riskFlags: risk.flags,
    rejectReason,
    deviceId: input.deviceId ?? undefined,
    userAgent: input.userAgent ?? undefined,
    ipAddress: input.ip ?? undefined,
  };

  if (verdict === "REJECTED" || !best || !fence) {
    await prisma.attendanceAttempt.create({ data: attemptData });
    return { ok: false, reason: rejectReason ?? "تعذر التحقق من الموقع", distance: fence?.distance, riskFlags: risk.flags };
  }

  const flagged = verdict === "FLAGGED";
  const existing = await prisma.attendanceRecord.findUnique({
    where: { placementId_date: { placementId: placement.id, date: today } },
  });

  const result = await prisma.$transaction(async (tx) => {
    await tx.attendanceAttempt.create({ data: attemptData });

    // ربط الجهاز عند أول تحضير ناجح
    if (!user.deviceId && input.deviceId) {
      await tx.user.update({ where: { id: user.id }, data: { deviceId: input.deviceId } });
    }
    // أول تحضير = مباشرة التدريب
    if (placement.status === "ASSIGNED") {
      await tx.placement.update({ where: { id: placement.id }, data: { status: "ACTIVE" } });
    }

    if (input.type === "CHECK_IN") {
      if (existing?.checkInAt) throw new ApiError(409, "تم تسجيل حضورك لهذا اليوم مسبقاً");
      const lateAfter = hhmmToMinutes(org.workStartTime) + placement.term.lateAfterMinutes;
      const status = riyadhMinutesOfDay(now) > lateAfter ? "LATE" : "PRESENT";
      const data = {
        status,
        checkInAt: now,
        checkInLat: best.latitude,
        checkInLng: best.longitude,
        checkInAccuracy: best.accuracy,
        checkInDistance: fence.distance,
        isSuspicious: flagged,
        riskScore: risk.riskScore,
        riskFlags: risk.flags,
        approvalStatus: "PENDING",
      } as const;
      const rec = existing
        ? await tx.attendanceRecord.update({ where: { id: existing.id }, data })
        : await tx.attendanceRecord.create({ data: { ...data, placementId: placement.id, date: today } });
      return { rec, workedMinutes: undefined as number | undefined };
    }

    // CHECK_OUT
    if (!existing?.checkInAt) throw new ApiError(409, "يجب تسجيل الحضور قبل الانصراف");
    if (existing.checkOutAt) throw new ApiError(409, "تم تسجيل انصرافك لهذا اليوم مسبقاً");
    const workedMinutes = Math.min(Math.round((now.getTime() - existing.checkInAt.getTime()) / 60000), MAX_SHIFT_MINUTES);
    const rec = await tx.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        checkOutLat: best.latitude,
        checkOutLng: best.longitude,
        checkOutAccuracy: best.accuracy,
        checkOutDistance: fence.distance,
        workedMinutes,
        isSuspicious: existing.isSuspicious || flagged,
        riskScore: Math.max(existing.riskScore, risk.riskScore),
        riskFlags: [...new Set([...existing.riskFlags, ...risk.flags])],
      },
    });
    return { rec, workedMinutes };
  });

  if (flagged) {
    await prisma.alert.create({
      data: {
        type: "SUSPICIOUS_GPS",
        severity: "WARNING",
        title: `اشتباه تحضير وهمي - ${user.fullName}`,
        message: `${org.name}: ${risk.flags.map((f) => RISK_FLAG_LABELS[f as RiskFlag]).join("، ")}`,
        placementId: placement.id,
      },
    });
  }

  return {
    ok: true,
    recordId: result.rec.id,
    flagged,
    distance: fence.distance,
    riskFlags: risk.flags,
    workedMinutes: result.workedMinutes,
    status: result.rec.status,
  };
}

/** إعادة احتساب مجموع الدقائق المعتمدة للإسناد */
export async function recomputeApprovedMinutes(placementId: string, tx: Prisma.TransactionClient = prisma) {
  const agg = await tx.attendanceRecord.aggregate({
    where: { placementId, approvalStatus: "APPROVED", status: { in: ["PRESENT", "LATE"] } },
    _sum: { workedMinutes: true },
  });
  const approvedMinutes = agg._sum.workedMinutes ?? 0;
  await tx.placement.update({ where: { id: placementId }, data: { approvedMinutes } });
  return approvedMinutes;
}
