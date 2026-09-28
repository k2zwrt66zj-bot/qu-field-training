import Link from "next/link";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { VisitForm } from "@/components/supervisor/visit-form";
import { GuidanceForm } from "@/components/supervisor/guidance-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateAr } from "@/lib/time";

export const metadata = { title: "طلابي" };
export const dynamic = "force-dynamic";

export default async function AcademicSupervisorPage() {
  const user = await requirePageRole("ACADEMIC_SUPERVISOR");
  const placements = await prisma.placement.findMany({
    where: { academicSupervisor: { userId: user.id }, status: { in: ["ASSIGNED", "ACTIVE", "COMPLETED"] } },
    include: {
      student: { include: { user: true } },
      organization: true,
      section: { select: { mode: true } },
      evaluations: true,
      visits: { orderBy: { visitDate: "desc" }, take: 1 },
      _count: {
        select: {
          attendance: { where: { status: "ABSENT" } },
          logbooks: { where: { status: { in: ["SUBMITTED", "SIGNED", "REVIEWED"] } } },
          // السجل الأسبوعي بعد التحول: «نموذج تسجيل المهارات والمعارف»
          forms: { where: { kind: "SKILLS_LOG", status: { in: ["SUBMITTED", "SIGNED", "REVIEWED"] } } },
          visits: true,
        },
      },
    },
    orderBy: { organization: { name: "asc" } },
  });
  const students = placements.map((p) => ({ placementId: p.id, name: p.student.user.fullName }));

  return (
    <>
      <PageHeader title="طلابي في التدريب الميداني" description={`${placements.length} طالب/طالبة`} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>الطالب/ة</TH><TH>جهة التدريب</TH><TH className="min-w-32">الساعات</TH><TH>الغياب</TH><TH>السجلات</TH><TH>الزيارات</TH><TH>الميداني</TH><TH>تقييمي</TH></TR>
            </THead>
            <TBody>
              {placements.map((p) => {
                const field = p.evaluations.find((e) => e.type === "FIELD" && e.status !== "DRAFT");
                const mine = p.evaluations.find((e) => e.type === "ACADEMIC");
                const hours = Math.round(p.approvedMinutes / 60);
                const sim = p.section?.mode === "SIMULATION";
                const na = <span className="text-xs text-muted-foreground">لا ينطبق</span>;
                return (
                  <TR key={p.id}>
                    <TD>
                      <div className="font-medium">{p.student.user.fullName}</div>
                      <div className="text-xs text-muted-foreground">{p.student.universityId}{sim && <Badge variant="teal" className="ms-2">محاكاة</Badge>}</div>
                    </TD>
                    <TD className="text-xs">{p.organization.name}</TD>
                    <TD>{sim ? na : <><div className="text-xs tabular-nums">{hours} / {p.requiredHours}</div><Progress value={(hours / p.requiredHours) * 100} className="h-1.5" /></>}</TD>
                    <TD>{sim ? na : <Badge variant={p._count.attendance >= 3 ? "destructive" : "muted"}>{p._count.attendance}</Badge>}</TD>
                    <TD className="tabular-nums">{p._count.logbooks + p._count.forms}</TD>
                    <TD className="text-xs">{p._count.visits}{p.visits[0] && <div className="text-muted-foreground">آخرها {formatDateAr(p.visits[0].visitDate)}</div>}</TD>
                    <TD>{sim ? na : field ? <Badge variant="success">{Number(field.percentage)}%</Badge> : <Badge variant="muted">لم يُرصد</Badge>}</TD>
                    <TD>
                      <Link href={`/academic-supervisor/evaluate/${p.id}`} className={buttonVariants({ size: "sm", variant: mine && mine.status !== "DRAFT" ? "outline" : "default" })}>
                        {!mine ? "رصد" : mine.status === "DRAFT" ? "إكمال" : `${Number(mine.percentage)}%`}
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>توثيق زيارة إشرافية</CardTitle></CardHeader><CardContent><VisitForm students={students} /></CardContent></Card>
        <Card><CardHeader><CardTitle>ملاحظة أو مهمة للطالب</CardTitle></CardHeader><CardContent><GuidanceForm students={students} /></CardContent></Card>
      </div>
    </>
  );
}
