import { requirePageRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { EvaluationForm } from "@/components/evaluation/evaluation-form";

export const metadata = { title: "رصد الدرجة الأكاديمية" };

export default async function AcademicEvaluationPage({ params }: { params: Promise<{ placementId: string }> }) {
  await requirePageRole("ACADEMIC_SUPERVISOR");
  const { placementId } = await params;
  return (
    <>
      <PageHeader title="رصد درجة الجانب الأكاديمي" description="التقارير الدورية، دراسات الحالة/البحث الميداني، التقرير النهائي، والعرض الشفهي — تمثل 40% من الدرجة النهائية" />
      <EvaluationForm placementId={placementId} backHref="/academic-supervisor" />
    </>
  );
}
