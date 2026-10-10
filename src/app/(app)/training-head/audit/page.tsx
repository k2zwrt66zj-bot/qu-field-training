import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/labels";
import { formatShortDateAr, formatTimeAr } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "سجل التدقيق" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// وصف عربي موجز لكل إجراء مسجَّل
const ACTION_LABELS: Record<string, string> = {
  "auth.locked": "قفل حساب بعد محاولات دخول خاطئة",
  "account.password_change": "تغيير كلمة المرور",
  "attendance.check_in": "تحضير (حضور)",
  "attendance.check_out": "انصراف",
  "attendance.approved": "اعتماد حضور",
  "attendance.rejected": "رفض حضور",
  "attendance.manual": "تسجيل حضور يدوي",
  "attendance.sheet.sign": "توقيع كشف حضور",
  "sms.arrival": "رسالة وصول للمشرف المؤسسي",
  "supervisor.sms_preference": "تغيير إعداد رسالة الوصول",
  "form.create": "إنشاء نموذج",
  "form.submit": "رفع نموذج",
  "form.field_sign": "توقيع المشرف المؤسسي",
  "form.field_return": "إعادة من المشرف المؤسسي",
  "form.academic_approve": "اعتماد المشرف الأكاديمي",
  "form.academic_return": "إعادة من المشرف الأكاديمي",
  "attachment.upload": "رفع مرفق",
  "evaluation.submit": "إدخال تقييم",
  "grade.approve": "اعتماد نتيجة نهائية",
  "grade.calculate": "احتساب الدرجات",
  "letter.issue": "إصدار خطاب",
  "alert.resolve": "إغلاق تنبيه",
  "guidance.note": "ملاحظة توجيهية",
  "guidance.task": "إسناد مهمة",
  "visit.create": "تسجيل زيارة إشرافية",
  "preferences.save": "حفظ رغبات التدريب",
  "meeting.create": "إنشاء محضر اجتماع",
  "meeting.return": "إعادة محضر اجتماع",
  "meeting.delete": "حذف محضر اجتماع",
  "organization.create": "إضافة جهة تدريب",
  "organization.delete": "حذف جهة تدريب",
  "field_supervisor.create": "إضافة مشرف مؤسسي",
  "field_supervisor.update": "تعديل بيانات مشرف مؤسسي",
  "academic_supervisor.update": "تعديل بيانات مشرف أكاديمي",
  "placement.auto_assign": "توزيع تلقائي",
  "placement.transfer": "نقل الطالب إلى مقر تدريب آخر",
  "placement.section": "تعديل شعبة الطالب",
  "section.create": "إنشاء شعبة",
  "section.update": "تعديل شعبة",
  "criteria.update": "تعديل بنود التقييم",
  "term.update": "تعديل الفصل الدراسي",
};

// تصنيف لوني بحسب حساسية الإجراء
const TONE = (action: string): "destructive" | "warning" | "teal" | "muted" => {
  if (action === "auth.locked") return "destructive";
  if (action.startsWith("grade") || action === "letter.issue") return "teal";
  if (action.startsWith("attendance.approve") || action.startsWith("attendance.manual") || action === "attendance.rejected" || action.endsWith(".return") || action === "alert.resolve") return "warning";
  return "muted";
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageRole("TRAINING_HEAD");
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, action: true, entity: true, ipAddress: true, createdAt: true,
        actor: { select: { fullName: true, role: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="سجل التدقيق" description={`${total.toLocaleString("ar-SA")} عملية مسجّلة — الأحدث أولاً`} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>الوقت</TH><TH>المستخدم</TH><TH>الإجراء</TH><TH>العنصر</TH><TH>IP</TH></TR>
            </THead>
            <TBody>
              {rows.length === 0 && <TR><TD colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد عمليات مسجّلة</TD></TR>}
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{formatShortDateAr(r.createdAt)} · {formatTimeAr(r.createdAt)}</TD>
                  <TD className="text-sm">
                    {r.actor ? (
                      <>
                        <div className="font-medium">{r.actor.fullName}</div>
                        <div className="text-xs text-muted-foreground">{ROLE_LABELS[r.actor.role]}</div>
                      </>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TD>
                  <TD><Badge variant={TONE(r.action)}>{ACTION_LABELS[r.action] ?? r.action}</Badge></TD>
                  <TD className="text-xs text-muted-foreground">{r.entity}</TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted-foreground" dir="ltr">{r.ipAddress ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="تنقّل الصفحات">
          <PagerLink page={page - 1} disabled={page <= 1}><ChevronRight className="size-4" /> الأحدث</PagerLink>
          <span className="tabular-nums text-muted-foreground">صفحة {page} من {pages}</span>
          <PagerLink page={page + 1} disabled={page >= pages}>الأقدم <ChevronLeft className="size-4" /></PagerLink>
        </nav>
      )}
    </>
  );
}

function PagerLink({ page, disabled, children }: { page: number; disabled: boolean; children: React.ReactNode }) {
  const cls = "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5";
  if (disabled) return <span className={cn(cls, "cursor-not-allowed opacity-40")}>{children}</span>;
  return <Link href={`/training-head/audit?page=${page}`} className={cn(cls, "hover:bg-qu-navy-50")}>{children}</Link>;
}
