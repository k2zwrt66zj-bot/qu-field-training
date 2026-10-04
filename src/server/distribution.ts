import type { Gender, Major } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { haversineMeters } from "@/lib/geo/geofence";

/**
 * خوارزمية التوزيع الآلي للطلاب على جهات التدريب:
 *  1. يُرتب الطلاب حسب المعدل (الأعلى أولاً) لإنصاف المتميزين في الرغبات.
 *  2. تُجرَّب رغبات الطالب بالترتيب (جهة محددة أو تصنيف).
 *  3. يُراعى: الطاقة الاستيعابية لكل جنس، التخصصات المقبولة، نطاق الجنس في الجهة.
 *  4. إن لم تتحقق أي رغبة: أقرب جهة متاحة لسكن الطالب.
 *  5. يُسند مشرف أكاديمي بأقل عبء، ومشرف مؤسسي من الجهة بأقل عبء.
 */
export async function autoAssign(termId: string, dryRun = true) {
  const term = await prisma.academicTerm.findUniqueOrThrow({ where: { id: termId } });

  const [students, orgs, academics] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { placements: { none: { termId } }, user: { isActive: true } },
      include: { preferences: { where: { termId }, orderBy: { rank: "asc" } }, user: true },
      orderBy: { gpa: "desc" },
    }),
    prisma.organization.findMany({
      where: { isApproved: true },
      include: {
        supervisors: { include: { _count: { select: { placements: { where: { termId } } } } } },
        placements: { where: { termId }, select: { student: { select: { gender: true } } } },
      },
    }),
    prisma.academicSupervisorProfile.findMany({
      include: { _count: { select: { placements: { where: { termId } } } } },
    }),
  ]);

  // الطاقة المتبقية
  const remaining = new Map(
    orgs.map((o) => {
      const m = o.placements.filter((p) => p.student.gender === "MALE").length;
      const f = o.placements.length - m;
      return [o.id, { MALE: o.capacityMale - m, FEMALE: o.capacityFemale - f } as Record<Gender, number>];
    })
  );
  const academicLoad = new Map(academics.map((a) => [a.id, a._count.placements]));
  const fieldLoad = new Map(orgs.flatMap((o) => o.supervisors.map((s) => [s.id, s._count.placements] as const)));

  const eligible = (o: (typeof orgs)[number], gender: Gender, major: Major) =>
    (remaining.get(o.id)?.[gender] ?? 0) > 0 &&
    (o.acceptedMajors.length === 0 || o.acceptedMajors.includes(major)) &&
    (o.genderScope === "BOTH" || o.genderScope === (gender === "MALE" ? "MALE_ONLY" : "FEMALE_ONLY"));

  const plan: { studentId: string; studentName: string; organizationId: string; organizationName: string; reason: string; academicSupervisorId?: string; fieldSupervisorId?: string }[] = [];
  const unassigned: { studentId: string; studentName: string }[] = [];

  for (const s of students) {
    let chosen: (typeof orgs)[number] | undefined;
    let reason = "";
    const distance = (o: (typeof orgs)[number]) =>
      s.homeLat != null && s.homeLng != null ? haversineMeters({ latitude: s.homeLat, longitude: s.homeLng }, o) : Number.MAX_SAFE_INTEGER;

    for (const pref of s.preferences) {
      const candidates = orgs
        .filter((o) => (pref.organizationId ? o.id === pref.organizationId : pref.category ? o.category === pref.category : false))
        .filter((o) => eligible(o, s.gender, s.major))
        .sort((a, b) => distance(a) - distance(b));
      if (candidates[0]) {
        chosen = candidates[0];
        reason = `الرغبة رقم ${pref.rank}`;
        break;
      }
    }
    if (!chosen) {
      chosen = orgs.filter((o) => eligible(o, s.gender, s.major)).sort((a, b) => distance(a) - distance(b))[0];
      reason = "أقرب جهة متاحة";
    }
    if (!chosen) {
      unassigned.push({ studentId: s.id, studentName: s.user.fullName });
      continue;
    }

    remaining.get(chosen.id)![s.gender]--;
    const academic = [...academics]
      .filter((a) => (academicLoad.get(a.id) ?? 0) < a.maxStudents)
      .sort((a, b) => (academicLoad.get(a.id) ?? 0) - (academicLoad.get(b.id) ?? 0))[0];
    if (academic) academicLoad.set(academic.id, (academicLoad.get(academic.id) ?? 0) + 1);
    const field = [...chosen.supervisors].sort((a, b) => (fieldLoad.get(a.id) ?? 0) - (fieldLoad.get(b.id) ?? 0))[0];
    if (field) fieldLoad.set(field.id, (fieldLoad.get(field.id) ?? 0) + 1);

    plan.push({
      studentId: s.id,
      studentName: s.user.fullName,
      organizationId: chosen.id,
      organizationName: chosen.name,
      reason,
      academicSupervisorId: academic?.id,
      fieldSupervisorId: field?.id,
    });
  }

  if (!dryRun && plan.length) {
    await prisma.placement.createMany({
      data: plan.map((p) => ({
        studentId: p.studentId,
        termId,
        organizationId: p.organizationId,
        academicSupervisorId: p.academicSupervisorId,
        fieldSupervisorId: p.fieldSupervisorId,
        startDate: term.startDate,
        endDate: term.endDate,
        requiredHours: term.requiredHours,
        status: "ASSIGNED",
      })),
      skipDuplicates: true,
    });
  }
  return { dryRun, assigned: plan, unassigned };
}
