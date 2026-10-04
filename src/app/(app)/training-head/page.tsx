import { AlarmClock, CircleAlert, ClipboardCheck, ShieldAlert, UserCheck, Users } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { getActiveTerm, getTrainingHeadStats } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { AttendanceTrendChart } from "@/components/dashboard/charts";
import { AutoRefresh, ResolveAlertButton } from "@/components/dashboard/live-widgets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatTimeAr } from "@/lib/time";

export const metadata = { title: "لوحة المتابعة اللحظية" };
export const dynamic = "force-dynamic";

const SEVERITY = { CRITICAL: { label: "حرج", v: "destructive" }, WARNING: { label: "تحذير", v: "warning" }, INFO: { label: "معلومة", v: "muted" } } as const;

export default async function TrainingHeadDashboard() {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();
  if (!term) return <p>لا يوجد فصل دراسي معرّف.</p>;
  const s = await getTrainingHeadStats(term.id);
  const k = s.kpis;

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

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
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
