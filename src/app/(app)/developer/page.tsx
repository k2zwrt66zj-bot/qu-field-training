import type { Metadata } from "next";
import { Building2, Cloud, CodeXml, Leaf, Mail, ShieldCheck, Target, TrendingUp, Workflow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEVELOPER, IP_NOTICE, developerContacts } from "@/lib/developer";
import { INSTITUTION } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "عن المنصة والمطور" };

// «© 2026» في سطر واحد (لا ينفصل الرمز عن السنة عند التفاف النص)
const [ipText, ipYear] = IP_NOTICE.split(/ (?=© )/);

const PILLARS = [
  { icon: Cloud, title: "حل سحابي", text: "يعمل من أي جهاز ومتصفح، ويُثبَّت على الجوال كتطبيق (PWA)." },
  { icon: Workflow, title: "أتمتة شاملة", text: "نماذج رسمية بمسارات اعتماد وتواقيع رقمية، وتحضير بالموقع الجغرافي." },
  { icon: Leaf, title: "استدامة", text: "سجلات ومستندات رقمية موثّقة تقلل الورق وتحفظ أثر كل دفعة." },
  { icon: TrendingUp, title: "كفاءة أكاديمية", text: "متابعة لحظية ومؤشرات أداء تدعم قرار المشرفين والقسم." },
] as const;

/** شعار LinkedIn (لا يتوفر في lucide) */
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/** زر تواصل على خلفية البطاقة الكحلية؛ معطّل إذا لم تُضبط القناة بعد */
function ContactBadge({ href, external, icon, label, value }: { href: string | null; external?: boolean; icon: React.ReactNode; label: string; value: string }) {
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-qu-navy-700 [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[11px] text-white/60">{label}</span>
        <span className="block truncate text-sm font-medium" dir={href ? "ltr" : undefined}>{href ? value : "يُضاف قريباً"}</span>
      </span>
    </>
  );
  const cls = "flex min-w-0 items-center gap-3 rounded-full bg-white/10 py-1.5 pe-5 ps-1.5 text-white ring-1 ring-white/15 transition-colors";
  if (!href) return <span aria-disabled className={cn(cls, "cursor-not-allowed opacity-60")}>{body}</span>;
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(cls, "hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qu-teal-300")}
    >
      {body}
    </a>
  );
}

export default function DeveloperPage() {
  const contacts = developerContacts();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* البطاقة الشخصية */}
      <section className="relative overflow-hidden rounded-2xl bg-qu-navy-800 p-6 text-white shadow-sm sm:p-8">
        <div aria-hidden className="absolute -left-20 -top-20 size-72 rounded-full border-[36px] border-qu-teal-500/20" />
        <div aria-hidden className="absolute -bottom-16 left-40 size-40 rounded-full bg-qu-teal-500/10" />

        <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-start">
          <div className="relative shrink-0">
            <div className="grid size-24 place-items-center rounded-3xl bg-gradient-to-br from-qu-teal-600 to-qu-teal-800 text-4xl font-bold shadow-lg ring-4 ring-white/10">
              ع
            </div>
            <span className="absolute -bottom-2 -left-2 grid size-9 place-items-center rounded-xl bg-white text-qu-navy-700 shadow">
              <CodeXml className="size-5" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-qu-teal-300">عن المنصة والمطور</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{DEVELOPER.nameAr}</h1>
            <p className="mt-2 text-qu-teal-100">
              {DEVELOPER.titleAr} <span dir="ltr" className="inline-block">({DEVELOPER.titleEn})</span>
            </p>
            <p className="mt-1 text-sm text-white/60"><span dir="ltr">{DEVELOPER.nameEn}</span></p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ContactBadge href={contacts.email && `mailto:${contacts.email}`} icon={<Mail />} label="البريد الإلكتروني" value={contacts.email ?? ""} />
              <ContactBadge href={contacts.linkedin} external icon={<LinkedInIcon />} label="لينكدإن" value="LinkedIn" />
            </div>
          </div>
        </div>
      </section>

      {/* رؤية المنصة */}
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-qu-teal-50 text-qu-teal-700 dark:bg-qu-teal-800/40 dark:text-qu-teal-300">
            <Target className="size-5" />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-qu-navy-700 dark:text-qu-navy-100">رؤية المنصة</CardTitle>
            <CardDescription dir="ltr" className="text-end">Platform Vision</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="leading-8">
            منصة التدريب الميداني حلٌّ سحابي مبتكر ومستدام لأتمتة التدريب الميداني في قسم الاجتماع والخدمة الاجتماعية،
            ورفع كفاءة الأداء الأكاديمي: من توزيع الطلاب على جهات التدريب، إلى التحضير اليومي والسجل المهني والاجتماعات
            الإشرافية، وصولاً إلى التقييم واعتماد النتائج — في مكان واحد.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PILLARS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-xl border bg-qu-gray-50 p-4 dark:bg-muted/40">
                <Icon className="mt-0.5 size-5 shrink-0 text-qu-teal-700 dark:text-qu-teal-300" />
                <div>
                  <div className="text-sm font-semibold text-qu-navy-700 dark:text-qu-navy-100">{title}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="flex items-start gap-2 border-t pt-4 text-xs leading-6 text-muted-foreground">
            <Building2 className="mt-0.5 size-4 shrink-0" />
            {INSTITUTION.department} · {INSTITUTION.college} · {INSTITUTION.university}
          </p>
        </CardContent>
      </Card>

      {/* حقوق الملكية الفكرية */}
      <section aria-labelledby="ip-title" className="rounded-2xl border-2 border-qu-teal-500/40 bg-qu-teal-50 p-5 dark:bg-qu-teal-800/20 sm:p-6">
        <div className="flex gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-qu-navy-700 text-white">
            <ShieldCheck className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 id="ip-title" className="font-bold text-qu-navy-700 dark:text-qu-navy-100">حقوق الملكية الفكرية</h2>
            <p data-testid="ip-notice" className="mt-2 leading-8 text-qu-navy-900 dark:text-foreground">
              {ipText} <span className="whitespace-nowrap">{ipYear}</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
