import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerm } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CriteriaTabs } from "@/components/settings/criteria-tabs";
import { TermSettingsForm } from "@/components/settings/term-settings-form";

export const metadata = { title: "بنود التقييم والإعدادات" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();
  if (!term) return <p>لا يوجد فصل دراسي معرّف.</p>;
  const gradesApproved = await prisma.finalGrade.count({ where: { placement: { termId: term.id }, status: { not: "CALCULATED" } } });

  return (
    <>
      <PageHeader title="بنود التقييم وإعدادات الفصل" description={term.name} />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>استمارات التقييم المعتمدة</CardTitle>
            <CardDescription>البنود التي يقيّم بها المشرفون الطلاب. يمكن تخصيص بنود لتخصص واحد (مثل دراسة الحالة للخدمة الاجتماعية)، وتُحسب نسبة الطالب من مجموع البنود المنطبقة على تخصصه.</CardDescription>
          </CardHeader>
          <CardContent><CriteriaTabs termId={term.id} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>إعدادات الفصل</CardTitle></CardHeader>
          <CardContent>
            <TermSettingsForm
              termId={term.id}
              gradesApproved={gradesApproved}
              initial={{
                fieldWeight: term.fieldWeight,
                academicWeight: term.academicWeight,
                attendanceWeight: term.attendanceWeight,
                requiredHours: term.requiredHours,
                lateAfterMinutes: term.lateAfterMinutes,
                minDailyMinutes: term.minDailyMinutes,
                maxConsecutiveAbsences: term.maxConsecutiveAbsences,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
