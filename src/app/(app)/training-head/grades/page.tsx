import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerm } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { GradesManager, type GradeRow } from "@/components/grades/grades-manager";
import { toNum } from "@/lib/utils";

export const metadata = { title: "اعتماد النتائج" };
export const dynamic = "force-dynamic";

export default async function GradesPage() {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();
  if (!term) return <p>لا يوجد فصل دراسي معرّف.</p>;
  const placements = await prisma.placement.findMany({
    where: { termId: term.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: { student: { include: { user: true } }, organization: true, finalGrade: true },
    orderBy: { student: { universityId: "asc" } },
  });
  const rows: GradeRow[] = placements.map((p) => {
    const g = p.finalGrade;
    return {
      placementId: p.id,
      student: p.student.user.fullName,
      universityId: p.student.universityId,
      organization: p.organization.name,
      field: g ? toNum(g.fieldComponent) : null,
      academic: g ? toNum(g.academicComponent) : null,
      attendance: g ? toNum(g.attendanceComponent) : null,
      total: g ? toNum(g.total) : null,
      letter: g?.letterGrade ?? null,
      status: g?.status ?? null,
      missing: ((g?.breakdown as { missing?: string[] } | null)?.missing) ?? [],
    };
  });
  return (
    <>
      <PageHeader title="اعتماد النتائج النهائية" description={term.name} />
      <GradesManager termId={term.id} rows={rows} weights={{ f: term.fieldWeight, a: term.academicWeight, t: term.attendanceWeight }} />
    </>
  );
}
