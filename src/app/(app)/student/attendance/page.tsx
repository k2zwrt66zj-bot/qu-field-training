import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { GpsCheckIn } from "@/components/attendance/gps-check-in";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { APPROVAL_LABELS, ATTENDANCE_STATUS_LABELS } from "@/lib/labels";
import { formatShortDateAr, formatTimeAr } from "@/lib/time";

export const metadata = { title: "التحضير الميداني" };
export const dynamic = "force-dynamic";

export default async function StudentAttendancePage() {
  const user = await requirePageRole("STUDENT");
  const records = await prisma.attendanceRecord.findMany({
    where: { placement: { student: { userId: user.id } } },
    orderBy: { date: "desc" },
    take: 30,
  });

  return (
    <>
      <PageHeader title="التحضير الميداني" description="سجّل حضورك وانصرافك من داخل جهة التدريب" />
      <GpsCheckIn />
      <Card className="mt-4">
        <CardHeader><CardTitle>سجل الحضور</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>التاريخ</TH><TH>الحالة</TH><TH>الحضور</TH><TH>الانصراف</TH><TH>المدة</TH><TH>الاعتماد</TH></TR></THead>
            <TBody>
              {records.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{formatShortDateAr(r.date)}</TD>
                  <TD><Badge variant={r.status === "ABSENT" ? "destructive" : r.status === "LATE" ? "warning" : r.status === "PRESENT" ? "success" : "muted"}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge></TD>
                  <TD className="whitespace-nowrap tabular-nums">{r.checkInAt ? formatTimeAr(r.checkInAt) : "—"}</TD>
                  <TD className="whitespace-nowrap tabular-nums">{r.checkOutAt ? formatTimeAr(r.checkOutAt) : "—"}</TD>
                  <TD className="whitespace-nowrap tabular-nums">{r.workedMinutes ? `${Math.floor(r.workedMinutes / 60)}:${String(r.workedMinutes % 60).padStart(2, "0")}` : "—"}</TD>
                  <TD><Badge variant={r.approvalStatus === "APPROVED" ? "success" : r.approvalStatus === "REJECTED" ? "destructive" : "muted"}>{APPROVAL_LABELS[r.approvalStatus]}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
