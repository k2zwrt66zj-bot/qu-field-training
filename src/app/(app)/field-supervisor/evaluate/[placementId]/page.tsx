import { requirePageRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { EvaluationForm } from "@/components/evaluation/evaluation-form";

export const metadata = { title: "التقييم الميداني" };

export default async function FieldEvaluationPage({ params }: { params: Promise<{ placementId: string }> }) {
  await requirePageRole("FIELD_SUPERVISOR");
  const { placementId } = await params;
  return (
    <>
      <PageHeader title="استمارة تقييم الأداء الميداني" description="وفق النموذج المعتمد من وحدة التدريب الميداني — تمثل 40% من الدرجة النهائية" />
      <EvaluationForm placementId={placementId} backHref="/field-supervisor" />
    </>
  );
}
