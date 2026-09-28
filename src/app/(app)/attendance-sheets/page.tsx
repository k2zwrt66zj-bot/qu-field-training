import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listSheetDays, sheetOrganizations } from "@/server/attendance-sheets";
import { FIELD_MODE_ONLY } from "@/server/attendance";
import { WEEKDAY_LABELS } from "@/lib/forms/catalog";
import { cn } from "@/lib/utils";

export const metadata = { title: "كشوف الحضور اليومية" };
export const dynamic = "force-dynamic";

const arDate = (s: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`));

export default async function AttendanceSheetsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const user = await requirePageRole("FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR", "TRAINING_HEAD", "DEPARTMENT_HEAD");
  const scope = await sheetOrganizations(user);
  const organizations = await prisma.organization.findMany({
    where: { ...(scope === "ALL" ? {} : { id: { in: scope } }), placements: { some: { status: { in: ["ACTIVE", "COMPLETED"] }, ...FIELD_MODE_ONLY } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const { org } = await searchParams;
  const current = organizations.find((o) => o.id === org) ?? organizations[0];
  const { days } = current ? await listSheetDays(user, current.id) : { days: [] };
  const unsigned = days.filter((d) => !d.signed).length;

  return (
    <>
      <PageHeader
        title="سجل الحضور والانصراف اليومي"
        description={user.role === "FIELD_SUPERVISOR" ? "راجع كشف كل يوم ثم وقّعه؛ التوقيع يُقفل سجلات اليوم ويحفظ بصمتها الرقمية" : "كشوف الحضور اليومية الموقّعة من المشرفين المؤسسيين"}
      />
      {organizations.length > 1 && (
        <nav aria-label="المؤسسة" className="mb-4 flex flex-wrap gap-2">
          {organizations.map((o) => (
            <Link key={o.id} href={`/attendance-sheets?org=${o.id}`} className={cn("rounded-full border px-3 py-1 text-xs", o.id === current?.id ? "border-qu-navy-700 bg-qu-navy-700 text-white" : "bg-card hover:bg-qu-navy-50")}>{o.name}</Link>
          ))}
        </nav>
      )}
      {!current ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد مؤسسات تدريب ميداني ضمن نطاقك.</CardContent></Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
            <div className="font-semibold text-qu-navy-800">{current.name}</div>
            {unsigned > 0 && <Badge variant="warning">{unsigned} كشف لم يُوقَّع</Badge>}
          </div>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>اليوم</TH><TH>المتوقعون</TH><TH>الحضور</TH><TH>الغياب</TH><TH>بانتظار الاعتماد</TH><TH>الكشف</TH><TH /></TR></THead>
              <TBody>
                {days.length === 0 && <TR><TD colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد أيام تدريب بعد</TD></TR>}
                {days.map((d) => (
                  <TR key={d.date} data-day={d.date}>
                    <TD className="whitespace-nowrap">{WEEKDAY_LABELS[d.weekday]} {arDate(d.date)}</TD>
                    <TD className="tabular-nums">{d.expected}</TD>
                    <TD className="tabular-nums">{d.present}</TD>
                    <TD className="tabular-nums">{d.absent}</TD>
                    <TD className="tabular-nums">{d.pendingApproval || "—"}</TD>
                    <TD>{d.signed ? <Badge variant="success">موقّع</Badge> : <Badge variant="muted">لم يُوقَّع</Badge>}</TD>
                    <TD><Link href={`/attendance-sheets/${current.id}/${d.date}`} className="flex items-center gap-1 text-sm text-qu-teal-700 hover:underline">فتح الكشف <ChevronLeft className="size-4" /></Link></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
