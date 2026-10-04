import Link from "next/link";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { AttendanceApprovals, type PendingRecord } from "@/components/supervisor/attendance-approvals";
import { GuidanceForm } from "@/components/supervisor/guidance-form";
import { ArrivalSmsSettings } from "@/components/supervisor/arrival-sms-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RISK_FLAG_LABELS } from "@/lib/geo/anti-spoof";
import { MAJOR_LABELS } from "@/lib/labels";
import { formatShortDateAr, formatTimeAr } from "@/lib/time";
import { displaySaudiMobile, normalizeSaudiMobile } from "@/lib/sms-format";
import { smsConfigured } from "@/server/sms";

export const metadata = { title: "المتدربون والحضور" };
export const dynamic = "force-dynamic";

export default async function FieldSupervisorPage() {
  const user = await requirePageRole("FIELD_SUPERVISOR");
  const profile = await prisma.fieldSupervisorProfile.findUnique({ where: { userId: user.id }, include: { organization: true, user: { select: { phone: true } } } });
  const phoneIntl = normalizeSaudiMobile(profile?.user.phone);

  const placements = await prisma.placement.findMany({
    where: { fieldSupervisor: { userId: user.id }, status: { in: ["ASSIGNED", "ACTIVE", "COMPLETED"] } },
    include: {
      student: { include: { user: true } },
      evaluations: { where: { type: "FIELD" } },
      _count: { select: { attendance: { where: { status: "ABSENT" } } } },
    },
    orderBy: { student: { user: { fullName: "asc" } } },
  });
  const pending = await prisma.attendanceRecord.findMany({
    where: { approvalStatus: "PENDING", placement: { fieldSupervisor: { userId: user.id } } },
    include: { placement: { select: { student: { select: { user: { select: { fullName: true } } } } } } },
    orderBy: [{ date: "desc" }],
  });

  const rows: PendingRecord[] = pending.map((r) => ({
    id: r.id,
    student: r.placement.student.user.fullName,
    date: formatShortDateAr(r.date),
    checkIn: r.checkInAt ? formatTimeAr(r.checkInAt) : null,
    checkOut: r.checkOutAt ? formatTimeAr(r.checkOutAt) : null,
    workedMinutes: r.workedMinutes,
    distance: r.checkInDistance,
    status: r.status,
    isSuspicious: r.isSuspicious,
    riskFlags: r.riskFlags,
  }));

  return (
    <>
      <PageHeader title="المتدربون والحضور" description={profile?.organization.name} />

      <Card>
        <CardHeader>
          <CardTitle>اعتماد الحضور اليومي</CardTitle>
          <CardDescription>راجع سجلات التحضير الجغرافي واعتمدها؛ الساعات لا تُحتسب للطالب إلا بعد اعتمادك</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <AttendanceApprovals records={rows} flagLabels={RISK_FLAG_LABELS} />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <Card>
          <CardHeader><CardTitle>المتدربون ({placements.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>الطالب/ة</TH><TH>التخصص</TH><TH className="min-w-36">الساعات</TH><TH>الغياب</TH><TH>التقييم</TH></TR></THead>
              <TBody>
                {placements.map((p) => {
                  const ev = p.evaluations[0];
                  const hours = Math.round(p.approvedMinutes / 60);
                  return (
                    <TR key={p.id}>
                      <TD><div className="font-medium">{p.student.user.fullName}</div><div className="text-xs text-muted-foreground">{p.student.universityId}</div></TD>
                      <TD className="text-xs">{MAJOR_LABELS[p.student.major]}</TD>
                      <TD>
                        <div className="text-xs tabular-nums">{hours} / {p.requiredHours}</div>
                        <Progress value={(hours / p.requiredHours) * 100} className="h-1.5" />
                      </TD>
                      <TD><Badge variant={p._count.attendance >= 3 ? "destructive" : "muted"}>{p._count.attendance}</Badge></TD>
                      <TD>
                        <Link href={`/field-supervisor/evaluate/${p.id}`} className={buttonVariants({ size: "sm", variant: ev?.status === "DRAFT" || !ev ? "default" : "outline" })}>
                          {!ev ? "تقييم" : ev.status === "DRAFT" ? "إكمال التقييم" : "عرض التقييم"}
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>توجيه وإسناد مهام</CardTitle></CardHeader>
            <CardContent>
              <GuidanceForm students={placements.map((p) => ({ placementId: p.id, name: p.student.user.fullName }))} />
            </CardContent>
          </Card>
          {profile && (
            <Card>
              <CardHeader><CardTitle>الإشعارات</CardTitle></CardHeader>
              <CardContent>
                <ArrivalSmsSettings
                  initial={{ smsOnArrival: profile.smsOnArrival, phone: phoneIntl ? displaySaudiMobile(phoneIntl) : profile.user.phone ?? "", smsConfigured: smsConfigured() }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
