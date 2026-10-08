import type { Metadata } from "next";
import { Building2, GraduationCap, Mail, Phone, UserRound } from "lucide-react";
import type { PlacementStatus } from "@prisma/client";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerm } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PLACEMENT_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "المشرفون والمتدربون" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<PlacementStatus, "success" | "warning" | "muted" | "destructive" | "teal"> = {
  DRAFT: "muted", ASSIGNED: "warning", ACTIVE: "success", COMPLETED: "teal", WITHDRAWN: "destructive", SUSPENDED: "destructive",
};

const placementSelect = (termId: string) => ({
  where: { termId, status: { notIn: ["WITHDRAWN", "DRAFT"] as PlacementStatus[] } },
  select: {
    id: true,
    status: true,
    student: { select: { universityId: true, user: { select: { fullName: true } } } },
    organization: { select: { name: true } },
    section: { select: { mode: true } },
  },
  orderBy: { student: { universityId: "asc" as const } },
});

/** كل المشرفين الأكاديميين والمؤسسيين ومتدربيهم في الفصل الحالي (ومن لا متدربين له بعد) */
export default async function SupervisorsPage() {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();
  if (!term) return <p>لا يوجد فصل دراسي معرّف.</p>;

  const [academics, fieldSups] = await Promise.all([
    prisma.academicSupervisorProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: { select: { fullName: true, email: true, phone: true } }, placements: placementSelect(term.id) },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.fieldSupervisorProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: { select: { fullName: true, email: true, phone: true } }, organization: { select: { name: true } }, placements: placementSelect(term.id) },
      orderBy: [{ organization: { name: "asc" } }, { user: { fullName: "asc" } }],
    }),
  ]);
  const totalAcademic = academics.reduce((n, a) => n + a.placements.length, 0);

  const students = (list: (typeof academics)[number]["placements"], showOrg: boolean) =>
    list.length === 0 ? (
      <p className="py-3 text-center text-sm text-muted-foreground">لا يوجد متدربون مسندون بعد</p>
    ) : (
      <ul className="divide-y">
        {list.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium">{p.student.user.fullName}</div>
              <div className="text-xs text-muted-foreground">
                {p.student.universityId}
                {showOrg && ` · ${p.organization.name}`}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {p.section?.mode === "SIMULATION" && <Badge variant="teal">محاكاة</Badge>}
              <Badge variant={STATUS_VARIANT[p.status]}>{PLACEMENT_STATUS_LABELS[p.status]}</Badge>
            </div>
          </li>
        ))}
      </ul>
    );

  const contact = (u: { email: string; phone: string | null }) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1" dir="ltr"><Mail className="size-3" />{u.email}</span>
      {u.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="size-3" />{u.phone}</span>}
    </div>
  );

  return (
    <>
      <PageHeader title="المشرفون والمتدربون" description={`${term.name} · ${academics.length} مشرفاً أكاديمياً · ${fieldSups.length} مشرفاً مؤسسياً`} />

      <section aria-labelledby="academics" className="space-y-3">
        <h2 id="academics" className="flex items-center gap-2 text-lg font-bold text-qu-navy-700 dark:text-qu-navy-100">
          <GraduationCap className="size-5 text-qu-teal-700" /> المشرفون الأكاديميون
          <Badge variant="muted">{totalAcademic} متدرب/ة</Badge>
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-academics>
          {academics.map((a) => (
            <Card key={a.id} data-supervisor={a.user.email}>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2"><UserRound className="size-4 text-qu-teal-700" />{a.user.fullName}</CardTitle>
                  <Badge variant={a.placements.length > a.maxStudents ? "destructive" : "default"}>{a.placements.length} / {a.maxStudents}</Badge>
                </div>
                {a.academicRank && <CardDescription>{a.academicRank}</CardDescription>}
                {contact(a.user)}
              </CardHeader>
              <CardContent>{students(a.placements, true)}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="field-sups" className="mt-8 space-y-3">
        <h2 id="field-sups" className="flex items-center gap-2 text-lg font-bold text-qu-navy-700 dark:text-qu-navy-100">
          <Building2 className="size-5 text-qu-teal-700" /> المشرفون المؤسسيون
        </h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>المشرف/ة</TH><TH>جهة التدريب</TH><TH>التواصل</TH><TH className="min-w-64">المتدربون</TH></TR></THead>
              <TBody>
                {fieldSups.map((f) => (
                  <TR key={f.id} data-supervisor={f.user.email} className="align-top">
                    <TD><div className="font-medium">{f.user.fullName}</div>{f.jobTitle && <div className="text-xs text-muted-foreground">{f.jobTitle}</div>}</TD>
                    <TD className="text-sm">{f.organization.name}</TD>
                    <TD>{contact(f.user)}</TD>
                    <TD>{students(f.placements, false)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
