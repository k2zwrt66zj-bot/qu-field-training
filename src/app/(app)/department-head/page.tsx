import { Award, Building2, GraduationCap, Target, TrendingUp, Users } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { getActiveTerm, getExecutiveStats } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { GradeDistributionChart, HorizontalBarChart, MajorGenderChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { INSTITUTION } from "@/lib/labels";
import { fmt } from "@/lib/utils";

export const metadata = { title: "اللوحة الاستراتيجية" };
export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v == null ? "—" : `${fmt(v * 100, 0)}%`);

export default async function ExecutiveDashboard() {
  await requirePageRole("DEPARTMENT_HEAD", "TRAINING_HEAD");
  const term = await getActiveTerm();
  if (!term) return <p>لا يوجد فصل دراسي معرّف.</p>;
  const s = await getExecutiveStats(term.id);
  const k = s.kpis;

  return (
    <>
      <PageHeader
        title="اللوحة الاستراتيجية للتدريب الميداني"
        description={`${INSTITUTION.department} · ${term.name}`}
        actions={
          <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/api/grades/export?termId=${term.id}`}>
            تصدير كشف الدرجات المعتمد
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="إجمالي المتدربين" value={k.total} hint={`طلاب ${k.male} · طالبات ${k.female}`} icon={Users} />
        <StatCard label="متوسط إنجاز الساعات" value={pct(k.completion)} icon={Target} tone="teal" />
        <StatCard label="أنهوا التدريب" value={k.completed} icon={GraduationCap} tone="success" />
        <StatCard label="متوسط الدرجة النهائية" value={k.avgGrade == null ? "—" : fmt(k.avgGrade, 1)} hint="من 100" icon={Award} />
        <StatCard label="نسبة النجاح" value={pct(k.passRate)} icon={TrendingUp} tone="success" />
        <StatCard label="جهات شريكة فاعلة" value={k.partners} icon={Building2} tone="teal" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>المتدربون حسب التخصص</CardTitle><CardDescription>طلاب وطالبات</CardDescription></CardHeader>
          <CardContent><MajorGenderChart data={s.byMajorGender} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>مجالات التدريب</CardTitle><CardDescription>عدد المتدربين حسب تصنيف الجهة</CardDescription></CardHeader>
          <CardContent><HorizontalBarChart data={s.byCategory} dataKey="count" labelKey="category" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>توزيع التقديرات</CardTitle><CardDescription>الدرجات المحتسبة لهذا الفصل</CardDescription></CardHeader>
          <CardContent><GradeDistributionChart data={s.gradeDist} /></CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>أداء جهات التدريب الشريكة</CardTitle>
          <CardDescription>نسبة الانتظام، إنجاز الساعات، ومتوسط تقييم المشرفين الميدانيين</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>الجهة</TH><TH>التصنيف</TH><TH>المتدربون</TH><TH>نسبة الانتظام</TH><TH className="min-w-40">إنجاز الساعات</TH><TH>متوسط التقييم الميداني</TH></TR>
            </THead>
            <TBody>
              {s.orgPerf.map((o) => (
                <TR key={o.id}>
                  <TD className="font-medium">{o.name}</TD>
                  <TD className="text-xs text-muted-foreground">{o.category}</TD>
                  <TD className="tabular-nums">{o.students}</TD>
                  <TD className="tabular-nums">{pct(o.attendanceRate)}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Progress value={o.hoursCompletion * 100} className="h-1.5" />
                      <span className="w-10 text-xs tabular-nums">{pct(o.hoursCompletion)}</span>
                    </div>
                  </TD>
                  <TD className="tabular-nums">{o.avgFieldEval == null ? "—" : `${fmt(o.avgFieldEval, 1)}%`}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
