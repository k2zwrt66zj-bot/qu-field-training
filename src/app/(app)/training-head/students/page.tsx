import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerm } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { AddStudent } from "@/components/students/add-student";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MAJOR_LABELS, PLACEMENT_STATUS_LABELS } from "@/lib/labels";
import { displaySaudiMobile, normalizeSaudiMobile } from "@/lib/sms-format";

export const metadata = { title: "الطلاب" };
export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();

  const students = await prisma.studentProfile.findMany({
    include: {
      user: { select: { fullName: true, phone: true, isActive: true } },
      placements: {
        where: { termId: term?.id ?? "__no_active_term__", status: { not: "TRANSFERRED" } },
        include: { organization: { select: { name: true } } },
        take: 1,
      },
    },
    orderBy: [{ user: { isActive: "desc" } }, { universityId: "asc" }],
  });

  const unplaced = term ? students.filter((s) => s.user.isActive && s.placements.length === 0).length : 0;

  return (
    <>
      <PageHeader
        title="الطلاب"
        description={`${students.length.toLocaleString("ar-SA")} طالباً/ة${term ? ` · ${unplaced.toLocaleString("ar-SA")} غير موزّع` : ""}`}
        actions={<AddStudent />}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>الطالب/ة</TH><TH>الرقم الجامعي</TH><TH>التخصص</TH><TH>الجوال</TH><TH>التوزيع الحالي</TH><TH>الحالة</TH></TR>
            </THead>
            <TBody>
              {students.length === 0 && <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">لا يوجد طلاب بعد — أضِف أول طالب من زر «إضافة طالب».</TD></TR>}
              {students.map((s) => {
                const p = s.placements[0];
                const phoneIntl = normalizeSaudiMobile(s.user.phone);
                return (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.user.fullName}</TD>
                    <TD className="tabular-nums" dir="ltr">{s.universityId}</TD>
                    <TD className="text-xs">{MAJOR_LABELS[s.major]} · {s.gender === "MALE" ? "طالب" : "طالبة"}</TD>
                    <TD className="tabular-nums text-xs" dir="ltr">{phoneIntl ? displaySaudiMobile(phoneIntl) : s.user.phone ?? "—"}</TD>
                    <TD className="text-xs">
                      {p ? <><span className="font-medium">{p.organization.name}</span> <Badge variant="muted">{PLACEMENT_STATUS_LABELS[p.status]}</Badge></> : <span className="text-muted-foreground">غير موزّع</span>}
                    </TD>
                    <TD>{s.user.isActive ? <Badge variant="success">نشط</Badge> : <Badge variant="muted">موقوف</Badge>}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
