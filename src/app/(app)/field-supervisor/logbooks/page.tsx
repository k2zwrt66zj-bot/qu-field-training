import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { LogbookSigning } from "@/components/supervisor/logbook-signing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateAr } from "@/lib/time";

export const metadata = { title: "السجلات بانتظار التوقيع" };
export const dynamic = "force-dynamic";

const FIELDS = [
  ["activities", "الأنشطة المنفذة"],
  ["skills", "المهارات المكتسبة"],
  ["challenges", "الصعوبات"],
  ["reflections", "التأمل المهني"],
  ["plannedNext", "خطة الفترة القادمة"],
] as const;

export default async function FieldLogbooksPage() {
  const user = await requirePageRole("FIELD_SUPERVISOR");
  const logbooks = await prisma.logbook.findMany({
    where: { status: "SUBMITTED", placement: { fieldSupervisor: { userId: user.id } } },
    include: { placement: { include: { student: { include: { user: true } } } } },
    orderBy: { submittedAt: "asc" },
  });

  return (
    <>
      <PageHeader title="السجلات بانتظار التوقيع" description="راجع سجلات المتدربين ووقّعها إلكترونياً؛ يُحفظ مع التوقيع بصمة رقمية للمحتوى تمنع تعديله لاحقاً" />
      {logbooks.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد سجلات بانتظار التوقيع</CardContent></Card>}
      <div className="space-y-4">
        {logbooks.map((l) => (
          <Card key={l.id}>
            <CardHeader>
              <CardTitle>{l.placement.student.user.fullName} — {l.type === "WEEKLY" ? `السجل الأسبوعي ${l.weekNumber ?? ""}` : "سجل يومي"}</CardTitle>
              <CardDescription>{formatDateAr(l.periodStart)}{l.type === "WEEKLY" && ` — ${formatDateAr(l.periodEnd)}`}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <dl className="space-y-3 text-sm">
                {FIELDS.filter(([k]) => l[k]).map(([k, label]) => (
                  <div key={k}><dt className="font-semibold text-qu-green-700">{label}</dt><dd className="whitespace-pre-line text-muted-foreground">{l[k]}</dd></div>
                ))}
              </dl>
              <LogbookSigning id={l.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
