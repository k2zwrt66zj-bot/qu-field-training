import Link from "next/link";
import { Award, CalendarCheck, CalendarX, Clock, MapPin } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { PreferencesForm } from "@/components/student/preferences-form";
import { MAJOR_LABELS, PLACEMENT_STATUS_LABELS } from "@/lib/labels";
import { LETTER_GRADE_AR } from "@/lib/grading/engine";
import { formatDateAr } from "@/lib/time";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const user = await requirePageRole("STUDENT");
  const placement = await prisma.placement.findFirst({
    where: { student: { userId: user.id } },
    orderBy: { startDate: "desc" },
    include: {
      student: true,
      organization: true,
      term: true,
      fieldSupervisor: { include: { user: true } },
      academicSupervisor: { include: { user: true } },
      evaluations: { where: { status: { not: "DRAFT" } } },
      finalGrade: true,
      tasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { dueDate: "asc" } },
      notes: { where: { isPrivate: false }, orderBy: { createdAt: "desc" }, take: 5, include: { author: true } },
    },
  });

  if (!placement) {
    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: user.id },
      include: { preferences: { orderBy: { rank: "asc" } } },
    });
    return (
      <>
        <PageHeader title={`مرحباً ${user.name}`} description="لم يتم توزيعك على جهة تدريب بعد" />
        <PreferencesForm
          initial={{
            city: profile.city,
            district: profile.district,
            hasLocation: profile.homeLat != null,
            categories: profile.preferences.map((p) => p.category ?? ""),
          }}
        />
      </>
    );
  }

  const counts = await prisma.attendanceRecord.groupBy({ by: ["status"], where: { placementId: placement.id }, _count: true });
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  const hours = Math.round((placement.approvedMinutes / 60) * 10) / 10;
  const field = placement.evaluations.find((e) => e.type === "FIELD");
  const academic = placement.evaluations.find((e) => e.type === "ACADEMIC");
  const grade = placement.finalGrade?.status === "PUBLISHED" ? placement.finalGrade : null;

  return (
    <>
      <PageHeader
        title={`مرحباً ${user.name}`}
        description={`${MAJOR_LABELS[placement.student.major]} · ${placement.term.name}`}
        actions={<Link href="/student/attendance" className={buttonVariants({ size: "lg" })}><MapPin /> التحضير الآن</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="الساعات المعتمدة" value={`${hours} / ${placement.requiredHours}`} icon={Clock} />
        <StatCard label="أيام الحضور" value={c("PRESENT") + c("LATE")} hint={`منها ${c("LATE")} تأخر`} icon={CalendarCheck} tone="success" />
        <StatCard label="أيام الغياب" value={c("ABSENT")} hint={`${c("EXCUSED")} بعذر`} icon={CalendarX} tone={c("ABSENT") >= 3 ? "danger" : "teal"} />
        <StatCard label="الدرجة النهائية" value={grade ? toNum(grade.total) : "—"} hint={grade ? `${grade.letterGrade} · ${LETTER_GRADE_AR[grade.letterGrade]}` : "تظهر بعد الاعتماد"} icon={Award} tone="teal" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{placement.organization.name}</CardTitle>
            <CardDescription>{formatDateAr(placement.startDate)} — {formatDateAr(placement.endDate)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">الحالة</span><Badge>{PLACEMENT_STATUS_LABELS[placement.status]}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">المشرف الميداني</span><span>{placement.fieldSupervisor?.user.fullName ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">المشرف الأكاديمي</span><span>{placement.academicSupervisor?.user.fullName ?? "—"}</span></div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>إنجاز الساعات</span><span>{Math.round((hours / placement.requiredHours) * 100)}%</span></div>
              <Progress value={(hours / placement.requiredHours) * 100} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>التقييمات</CardTitle><CardDescription>تظهر النسبة فور اعتماد المشرف للتقييم</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "تقييم المشرف الميداني", ev: field, weight: placement.term.fieldWeight },
              { label: "تقييم المشرف الأكاديمي", ev: academic, weight: placement.term.academicWeight },
            ].map(({ label, ev, weight }) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{label} <span className="text-xs text-muted-foreground">({weight}%)</span></span>
                  <span className="font-semibold">{ev ? `${toNum(ev.percentage)}%` : "لم يُرصد بعد"}</span>
                </div>
                <Progress value={ev ? toNum(ev.percentage) : 0} indicatorClassName="bg-secondary" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>المهام الميدانية</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {placement.tasks.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مهام مفتوحة</p>}
            {placement.tasks.map((t) => (
              <div key={t.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t.title}</span>
                  {t.dueDate && <Badge variant="muted">حتى {formatDateAr(t.dueDate)}</Badge>}
                </div>
                {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ملاحظات المشرفين</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {placement.notes.length === 0 && <p className="text-sm text-muted-foreground">لا توجد ملاحظات</p>}
            {placement.notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                <p>{n.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.author.fullName} · {formatDateAr(n.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
