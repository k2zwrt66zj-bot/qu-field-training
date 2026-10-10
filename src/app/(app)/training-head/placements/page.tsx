import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerm } from "@/server/stats";
import { listTransfers } from "@/server/placement-transfer";
import { PageHeader } from "@/components/layout/page-header";
import { PlacementsManager, type PlacementRow, type TransferOrg, type TransferHistoryItem } from "@/components/placements/placements-manager";
import { MAJOR_LABELS, ORG_CATEGORY_LABELS, PLACEMENT_STATUS_LABELS } from "@/lib/labels";
import { formatShortDateAr } from "@/lib/time";

export const metadata = { title: "التوزيع والخطابات" };
export const dynamic = "force-dynamic";

export default async function PlacementsPage() {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();
  if (!term) return <p>لا يوجد فصل دراسي معرّف.</p>;

  const [placements, unplacedCount, approvedOrgs, transfers] = await Promise.all([
    prisma.placement.findMany({
      // الإسنادات المؤرشفة بالنقل تظهر في «سجل النقل» فقط، لا في جدول التوزيع
      where: { termId: term.id, status: { not: "TRANSFERRED" } },
      include: {
        student: { include: { user: true } },
        organization: true,
        section: true,
        fieldSupervisor: { include: { user: true } },
        academicSupervisor: { include: { user: true } },
        letters: { where: { revokedAt: null }, orderBy: { issuedAt: "desc" } },
      },
      orderBy: [{ organization: { name: "asc" } }, { student: { universityId: "asc" } }],
    }),
    prisma.studentProfile.count({ where: { placements: { none: { termId: term.id, status: { not: "TRANSFERRED" } } }, user: { isActive: true } } }),
    // جهات التدريب المعتمدة ومشرفوها المؤسسيون النشطون (لنافذة النقل)
    prisma.organization.findMany({
      where: { isApproved: true },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, geofenceRadius: true, workStartTime: true, workEndTime: true,
        supervisors: { where: { user: { isActive: true } }, select: { id: true, user: { select: { fullName: true } } } },
      },
    }),
    listTransfers(term.id),
  ]);

  const rows: PlacementRow[] = placements.map((p) => ({
    id: p.id,
    student: p.student.user.fullName,
    universityId: p.student.universityId,
    major: MAJOR_LABELS[p.student.major],
    gender: p.student.gender === "MALE" ? "طالب" : "طالبة",
    organization: p.organization.name,
    organizationId: p.organizationId,
    category: ORG_CATEGORY_LABELS[p.organization.category],
    fieldSupervisor: p.fieldSupervisor?.user.fullName ?? null,
    fieldSupervisorId: p.fieldSupervisorId,
    academicSupervisor: p.academicSupervisor?.user.fullName ?? null,
    status: p.status,
    statusLabel: PLACEMENT_STATUS_LABELS[p.status],
    letters: p.letters.map((l) => ({ id: l.id, type: l.type, serialNumber: l.serialNumber })),
    sectionId: p.sectionId,
    // النقل يخص التدريب الميداني الفعّال فقط
    canTransfer: (p.section?.mode ?? "FIELD") === "FIELD" && (p.status === "ASSIGNED" || p.status === "ACTIVE"),
    approvedHours: Math.round(p.approvedMinutes / 60),
  }));

  const orgs: TransferOrg[] = approvedOrgs.map((o) => ({
    id: o.id,
    name: o.name,
    geofenceRadius: o.geofenceRadius,
    workStartTime: o.workStartTime,
    workEndTime: o.workEndTime,
    fieldSupervisors: o.supervisors.map((f) => ({ id: f.id, name: f.user.fullName })),
  }));

  const history: TransferHistoryItem[] = transfers.map((t) => ({
    id: t.id,
    student: t.student.user.fullName,
    universityId: t.student.universityId,
    fromOrg: t.fromPlacement.organization.name,
    toOrg: t.toPlacement.organization.name,
    fromSupervisor: t.fromPlacement.fieldSupervisor?.user.fullName ?? null,
    toSupervisor: t.toPlacement.fieldSupervisor?.user.fullName ?? null,
    reason: t.reason,
    carryOverHours: t.carryOverHours,
    carriedHours: Math.round(t.carriedMinutes / 60),
    by: t.transferredBy.fullName,
    date: formatShortDateAr(t.effectiveDate),
  }));

  const sections = await prisma.courseSection.findMany({ where: { termId: term.id }, orderBy: [{ trainingNumber: "asc" }, { sectionNumber: "asc" }] });

  return (
    <>
      <PageHeader title="توزيع الطلاب والخطابات الرسمية" description={`${term.name} · ${rows.length} إسناد`} />
      <PlacementsManager
        termId={term.id}
        rows={rows}
        unplacedCount={unplacedCount}
        sections={sections.map((s) => ({ id: s.id, label: `${s.sectionNumber} — ${s.courseName}`, mode: s.mode }))}
        orgs={orgs}
        transfers={history}
      />
    </>
  );
}
