import { AlarmClock, CircleAlert, ClipboardCheck, ShieldAlert, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerm, getTrainingHeadStats } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { AttendanceTrendChart } from "@/components/dashboard/charts";
import { AutoRefresh, ResolveAlertButton } from "@/components/dashboard/live-widgets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatShortDateAr, formatTimeAr } from "@/lib/time";

export const metadata = { title: "لوحة المتابعة اللحظية" };
export const dynamic = "force-dynamic";

const SEVERITY = { CRITICAL: { label: "حرج", v: "destructive" }, WARNING: { label: "تحذير", v: "warning" }, INFO: { label: "معلومة", v: "muted" } } as const;

export default async function TrainingHeadDashboard() {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();
  if (!term) return <p>لا يوجد فصل دراسي معرّف.</p>;
  const [s, awaiting] = await Promise.all([
    getTrainingHeadStats(term.id),
    // طلاب وُزّعوا ولم يباشروا بعد (نموذج المباشرة لم يُعتمد): مع مشرفيهم
    prisma.placement.findMany({
      where: { termId: term.id, status: "ASSIGNED" },
      select: {
        id: true,
        startDate: true,
        student: { select: { universityId: true, user: { select: { fullName: true } } } },
        organization: { select: { name: true } },
        academicSupervisor: { select: { user: { select: { fullName: true } } } },
        fieldSupervisor: { select: { user: { select: { fullName: true } } } },
        forms: { where: { kind: "COMMENCEMENT" }, select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const k = s.kpis;
  const commencementStep = (st?: string) =>
    !st ? { text: "لم يبدأ نموذج المباشرة", v: "muted" as const }
    : st === "DRAFT" || st === "RETURNED" ? { text: "يعبّئ نموذج المباشرة", v: "muted" as const }
    : st === "SUBMITTED" ? { text: "بانتظار توقيع المشرف المؤسسي", v: "warning" as const }
    : { text: "بانتظار الاعتماد الأكاديمي", v: "teal" as const };

  return (
    <>
      <PageHeader title="لوحة المتابعة اللحظية" description={`${term.name} · وحدة التدريب الميداني`} actions={<AutoRefresh />} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="متدربون على رأس التدريب" value={k.active} icon={Users} />
        <StatCard label="حاضرون اليوم" value={k.presentToday} hint={`منهم ${k.lateToday} متأخر`} icon={UserCheck} tone="success" />
        <StatCard label="لم يحضّروا بعد" value={k.notYet} icon={AlarmClock} tone="teal" />
        <StatCard label="بانتظار اعتماد المشرف" value={k.pendingApprovals} icon={ClipboardCheck} tone="warning" />
        <StatCard label="اشتباه تحضير وهمي" value={k.suspiciousOpen} icon={ShieldAlert} tone={k.suspiciousOpen ? "danger" : "default"} />
        <StatCard label="تنبيهات حرجة" value={k.criticalAlerts} icon={CircleAlert} tone={k.criticalAlerts ? "danger" : "default"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_400px] [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>الحضور خلال آخر أسبوعين</CardTitle>
            <CardDescription>عدد السجلات اليومية حسب الحالة (أيام التدريب فقط)</CardDescription>
          </CardHeader>
          <CardContent><AttendanceTrendChart data={s.trend} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>التنبيهات المفتوحة</CardTitle>
            <CardDescription>غياب متتالٍ، اشتباه GPS، تأخر الساعات</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[300px] space-y-2 overflow-y-auto">
            {s.alerts.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">لا توجد تنبيهات مفتوحة</p>}
            {s.alerts.map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                <Badge variant={SEVERITY[a.severity].v}>{SEVERITY[a.severity].label}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.message}</div>
                </div>
                <ResolveAlertButton id={a.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4" data-awaiting-commencement>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>بانتظار المباشرة ({awaiting.length})</CardTitle>
            <CardDescription>طلاب وُزّعوا على جهات التدريب ولم يُعتمد نموذج مباشرتهم بعد، مع مشرفيهم</CardDescription>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/training-head/commencements" className="text-qu-teal-700 hover:underline">كل نماذج المباشرة ←</Link>
            <Link href="/training-head/supervisors" className="text-qu-teal-700 hover:underline">كل المشرفين والمتدربين ←</Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>الطالب/ة</TH><TH>جهة التدريب</TH><TH>المشرف الأكاديمي</TH><TH>المشرف المؤسسي</TH><TH>بداية التدريب</TH><TH>المرحلة</TH><TH></TH></TR></THead>
            <TBody>
              {awaiting.length === 0 && <TR><TD colSpan={7} className="py-6 text-center text-muted-foreground">باشر جميع الطلاب الموزعين</TD></TR>}
              {awaiting.map((a) => {
                const step = commencementStep(a.forms[0]?.status);
                // المسودة خاصة بالطالب حتى يرفعها
                const form = a.forms[0]?.status && a.forms[0].status !== "DRAFT" ? a.forms[0] : null;
                return (
                  <TR key={a.id}>
                    <TD><div className="font-medium">{a.student.user.fullName}</div><div className="text-xs text-muted-foreground">{a.student.universityId}</div></TD>
                    <TD className="text-xs">{a.organization.name}</TD>
                    <TD className="text-sm">{a.academicSupervisor?.user.fullName ?? "—"}</TD>
                    <TD className="text-sm">{a.fieldSupervisor?.user.fullName ?? "—"}</TD>
                    <TD className="whitespace-nowrap text-xs">{formatShortDateAr(a.startDate)}</TD>
                    <TD><Badge variant={step.v}>{step.text}</Badge></TD>
                    <TD className="whitespace-nowrap text-xs">
                      {form
                        ? <Link href={`/forms/${form.id}`} className="font-medium text-qu-teal-700 hover:underline">نموذج المباشرة</Link>
                        : <Link href={`/portfolio/${a.id}`} className="text-muted-foreground hover:underline">السجل المهني</Link>}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>الحالات الحرجة</CardTitle>
            <CardDescription>غياب متكرر (يومان فأكثر) أو ساعات أقل من 75% من المتوقع</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>الطالب/ة</TH><TH>الجهة</TH><TH>الغياب</TH><TH>الساعات / المتوقع</TH></TR></THead>
              <TBody>
                {s.critical.length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-muted-foreground">لا توجد حالات حرجة</TD></TR>}
                {s.critical.map((c) => (
                  <TR key={c.id}>
                    <TD><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.universityId}</div></TD>
                    <TD className="text-xs">{c.org}</TD>
                    <TD><Badge variant={c.absences >= 3 ? "destructive" : "warning"}>{c.absences} أيام</Badge></TD>
                    <TD className="tabular-nums">{c.hours} / {c.expectedHours}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>آخر عمليات التحضير اليوم</CardTitle>
            <CardDescription>تتحدث تلقائياً كل دقيقة</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>الطالب/ة</TH><TH>الجهة</TH><TH>الوقت</TH><TH>المسافة</TH><TH></TH></TR></THead>
              <TBody>
                {s.latestCheckIns.length === 0 && <TR><TD colSpan={5} className="py-6 text-center text-muted-foreground">لا يوجد تحضير اليوم بعد</TD></TR>}
                {s.latestCheckIns.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.placement.student.user.fullName}</TD>
                    <TD className="text-xs">{r.placement.organization.name}</TD>
                    <TD className="whitespace-nowrap tabular-nums">{r.checkInAt && formatTimeAr(r.checkInAt)}</TD>
                    <TD className="whitespace-nowrap tabular-nums">{Math.round(r.checkInDistance ?? 0)} م</TD>
                    <TD>
                      {r.isSuspicious ? <Badge variant="destructive"><ShieldAlert className="size-3" />مشتبه</Badge> : r.status === "LATE" ? <Badge variant="warning">متأخر</Badge> : <Badge variant="success">حاضر</Badge>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
