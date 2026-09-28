import Image from "next/image";
import Link from "next/link";
import type { FormKind } from "@prisma/client";
import {
  Archive, BookOpen, CalendarRange, ChevronLeft, CircleAlert, CircleCheck, ClipboardList, DoorOpen, Building2, Info, Landmark,
  MessagesSquare, NotebookPen, Users, Zap, MapPin,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { FormStatusBadge } from "@/components/forms/form-status-badge";
import { CreateFormButton, NewCustomForm } from "./create-form";
import type { NextStep, Portfolio, PortfolioFormItem } from "@/server/forms/portfolio";
import { INSTITUTION, MAJOR_LABELS, PLACEMENT_STATUS_LABELS } from "@/lib/labels";
import { LOGO } from "@/lib/brand";
import { formatDateAr, formatShortDateAr } from "@/lib/time";
import { cn } from "@/lib/utils";

const KIND_ICONS: Partial<Record<FormKind, React.ComponentType<{ className?: string }>>> = {
  COMMENCEMENT: DoorOpen,
  ORGANIZATION_PROFILE: Building2,
  TRAINING_PLAN: CalendarRange,
  SKILLS_LOG: NotebookPen,
  GROUP_PROGRAM: Users,
  COMMUNITY_PROGRAM: Landmark,
  QUICK_SITUATION: Zap,
  CASE_STUDY: ClipboardList,
  INTERVIEW: MessagesSquare,
  READING: BookOpen,
};

/** وصف مختصر لكل نموذج من أقسامه في الدليل الرسمي */
function kindHint(kind: FormKind, simulation: boolean): string {
  switch (kind) {
    case "COMMENCEMENT": return "اليوم الثابت والفترة والإقرار — يوقّعه المشرف المؤسسي ومدير المؤسسة مع الختم.";
    case "ORGANIZATION_PROFILE": return "ثمانية أقسام: البيانات الأولية، والإشراف، والأهداف، والهيكل التنظيمي، والخدمات، والعلاقات بالمجتمع، وأدوار الأخصائي، وملاحظاتك.";
    case "TRAINING_PLAN": return `المهام الأسبوعية والمسؤول عن أدائها — تُعدّ بالتشارك مع ${simulation ? "المشرف الأكاديمي" : "المشرف المؤسسي"}.`;
    case "SKILLS_LOG": return "لكل يوم تدريبي: الموضوعات، والمهارات والمعارف المكتسبة سرداً مهنياً، والصعوبات، والشواهد.";
    case "GROUP_PROGRAM": return "الجزء الإحصائي، والأهداف، والإعدادي، والقصصي، والتحليلي، والتقييم.";
    case "COMMUNITY_PROGRAM": return "الجزء الإحصائي، والأهداف، والتخطيطي، والتنفيذي، والتقييم.";
    case "QUICK_SITUATION": return "بالمدرسة أو بالمستشفى: بيانات الموقف، وملخصه، والإجراءات المهنية المتخذة.";
    case "CASE_STUDY": return "وفق خطوات التدخل المهني: التقدير، والتخطيط، والتدخل، والتقييم، والإنهاء، والمتابعة.";
    case "INTERVIEW": return "الأهداف، والمحتوى، والمهارات المستخدمة، والتخطيط للمقابلة القادمة، والتقييم — ويمكن ربطها بدراسة حالة.";
    case "READING": return "مصدر علمي موثّق وفق APA، والهدف من القراءة، والفوائد المهنية — تُرفع للمشرف الأكاديمي مباشرة.";
    default: return "";
  }
}

const STEP_STYLES: Record<NextStep["tone"], { box: string; icon: React.ComponentType<{ className?: string }> }> = {
  danger: { box: "border-red-200 bg-red-50 text-red-800", icon: CircleAlert },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: CircleAlert },
  info: { box: "border-qu-navy-100 bg-qu-navy-50 text-qu-navy-800", icon: Info },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CircleCheck },
};

function FormRow({ f }: { f: PortfolioFormItem }) {
  return (
    <Link
      href={`/forms/${f.id}`}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-qu-navy-200 hover:bg-qu-navy-50/50",
        f.awaitingMe && "border-amber-300 bg-amber-50/60"
      )}
    >
      <span className="min-w-[10rem] flex-1 font-medium text-qu-navy-800">{f.title}</span>
      <span className="text-xs text-muted-foreground">
        {f.submittedAt ? `رُفع ${formatShortDateAr(f.submittedAt)}` : `عُدّل ${formatShortDateAr(f.updatedAt)}`}
      </span>
      {f.academicScore != null && <Badge variant="success" className="tabular-nums">{f.academicScore}/100</Badge>}
      {f.awaitingMe && <Badge variant="warning">بانتظار إجرائك</Badge>}
      <FormStatusBadge status={f.status} fieldApproval={f.fieldApproval} />
      <ChevronLeft className="hidden size-4 text-muted-foreground sm:block" />
    </Link>
  );
}

export function PortfolioView({ p }: { p: Portfolio }) {
  const t = p.trainee;
  const simulation = p.mode === "SIMULATION";
  const s = p.summary;
  const traineeRows: [string, React.ReactNode][] = [
    ["اسم الطالب/ـة", t.name],
    ["الرقم الجامعي", <span key="u" className="tabular-nums">{t.universityId}</span>],
    ["التخصص", MAJOR_LABELS[t.major]],
    ["الفصل الدراسي", t.term],
    ["اسم المقرر", t.courseName ? `${t.courseName}${t.courseCode ? ` (${t.courseCode})` : ""}` : "—"],
    ["رقم الشعبة", t.sectionNumber ?? "—"],
    ["تدريب ميداني رقم", t.trainingNumber ?? "—"],
    ["المسار", t.track ?? "—"],
    [simulation ? "مقر التدريب" : "مؤسسة التدريب", t.organization],
    ...(simulation ? [] : ([["المشرف المؤسسي", t.fieldSupervisor ?? "—"]] as [string, React.ReactNode][])),
    ["المشرف الأكاديمي", t.academicSupervisor ?? "—"],
    ["مدة التدريب", `${formatShortDateAr(t.startDate)} — ${formatShortDateAr(t.endDate)}`],
  ];

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ الغلاف وبيانات المتدرب */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="portfolio-title">
        <div className="bg-qu-navy-800 px-5 py-6 text-white md:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <Image src={LOGO.emblem} alt="" width={52} height={52} className="rounded-xl bg-white p-1" />
            <div className="text-xs leading-5 text-white/80">
              <div className="font-semibold text-white">{INSTITUTION.university}</div>
              <div>{INSTITUTION.college}</div>
              <div>{INSTITUTION.department} — {INSTITUTION.unit}</div>
            </div>
            <div className="ms-auto flex flex-wrap gap-2">
              <Badge className="border-white/20 bg-white/10 text-white">{p.modeLabel}</Badge>
              <Badge className="border-white/20 bg-white/10 text-white">{PLACEMENT_STATUS_LABELS[t.status]}</Badge>
            </div>
          </div>
          <h1 id="portfolio-title" className="mt-5 text-2xl font-bold md:text-3xl">{p.coverTitle}</h1>
          <p className="mt-1 text-sm text-qu-teal-100">
            {t.name}
            {t.trainingNumber ? ` · تدريب ميداني رقم (${t.trainingNumber})` : ""}
            {t.sectionNumber ? ` · الشعبة ${t.sectionNumber}` : ""}
          </p>
        </div>
        <div className="h-1.5 bg-gradient-to-l from-qu-teal-400 via-qu-teal-600 to-qu-navy-500" aria-hidden />
        <div className="p-5 md:px-8">
          <h2 className="mb-3 text-sm font-semibold text-qu-navy-700">بيانات المتدرب/ـة</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {traineeRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-dashed pb-1.5">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="text-end font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {simulation && (
            <p className="mt-4 rounded-lg bg-qu-teal-50 p-3 text-xs leading-6 text-qu-teal-800">
              التدريب بالمحاكاة لا يتطلب مقر تدريب فعلياً: لا يوجد نموذج مباشرة ولا تقرير تعريفي بالمؤسسة ولا سجل حضور جغرافي، وتُرفع النماذج المهنية إلى المشرف الأكاديمي مباشرة.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ الملخص والخطوة التالية */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">حالة السجل</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>النماذج المعتمدة</span>
                <span className="tabular-nums">{s.approved} من {s.total}</span>
              </div>
              <Progress value={s.total ? (s.approved / s.total) * 100 : 0} indicatorClassName="bg-emerald-600" />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[
                { k: "معتمدة", v: s.approved, c: "text-emerald-700" },
                { k: "قيد المراجعة", v: s.inReview, c: "text-amber-700" },
                { k: "معادة للتعديل", v: s.returned, c: "text-red-700" },
                { k: "مسودات", v: s.drafts, c: "text-muted-foreground" },
              ].map((x) => (
                <div key={x.k} className="rounded-lg bg-qu-gray-100 p-2">
                  <dd className={cn("text-xl font-bold tabular-nums", x.c)}>{x.v}</dd>
                  <dt className="text-[11px] text-muted-foreground">{x.k}</dt>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{p.isStudent ? "الخطوة التالية" : "للمتابعة"}</CardTitle>
          </CardHeader>
          <CardContent>
            {p.steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا إجراءات معلّقة على هذا السجل.</p>
            ) : (
              <ul className="space-y-2" aria-label="الخطوات التالية">
                {p.steps.map((step, i) => {
                  const st = STEP_STYLES[step.tone];
                  const body = (
                    <>
                      <st.icon className="mt-0.5 size-4 shrink-0" />
                      <span className="flex-1 leading-6">{step.text}</span>
                      {step.href && <ChevronLeft className="mt-1 size-4 shrink-0 opacity-60" />}
                    </>
                  );
                  return (
                    <li key={i}>
                      {step.href ? (
                        <Link href={step.href} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-opacity hover:opacity-85", st.box)}>{body}</Link>
                      ) : (
                        <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", st.box)}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------ النماذج بترتيب الدليل */}
      <section aria-labelledby="forms-heading" className="space-y-3">
        <div>
          <h2 id="forms-heading" className="text-lg font-bold text-qu-navy-800">نماذج السجل المهني</h2>
          <p className="text-sm text-muted-foreground">بترتيب {INSTITUTION.formsEdition}</p>
        </div>
        <ol className="space-y-3">
          {p.groups.map((g, i) => {
            const Icon = KIND_ICONS[g.kind] ?? ClipboardList;
            const single = g.singleton ? g.forms[0] : undefined;
            return (
              <li key={g.kind}>
                <Card className="overflow-hidden" data-kind={g.kind}>
                  <div className="flex flex-wrap items-start gap-3 p-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-qu-navy-700 text-sm font-bold tabular-nums text-white">{i + 1}</span>
                    <div className="min-w-[12rem] flex-1">
                      <h3 className="flex items-center gap-2 font-semibold text-qu-navy-800">
                        <Icon className="size-4 text-qu-teal-700" /> {g.title}
                        {!g.singleton && g.forms.length > 0 && <Badge variant="muted" className="tabular-nums">{g.forms.length}</Badge>}
                        {g.forms.length === 0 && <span className="text-xs font-normal text-muted-foreground">· لا يوجد بعد</span>}
                      </h3>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{kindHint(g.kind, simulation)}</p>
                    </div>
                    {g.create && (
                      g.create.allowed ? (
                        <CreateFormButton kind={g.kind} domains={g.create.domains} label={g.singleton ? "إنشاء" : "جديد"} variant={g.singleton ? "default" : "outline"} />
                      ) : g.create.reason ? (
                        <span className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">{g.create.reason}</span>
                      ) : null
                    )}
                  </div>
                  {single ? (
                    <div className="border-t bg-qu-gray-50 px-4 py-3"><FormRow f={single} /></div>
                  ) : g.forms.length > 0 ? (
                    <div className="space-y-2 border-t bg-qu-gray-50 px-4 py-3">{g.forms.map((f) => <FormRow key={f.id} f={f} />)}</div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ------------------------------------------------ النماذج الإضافية */}
      {(p.templates.length > 0 || p.additional.length > 0) && (
        <section aria-labelledby="extra-heading" className="space-y-3">
          <div>
            <h2 id="extra-heading" className="text-lg font-bold text-qu-navy-800">نماذج إضافية</h2>
            <p className="text-sm text-muted-foreground">تقارير خارج الدليل الرسمي يعتمدها القسم (البحث الميداني، والمسح الاجتماعي، والتقرير الختامي).</p>
          </div>
          {p.templates.length > 0 && <NewCustomForm templates={p.templates} />}
          {p.additional.length > 0 && <div className="space-y-2">{p.additional.map((f) => <FormRow key={f.id} f={f} />)}</div>}
        </section>
      )}

      {/* ------------------------------------------------ سجل الحضور (الميداني فقط) */}
      {p.attendance && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><MapPin className="size-4 text-qu-teal-700" /> سجل الحضور والانصراف</CardTitle>
              <CardDescription>من التحضير الجغرافي اليومي</CardDescription>
            </div>
            {p.isStudent && <Link href="/student/attendance" className={buttonVariants({ variant: "outline", size: "sm" })}>التحضير</Link>}
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>الساعات المعتمدة</span>
                <span className="tabular-nums">{p.attendance.hours} من {p.attendance.requiredHours} ساعة</span>
              </div>
              <Progress value={(p.attendance.hours / p.attendance.requiredHours) * 100} />
            </div>
            <p className="text-sm text-muted-foreground">
              حضور <b className="tabular-nums text-foreground">{p.attendance.present}</b> يوماً (منها {p.attendance.late} تأخر) · غياب <b className="tabular-nums text-foreground">{p.attendance.absent}</b> · بعذر <b className="tabular-nums text-foreground">{p.attendance.excused}</b>
              {t.commencedAt && <> · تاريخ المباشرة {formatDateAr(t.commencedAt)}</>}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------ الأرشيف */}
      {p.archive.length > 0 && (
        <section aria-labelledby="archive-heading" className="space-y-3">
          <div>
            <h2 id="archive-heading" className="flex items-center gap-2 text-lg font-bold text-qu-navy-800"><Archive className="size-5 text-muted-foreground" /> الأرشيف</h2>
            <p className="text-sm text-muted-foreground">سجلات وتقارير من النظام السابق نُقلت كما هي بمحتواها وحالتها وتواقيعها. ما كان منها قيد المراجعة عند التحول يُستكمل اعتماده من هنا.</p>
          </div>
          <div className="space-y-2">
            {p.archive.map((f) => (
              <Link key={f.id} href={`/forms/${f.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-card px-3 py-2.5 text-sm hover:bg-qu-gray-50">
                <span className="min-w-[10rem] flex-1">{f.title}</span>
                <span className="text-xs text-muted-foreground">{f.templateTitle}</span>
                <FormStatusBadge status={f.status} fieldApproval={f.fieldApproval} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
