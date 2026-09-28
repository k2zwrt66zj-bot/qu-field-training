// =====================================================================
//  «سجل الحضور والانصراف» اليومي للمؤسسة — يوقّعه المشرف المؤسسي
//  الأوقات من التحضير الجغرافي، و«التوقيع» أمام كل طالب هو تحضيره الموثّق بالموقع.
//  عند توقيع المشرف: يُسجَّل غياب من لم يحضر في يوم تدريبه، وتُحفظ بصمة SHA-256
//  لسجلات اليوم، ويُقفل اليوم أمام أي تعديل لاحق (تحضير، أو تعديل يدوي، أو تعديل المدة).
// =====================================================================
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, audit, type SessionUser } from "@/lib/api";
import { sheetRecordsHash } from "@/lib/attendance-sheet";
import { riyadhDateOnly } from "@/lib/time";
import { FIELD_MODE_ONLY, recomputeApprovedMinutes } from "@/server/attendance";
import { getActiveTerm } from "@/server/stats";
import { weekNumberFor } from "@/server/forms/prefill";

const HEADS = ["TRAINING_HEAD", "DEPARTMENT_HEAD", "ADMIN"];
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const DAY = 86_400_000;
export const parseDay = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ApiError(422, "صيغة التاريخ غير صحيحة");
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new ApiError(422, "تاريخ غير صالح");
  return d;
};
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// ------------------------------------------------------------------ النطاق

/** المؤسسات التي يحق للمستخدم رؤية كشوفها */
export async function sheetOrganizations(user: SessionUser): Promise<string[] | "ALL"> {
  if (HEADS.includes(user.role)) return "ALL";
  if (user.role === "FIELD_SUPERVISOR") {
    const p = await prisma.fieldSupervisorProfile.findUnique({ where: { userId: user.id }, select: { organizationId: true } });
    return p ? [p.organizationId] : [];
  }
  if (user.role === "ACADEMIC_SUPERVISOR") {
    const rows = await prisma.placement.findMany({ where: { academicSupervisor: { userId: user.id }, ...FIELD_MODE_ONLY }, select: { organizationId: true }, distinct: ["organizationId"] });
    return rows.map((r) => r.organizationId);
  }
  return [];
}

async function assertOrgAccess(user: SessionUser, organizationId: string) {
  const orgs = await sheetOrganizations(user);
  if (orgs !== "ALL" && !orgs.includes(organizationId)) throw new ApiError(404, "الكشف غير موجود");
}

/** متدربو المؤسسة في التدريب الميداني (لا المحاكاة) للفصل الحالي */
async function orgTrainees(organizationId: string, termId: string) {
  return prisma.placement.findMany({
    where: { organizationId, termId, status: { in: ["ACTIVE", "COMPLETED"] }, ...FIELD_MODE_ONLY },
    select: {
      id: true, startDate: true, endDate: true, workDays: true,
      student: { select: { universityId: true, user: { select: { fullName: true } } } },
      fieldSupervisor: { select: { user: { select: { fullName: true } } } },
      academicSupervisor: { select: { user: { select: { fullName: true } } } },
    },
    orderBy: { student: { user: { fullName: "asc" } } },
  });
}
type Trainee = Awaited<ReturnType<typeof orgTrainees>>[number];

/** هل اليوم يوم تدريب لهذا المتدرب (ضمن مدته وأيامه المعتمدة)؟ */
const trainsOn = (t: Pick<Trainee, "startDate" | "endDate" | "workDays">, day: Date) =>
  day >= t.startDate && day <= t.endDate && t.workDays.includes(day.getUTCDay());

// ------------------------------------------------------------------ الكشف

export async function loadSheet(user: SessionUser, organizationId: string, dayStr: string) {
  await assertOrgAccess(user, organizationId);
  const day = parseDay(dayStr);
  const term = await getActiveTerm();
  if (!term) throw new ApiError(409, "لا يوجد فصل دراسي فعّال");
  const [org, trainees, sheet, fsProfile] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    orgTrainees(organizationId, term.id),
    prisma.attendanceSheet.findUnique({
      where: { organizationId_sheetDate: { organizationId, sheetDate: day } },
      include: { signatures: { include: { signature: { select: { imageData: true, signedAt: true } } } }, fieldSupervisor: { select: { user: { select: { fullName: true } } } } },
    }),
    user.role === "FIELD_SUPERVISOR" ? prisma.fieldSupervisorProfile.findUnique({ where: { userId: user.id }, select: { organizationId: true } }) : null,
  ]);
  if (!org) throw new ApiError(404, "المؤسسة غير موجودة");

  const expected = trainees.filter((t) => trainsOn(t, day));
  const records = await prisma.attendanceRecord.findMany({ where: { placementId: { in: expected.map((t) => t.id) }, date: day } });
  const rows = expected.map((t) => {
    const r = records.find((x) => x.placementId === t.id) ?? null;
    return {
      placementId: t.id,
      name: t.student.user.fullName,
      universityId: t.student.universityId,
      record: r && {
        id: r.id, status: r.status, checkInAt: r.checkInAt, checkOutAt: r.checkOutAt, workedMinutes: r.workedMinutes,
        approvalStatus: r.approvalStatus, isSuspicious: r.isSuspicious, geo: r.checkInLat != null,
      },
    };
  });

  const minStart = trainees.reduce<Date | null>((m, t) => (!m || t.startDate < m ? t.startDate : m), null);
  const maxEnd = trainees.reduce<Date | null>((m, t) => (!m || t.endDate > m ? t.endDate : m), null);
  const names = (xs: (string | undefined)[]) => [...new Set(xs.filter(Boolean))].join("، ") || null;
  const today = riyadhDateOnly();
  const open = rows.filter((r) => r.record?.checkInAt && !r.record.checkOutAt && ["PRESENT", "LATE"].includes(r.record.status));
  const currentHash = sheetRecordsHash(rows.map((r) => ({ placementId: r.placementId, record: r.record })));
  const signed = !!sheet?.signedAt;
  const canSign = !!fsProfile && fsProfile.organizationId === organizationId && !signed && day <= today && rows.length > 0;

  return {
    organizationId,
    date: dayKey(day),
    weekday: day.getUTCDay(),
    weekNumber: minStart ? weekNumberFor(minStart, day) : null,
    header: {
      organization: org.name,
      phone: org.phone ?? org.contactPhone ?? null,
      director: org.directorName,
      email: org.contactEmail,
      fieldSupervisors: names(trainees.map((t) => t.fieldSupervisor?.user.fullName)),
      academicSupervisors: names(trainees.map((t) => t.academicSupervisor?.user.fullName)),
      address: [org.address, org.city].filter(Boolean).join(" — ") || null,
      trainees: trainees.length,
      startDate: minStart ? dayKey(minStart) : null,
      endDate: maxEnd ? dayKey(maxEnd) : null,
    },
    rows,
    summary: {
      expected: rows.length,
      present: rows.filter((r) => r.record && ["PRESENT", "LATE"].includes(r.record.status)).length,
      absent: rows.filter((r) => r.record?.status === "ABSENT").length,
      excused: rows.filter((r) => r.record && ["EXCUSED", "HOLIDAY"].includes(r.record.status)).length,
      missing: rows.filter((r) => !r.record).length,
      pendingApproval: rows.filter((r) => r.record?.approvalStatus === "PENDING").length,
    },
    open: open.map((r) => r.name),
    sheet: sheet?.signedAt
      ? {
          signedAt: sheet.signedAt,
          signerName: sheet.signatures[0]?.signerName ?? sheet.fieldSupervisor?.user.fullName ?? null,
          imageData: sheet.signatures[0]?.signature.imageData ?? null,
          recordsHash: sheet.recordsHash,
          /** تطابق سجلات اليوم الحالية مع ما وُقّع عليه */
          intact: sheet.recordsHash === currentHash,
        }
      : null,
    canSign,
    isToday: day.getTime() === today.getTime(),
  };
}

export type LoadedSheet = Awaited<ReturnType<typeof loadSheet>>;

/** أيام التدريب الأخيرة للمؤسسة مع حالة كل كشف (للقائمة) */
export async function listSheetDays(user: SessionUser, organizationId: string, limit = 21) {
  await assertOrgAccess(user, organizationId);
  const term = await getActiveTerm();
  if (!term) return { organization: null, days: [] };
  const [org, trainees] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } }),
    orgTrainees(organizationId, term.id),
  ]);
  if (!trainees.length) return { organization: org, days: [] };
  const today = riyadhDateOnly();
  const from = trainees.reduce((m, t) => (t.startDate < m ? t.startDate : m), trainees[0].startDate);
  const toEnd = trainees.reduce((m, t) => (t.endDate > m ? t.endDate : m), trainees[0].endDate);
  const until = toEnd < today ? toEnd : today;
  const [records, sheets] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { placementId: { in: trainees.map((t) => t.id) }, date: { gte: from, lte: until } }, select: { placementId: true, date: true, status: true, approvalStatus: true } }),
    prisma.attendanceSheet.findMany({ where: { organizationId, sheetDate: { gte: from, lte: until } }, select: { sheetDate: true, signedAt: true } }),
  ]);
  const days = [];
  for (let d = new Date(until); d >= from && days.length < limit; d = new Date(d.getTime() - DAY)) {
    const expected = trainees.filter((t) => trainsOn(t, d));
    if (!expected.length) continue;
    const key = dayKey(d);
    const recs = records.filter((r) => dayKey(r.date) === key);
    days.push({
      date: key,
      weekday: d.getUTCDay(),
      expected: expected.length,
      present: recs.filter((r) => ["PRESENT", "LATE"].includes(r.status)).length,
      absent: recs.filter((r) => r.status === "ABSENT").length + (expected.length - recs.length),
      pendingApproval: recs.filter((r) => r.approvalStatus === "PENDING").length,
      signed: !!sheets.find((s) => dayKey(s.sheetDate) === key)?.signedAt,
    });
  }
  return { organization: org, days };
}

// ------------------------------------------------------------------ التوقيع

export async function signSheet(user: SessionUser, organizationId: string, dayStr: string, imageData: string, ip?: string | null) {
  const profile = await prisma.fieldSupervisorProfile.findUnique({ where: { userId: user.id }, include: { user: { select: { fullName: true } } } });
  if (!profile || profile.organizationId !== organizationId) throw new ApiError(403, "يوقّع الكشف المشرف المؤسسي لهذه المؤسسة");
  if (!PNG_DATA_URL.test(imageData) || imageData.length > 300_000) throw new ApiError(422, "التوقيع مطلوب");
  const sheet = await loadSheet(user, organizationId, dayStr);
  if (sheet.sheet) throw new ApiError(409, "كشف هذا اليوم موقّع مسبقاً");
  if (!sheet.canSign) throw new ApiError(422, sheet.rows.length ? "لا يمكن توقيع كشف ليوم لم يأتِ بعد" : "لا يوجد متدربون في يوم تدريب بهذا التاريخ");
  if (sheet.isToday && sheet.open.length) throw new ApiError(422, `بانتظار تسجيل الانصراف: ${sheet.open.join("، ")}`);

  const day = parseDay(dayStr);
  const missing = sheet.rows.filter((r) => !r.record).map((r) => r.placementId);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // من لم يحضر في يوم تدريبه: غياب (كما تفعل مهمة الغياب اليومية)
    if (missing.length) {
      await tx.attendanceRecord.createMany({ data: missing.map((placementId) => ({ placementId, date: day, status: "ABSENT", approvalStatus: "APPROVED", approvedById: user.id, approvedAt: now })), skipDuplicates: true });
    }
    const ids = sheet.rows.map((r) => r.placementId);
    const records = await tx.attendanceRecord.findMany({ where: { placementId: { in: ids }, date: day } });
    const hash = sheetRecordsHash(ids.map((placementId) => ({ placementId, record: records.find((r) => r.placementId === placementId) ?? null })));
    const saved = await tx.attendanceSheet.upsert({
      where: { organizationId_sheetDate: { organizationId, sheetDate: day } },
      create: { organizationId, sheetDate: day, weekNumber: sheet.weekNumber, fieldSupervisorId: profile.id, recordsHash: hash, signedAt: now },
      update: { weekNumber: sheet.weekNumber, fieldSupervisorId: profile.id, recordsHash: hash, signedAt: now },
    });
    await tx.attendanceRecord.updateMany({ where: { id: { in: records.map((r) => r.id) } }, data: { sheetId: saved.id } });
    const sig = await tx.signature.create({ data: { signerId: user.id, imageData, contentHash: hash, ipAddress: ip ?? undefined } });
    await tx.formSignature.create({ data: { slot: "FIELD_SUPERVISOR", signatureId: sig.id, signerUserId: user.id, signerName: profile.user.fullName, sheetId: saved.id } });
    for (const pid of missing) await recomputeApprovedMinutes(pid, tx);
  });
  await audit(user.id, "attendance.sheet.sign", "AttendanceSheet", undefined, { organizationId, date: dayStr, absentMarked: missing.length }, ip);
  return loadSheet(user, organizationId, dayStr);
}

// ------------------------------------------------------------------ القفل بعد التوقيع

/** يمنع أي تعديل على سجلات يوم وُقّع كشفه (التحضير، والتعديل اليدوي، وتعديل المدة) */
export async function assertDayOpen(placementIds: string[], day: Date, tx: Prisma.TransactionClient = prisma) {
  const placements = await tx.placement.findMany({ where: { id: { in: placementIds } }, select: { organizationId: true } });
  const signed = await tx.attendanceSheet.findFirst({
    where: { organizationId: { in: [...new Set(placements.map((p) => p.organizationId))] }, sheetDate: day, signedAt: { not: null } },
    select: { id: true },
  });
  if (signed) throw new ApiError(409, "كشف الحضور لهذا اليوم موقّع من المشرف المؤسسي ولا يقبل التعديل");
}
