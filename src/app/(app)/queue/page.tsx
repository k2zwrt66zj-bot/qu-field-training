import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Clock3, Hourglass, Inbox, TriangleAlert, Users } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormStatusBadge } from "@/components/forms/form-status-badge";
import { loadQueueOverview, loadSupervisorQueue, QUEUE_SLA_DAYS, type QueueGroup, type QueueItem } from "@/server/forms/queue";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { listSheetDays } from "@/server/attendance-sheets";

export const metadata = { title: "قائمة الاعتماد" };
export const dynamic = "force-dynamic";

const ageText = (d: number) => (d === 0 ? "اليوم" : d === 1 ? "منذ يوم" : d === 2 ? "منذ يومين" : d <= 10 ? `منذ ${d} أيام` : `منذ ${d} يوماً`);

function GroupChips({ counts, active }: { counts: { group: QueueGroup; count: number; title: string }[]; active: QueueGroup | null }) {
  if (counts.length < 2 && !active) return null;
  const chip = (href: string, label: string, n: number | null, on: boolean) => (
    <Link key={href} href={href} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", on ? "border-qu-navy-700 bg-qu-navy-700 text-white" : "bg-card hover:bg-qu-navy-50")}>
      {label}{n != null && <span className="ms-1 tabular-nums opacity-75">({n})</span>}
    </Link>
  );
  return (
    <nav aria-label="تصفية حسب النموذج" className="mb-4 flex flex-wrap gap-2 print:hidden">
      {chip("/queue", "الكل", counts.reduce((s, c) => s + c.count, 0), !active)}
      {counts.map((c) => chip(`/queue?kind=${c.group}`, c.title, c.count, active === c.group))}
    </nav>
  );
}

function ItemRow({ it, showStudent }: { it: QueueItem; showStudent?: boolean }) {
  return (
    <Link href={`/forms/${it.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:border-qu-navy-200 hover:bg-qu-navy-50/50">
      <span className="min-w-[10rem] flex-1">
        <span className="font-medium text-qu-navy-800">{it.title}</span>
        {it.legacy && <Badge variant="muted" className="ms-2 align-middle">مرحّل</Badge>}
        {showStudent && <span className="block text-xs text-muted-foreground">{it.student} · {it.organization}</span>}
      </span>
      <span className={cn("flex items-center gap-1 text-xs tabular-nums", it.overdue ? "font-semibold text-red-700" : "text-muted-foreground")}>
        <Clock3 className="size-3.5" /> {ageText(it.ageDays)}
      </span>
      <FormStatusBadge status={it.status} fieldApproval={it.fieldApproval} />
      <ChevronLeft className="hidden size-4 text-muted-foreground sm:block" />
    </Link>
  );
}

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await requirePageRole();
  if (user.role === "STUDENT") redirect("/portfolio");
  const { kind } = await searchParams;

  if (user.role === "FIELD_SUPERVISOR" || user.role === "ACADEMIC_SUPERVISOR") {
    const q = await loadSupervisorQueue(user, kind);
    const field = user.role === "FIELD_SUPERVISOR";
    // أعمال المرحلة 4: محاضر اجتماعات بانتظار اعتماد رئيسها، وكشوف أيام لم تُوقَّع
    const [pendingMinutes, sheetDays] = await Promise.all([
      field ? [] : prisma.supervisionMeeting.findMany({
        where: { status: "SUBMITTED", academicSupervisor: { userId: user.id } },
        select: { id: true, number: true, organization: { select: { name: true } } },
        orderBy: { submittedAt: "asc" },
      }),
      field
        ? prisma.fieldSupervisorProfile.findUnique({ where: { userId: user.id }, select: { organizationId: true } })
            .then((fp) => (fp ? listSheetDays(user, fp.organizationId) : null))
        : null,
    ]);
    const unsignedDays = sheetDays?.days.filter((d) => !d.signed) ?? [];
    return (
      <>
        <PageHeader
          title="قائمة الاعتماد"
          description={field ? "نماذج رفعها المتدربون بانتظار توقيعك — الأقدم أولاً" : "نماذج بانتظار اعتمادك الأكاديمي (بعد توقيع المشرف المؤسسي، أو مباشرة للقراءات والمحاكاة) — الأقدم أولاً"}
        />
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="بانتظار إجرائك" value={q.stats.pending} icon={Inbox} tone={q.stats.pending ? "teal" : "success"} />
          <StatCard label={`متأخرة (> ${QUEUE_SLA_DAYS} أيام)`} value={q.stats.overdue} icon={TriangleAlert} tone={q.stats.overdue ? "danger" : "success"} />
          <StatCard label="أقدم نموذج" value={q.stats.pending ? ageText(q.stats.oldestDays) : "—"} icon={Hourglass} />
          <StatCard label="طلاب لديهم نماذج معلّقة" value={q.stats.students} icon={Users} />
        </div>
        {pendingMinutes.length > 0 && (
          <Card className="mb-4 border-amber-200" data-pending="minutes">
            <CardHeader className="pb-2"><CardTitle className="text-base">محاضر اجتماعات بانتظار اعتمادك ({pendingMinutes.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {pendingMinutes.map((m) => (
                <Link key={m.id} href={`/meetings/${m.id}`} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-qu-navy-50/50">الاجتماع رقم ({m.number}) — {m.organization.name}</Link>
              ))}
            </CardContent>
          </Card>
        )}
        {unsignedDays.length > 0 && sheetDays?.organization && (
          <Card className="mb-4 border-amber-200" data-pending="sheets">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span>كشوف حضور يومية لم تُوقَّع: <b className="tabular-nums">{unsignedDays.length}</b> يوم تدريب</span>
              <Link href={`/attendance-sheets/${sheetDays.organization.id}/${unsignedDays[unsignedDays.length - 1].date}`} className="text-qu-teal-700 hover:underline">توقيع الأقدم</Link>
            </CardContent>
          </Card>
        )}
        <GroupChips counts={q.groupCounts} active={q.group} />

        {q.groups.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد نماذج بانتظارك{q.group ? " من هذا النوع" : ""}.</CardContent></Card>
        ) : (
          <div className="space-y-3" aria-label="النماذج بانتظارك حسب الطالب">
            {q.groups.map((g) => (
              <Card key={g.placementId} data-student={g.universityId}>
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">{g.student}</CardTitle>
                    <CardDescription className="tabular-nums">{g.universityId} · {g.organization}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.simulation && <Badge variant="teal">محاكاة</Badge>}
                    <Badge variant="warning" className="tabular-nums">{g.items.length}</Badge>
                    <Link href={`/portfolio/${g.placementId}`} className="text-xs text-qu-teal-700 hover:underline">السجل المهني</Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">{g.items.map((it) => <ItemRow key={it.id} it={it} />)}</CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6">
          <CardHeader className="pb-3"><CardTitle className="text-base">سجلات طلابي</CardTitle><CardDescription>السجل المهني الكامل لكل متدرب/ـة</CardDescription></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {q.students.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد متدربون مسندون إليك.</p>}
            {q.students.map((s) => (
              <Link key={s.placementId} href={`/portfolio/${s.placementId}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-qu-navy-50/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.organization}</span>
                </span>
                {s.simulation && <Badge variant="teal">محاكاة</Badge>}
                {!!s.pending && <Badge variant="warning" className="tabular-nums">{s.pending}</Badge>}
                {!!s.returned && <Badge variant="destructive" className="tabular-nums" title="معادة للتعديل">{s.returned} معاد</Badge>}
              </Link>
            ))}
          </CardContent>
        </Card>
      </>
    );
  }

  // رئيس الوحدة / رئيس القسم / مدير النظام: نظرة الاختناقات
  const o = await loadQueueOverview(kind);
  const maxBucket = Math.max(1, ...o.buckets.map((b) => b.count));
  return (
    <>
      <PageHeader title="متابعة الاعتماد" description="أين تتأخر النماذج؟ ما ينتظر المشرفين المؤسسيين والأكاديميين، وأقدم المعلّق" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="بانتظار المشرف المؤسسي" value={o.stats.awaitingField} icon={Inbox} />
        <StatCard label="بانتظار المشرف الأكاديمي" value={o.stats.awaitingAcademic} icon={Inbox} tone="teal" />
        <StatCard label={`متأخرة (> ${QUEUE_SLA_DAYS} أيام)`} value={o.stats.overdue} icon={TriangleAlert} tone={o.stats.overdue ? "danger" : "success"} hint={o.stats.unassigned ? `${o.stats.unassigned} بلا مشرف مسند` : undefined} />
        <StatCard label="معادة للطلاب" value={o.stats.returned} icon={Hourglass} hint={`${o.stats.drafts} مسودة لم تُرفع`} />
      </div>
      <GroupChips counts={o.groupCounts} active={o.group} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">المعلّق حسب المشرف</CardTitle><CardDescription>مرتبة حسب أقدم نموذج</CardDescription></CardHeader>
          <CardContent>
            {o.supervisors.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد معلّق.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground"><tr className="border-b"><th className="p-2 text-start font-medium">المشرف</th><th className="p-2 text-start font-medium">المرحلة</th><th className="p-2 text-end font-medium">معلّق</th><th className="p-2 text-end font-medium">متأخر</th><th className="p-2 text-end font-medium">الأقدم</th></tr></thead>
                  <tbody>
                    {o.supervisors.map((s) => (
                      <tr key={`${s.stage}${s.name}`} className="border-b last:border-0">
                        <td className="p-2 font-medium">{s.name}</td>
                        <td className="p-2 text-xs text-muted-foreground">{s.stage === "FIELD" ? "توقيع مؤسسي" : "اعتماد أكاديمي"}</td>
                        <td className="p-2 text-end tabular-nums">{s.pending}</td>
                        <td className={cn("p-2 text-end tabular-nums", s.overdue && "font-semibold text-red-700")}>{s.overdue}</td>
                        <td className="p-2 text-end text-xs tabular-nums">{ageText(s.oldestDays)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">مدة الانتظار</CardTitle><CardDescription>عدد النماذج المعلّقة حسب عمرها</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {o.buckets.map((b, i) => (
              <div key={b.label} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="text-xs text-muted-foreground">{b.label}</span>
                <div className="h-3 rounded-full bg-qu-gray-100">
                  <div className={cn("h-3 rounded-full", i >= 2 ? "bg-red-600" : "bg-qu-navy-500")} style={{ width: `${(b.count / maxBucket) * 100}%` }} />
                </div>
                <span className="text-end tabular-nums">{b.count}</span>
              </div>
            ))}
            {o.byGroup.length > 0 && (
              <div className="border-t pt-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">حسب النموذج</div>
                <ul className="space-y-1.5 text-sm">
                  {o.byGroup.map((k) => (
                    <li key={k.group} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span>{k.title}</span>
                      <span className="flex gap-3 text-xs text-muted-foreground">
                        <span>توقيع مؤسسي <b className="tabular-nums text-foreground">{k.field}</b></span>
                        <span>اعتماد أكاديمي <b className="tabular-nums text-foreground">{k.academic}</b></span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3"><CardTitle className="text-base">أقدم النماذج المعلّقة</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {o.oldest.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد معلّق.</p>}
          {o.oldest.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1"><ItemRow it={it} showStudent /></div>
              <Link href={`/portfolio/${it.placementId}`} className="hidden shrink-0 text-xs text-qu-teal-700 hover:underline sm:block">السجل</Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
