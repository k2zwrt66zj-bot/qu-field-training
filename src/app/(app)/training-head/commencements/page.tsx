import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, FileDown, FilePen, FileText, Hourglass } from "lucide-react";
import type { DocumentStatus } from "@prisma/client";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerm } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormStatusBadge } from "@/components/forms/form-status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatShortDateAr } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "نماذج المباشرة" };
export const dynamic = "force-dynamic";

type Filter = "all" | "field" | "academic" | "approved" | "notSubmitted";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "field", label: "بانتظار توقيع المشرف المؤسسي" },
  { key: "academic", label: "بانتظار الاعتماد الأكاديمي" },
  { key: "approved", label: "معتمدة" },
  { key: "notSubmitted", label: "لم تُرفع بعد" },
];

/** المرحلة من حالة النموذج؛ المسودة لا يراها إلا الطالب فتُعامل كأنها لم تُرفع */
const stageOf = (status: DocumentStatus | undefined): Exclude<Filter, "all"> =>
  !status || status === "DRAFT" || status === "RETURNED" ? "notSubmitted"
  : status === "SUBMITTED" ? "field"
  : status === "SIGNED" ? "academic"
  : "approved";

/** كل نماذج مباشرة التدريب الميداني في الفصل الحالي: عرضها وتنزيلها ومتابعة من تنتظر */
export default async function CommencementsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();
  if (!term) return <p>لا يوجد فصل دراسي معرّف.</p>;
  const { filter: raw } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.key === raw) ? (raw as Filter) : "all";

  const placements = await prisma.placement.findMany({
    where: { termId: term.id, status: { notIn: ["WITHDRAWN", "DRAFT", "TRANSFERRED"] }, OR: [{ sectionId: null }, { section: { mode: "FIELD" } }] },
    select: {
      id: true,
      status: true,
      startDate: true,
      student: { select: { universityId: true, user: { select: { fullName: true } } } },
      organization: { select: { name: true } },
      academicSupervisor: { select: { user: { select: { fullName: true } } } },
      fieldSupervisor: { select: { user: { select: { fullName: true } } } },
      forms: {
        where: { kind: "COMMENCEMENT" },
        select: { id: true, status: true, submittedAt: true, updatedAt: true },
        orderBy: { sequence: "asc" },
        take: 1,
      },
    },
    orderBy: [{ startDate: "desc" }, { student: { universityId: "asc" } }],
  });

  const rows = placements.map((p) => ({ ...p, form: p.forms[0], stage: stageOf(p.forms[0]?.status) }));
  const count = (s: Filter) => rows.filter((r) => r.stage === s).length;
  const shown = filter === "all" ? rows : rows.filter((r) => r.stage === filter);

  return (
    <>
      <PageHeader title="نماذج المباشرة" description={`${term.name} · نموذج مباشرة التدريب لكل طالب/ـة: حالته، ومن ينتظره، وعرضه وتنزيله`} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="بانتظار توقيع المشرف المؤسسي" value={count("field")} icon={FilePen} tone={count("field") ? "warning" : "default"} />
        <StatCard label="بانتظار الاعتماد الأكاديمي" value={count("academic")} icon={Hourglass} tone="teal" />
        <StatCard label="معتمدة" value={count("approved")} icon={CircleCheck} tone="success" />
        <StatCard label="لم تُرفع بعد" value={count("notSubmitted")} icon={FileText} hint="المسودة تظهر بعد أن يرفعها الطالب" />
      </div>

      <nav aria-label="تصفية حسب الحالة" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/training-head/commencements" : `/training-head/commencements?filter=${f.key}`}
            className={cn("rounded-full border px-3 py-1 text-xs transition-colors", filter === f.key ? "border-qu-navy-700 bg-qu-navy-700 text-white" : "bg-card hover:bg-qu-navy-50")}
          >
            {f.label}
            <span className="ms-1 tabular-nums opacity-75">({f.key === "all" ? rows.length : count(f.key)})</span>
          </Link>
        ))}
      </nav>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>الطالب/ة</TH><TH>جهة التدريب</TH><TH>المشرفان</TH><TH>بداية التدريب</TH><TH>حالة نموذج المباشرة</TH><TH>آخر تحديث</TH><TH></TH></TR>
            </THead>
            <TBody>
              {shown.length === 0 && <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">لا توجد نماذج مباشرة بهذه الحالة</TD></TR>}
              {shown.map((r) => {
                // المسودة خاصة بالطالب حتى يرفعها
                const viewable = r.form && r.form.status !== "DRAFT";
                return (
                  <TR key={r.id} data-commencement={r.student.universityId}>
                    <TD>
                      <div className="font-medium">{r.student.user.fullName}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">{r.student.universityId}</div>
                    </TD>
                    <TD className="text-xs">{r.organization.name}</TD>
                    <TD className="text-xs leading-5">
                      <div><span className="text-muted-foreground">الأكاديمي: </span>{r.academicSupervisor?.user.fullName ?? "—"}</div>
                      <div><span className="text-muted-foreground">المؤسسي: </span>{r.fieldSupervisor?.user.fullName ?? "—"}</div>
                    </TD>
                    <TD className="whitespace-nowrap text-xs">{formatShortDateAr(r.startDate)}</TD>
                    <TD>
                      {!r.form ? <Badge variant="muted">لم يبدأ الطالب النموذج</Badge>
                        : r.form.status === "DRAFT" ? <Badge variant="muted">يعبّئه الطالب (مسودة)</Badge>
                        : <FormStatusBadge status={r.form.status} fieldApproval />}
                    </TD>
                    <TD className="whitespace-nowrap text-xs">{viewable ? formatShortDateAr(r.form!.updatedAt) : "—"}</TD>
                    <TD>
                      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 whitespace-nowrap text-xs">
                        {viewable && (
                          <>
                            <Link href={`/forms/${r.form!.id}`} className="font-medium text-qu-teal-700 hover:underline">عرض النموذج</Link>
                            <a href={`/api/forms/${r.form!.id}/pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-qu-navy-700 hover:underline"><FileDown className="size-3.5" />PDF</a>
                          </>
                        )}
                        <Link href={`/portfolio/${r.id}`} className="text-muted-foreground hover:underline">السجل المهني</Link>
                      </div>
                    </TD>
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
