import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { LogbookForm } from "@/components/logbooks/logbook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateAr } from "@/lib/time";

export const metadata = { title: "السجلات الميدانية" };
export const dynamic = "force-dynamic";

const STATUS = {
  DRAFT: { l: "مسودة", v: "muted" }, SUBMITTED: { l: "بانتظار التوقيع", v: "warning" }, SIGNED: { l: "موقّع", v: "success" },
  RETURNED: { l: "معاد للتعديل", v: "destructive" }, REVIEWED: { l: "تمت المراجعة", v: "default" },
} as const;

export default async function StudentLogbooksPage() {
  const user = await requirePageRole("STUDENT");
  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  const logbooks = await prisma.logbook.findMany({
    where: { placement: { student: { userId: user.id } } },
    include: { signature: { include: { signer: true } } },
    orderBy: { periodStart: "desc" },
  });

  return (
    <>
      <PageHeader title="السجلات الميدانية" description="السجل اليومي والأسبوعي للتدريب" />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <LogbookForm major={profile?.major ?? "SOCIAL_WORK"} />
        <Card>
          <CardHeader><CardTitle>سجلاتي</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {logbooks.length === 0 && <p className="text-sm text-muted-foreground">لا توجد سجلات بعد</p>}
            {logbooks.map((l) => (
              <div key={l.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{l.type === "WEEKLY" ? `الأسبوع ${l.weekNumber ?? ""}` : "سجل يومي"}</span>
                  <Badge variant={STATUS[l.status].v}>{STATUS[l.status].l}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{formatDateAr(l.periodStart)}{l.type === "WEEKLY" && ` — ${formatDateAr(l.periodEnd)}`}</div>
                {l.fieldComment && <p className="mt-2 rounded bg-muted p-2 text-xs">ملاحظة المشرف: {l.fieldComment}</p>}
                {l.signature && <p className="mt-1 text-xs text-emerald-700">وقّعه {l.signature.signer.fullName} في {formatDateAr(l.signature.signedAt)}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
