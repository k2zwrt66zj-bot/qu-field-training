import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerm } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { PlacementsManager, type PlacementRow } from "@/components/placements/placements-manager";
import { MAJOR_LABELS, ORG_CATEGORY_LABELS, PLACEMENT_STATUS_LABELS } from "@/lib/labels";

export const metadata = { title: "التوزيع والخطابات" };
export const dynamic = "force-dynamic";

export default async function PlacementsPage() {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();
  if (!term) return <p>لا يوجد فصل دراسي معرّف.</p>;

  const [placements, unplacedCount] = await Promise.all([
    prisma.placement.findMany({
      where: { termId: term.id },
      include: {
        student: { include: { user: true } },
        organization: true,
        fieldSupervisor: { include: { user: true } },
        academicSupervisor: { include: { user: true } },
        letters: { where: { revokedAt: null }, orderBy: { issuedAt: "desc" } },
      },
      orderBy: [{ organization: { name: "asc" } }, { student: { universityId: "asc" } }],
    }),
    prisma.studentProfile.count({ where: { placements: { none: { termId: term.id } }, user: { isActive: true } } }),
  ]);

  const rows: PlacementRow[] = placements.map((p) => ({
    id: p.id,
    student: p.student.user.fullName,
    universityId: p.student.universityId,
    major: MAJOR_LABELS[p.student.major],
    gender: p.student.gender === "MALE" ? "طالب" : "طالبة",
    organization: p.organization.name,
    category: ORG_CATEGORY_LABELS[p.organization.category],
    fieldSupervisor: p.fieldSupervisor?.user.fullName ?? null,
    academicSupervisor: p.academicSupervisor?.user.fullName ?? null,
    status: p.status,
    statusLabel: PLACEMENT_STATUS_LABELS[p.status],
    letters: p.letters.map((l) => ({ id: l.id, type: l.type, serialNumber: l.serialNumber })),
    sectionId: p.sectionId,
  }));
  const sections = await prisma.courseSection.findMany({ where: { termId: term.id }, orderBy: [{ trainingNumber: "asc" }, { sectionNumber: "asc" }] });

  return (
    <>
      <PageHeader title="توزيع الطلاب والخطابات الرسمية" description={`${term.name} · ${rows.length} إسناد`} />
      <PlacementsManager termId={term.id} rows={rows} unplacedCount={unplacedCount} sections={sections.map((s) => ({ id: s.id, label: `${s.sectionNumber} — ${s.courseName}`, mode: s.mode }))} />
    </>
  );
}
