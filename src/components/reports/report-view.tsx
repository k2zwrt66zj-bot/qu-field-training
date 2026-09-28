import Image from "next/image";
import type { ReportTemplate } from "@prisma/client";
import { REPORT_TEMPLATES, type ReportContent } from "@/lib/report-templates";
import { INSTITUTION, MAJOR_LABELS } from "@/lib/labels";
import { formatDateAr } from "@/lib/time";

interface Props {
  template: ReportTemplate;
  title: string;
  content: ReportContent;
  student: { name: string; universityId: string; major: "SOCIOLOGY" | "SOCIAL_WORK" };
  organization: string;
  term: string;
  submittedAt: Date | null;
  signature?: { imageData: string; signer: string; signedAt: Date; contentHash: string } | null;
}

const fmtValue = (v: unknown, type?: string) => {
  if (v === true) return "✔ نعم";
  if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
  if (type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDateAr(`${v}T12:00:00Z`);
  return String(v);
};

/** عرض التقرير للقراءة والطباعة (A4) */
export function ReportView({ template, title, content, student, organization, term, submittedAt, signature }: Props) {
  const tpl = REPORT_TEMPLATES[template];
  return (
    <article className="report-print space-y-6 rounded-xl border bg-card p-6 text-sm leading-relaxed md:p-8">
      <header className="flex items-center justify-between gap-4 border-b-2 border-double border-qu-gold-500 pb-4">
        <div className="text-xs font-semibold leading-6 text-qu-green-700">
          {INSTITUTION.university}<br />{INSTITUTION.college}<br />{INSTITUTION.department}
        </div>
        <Image src="/brand/logo.svg" alt="" width={64} height={64} />
        <div className="text-left text-xs leading-6 text-muted-foreground">
          {INSTITUTION.unit}<br />{term}<br />{submittedAt ? `رُفع: ${formatDateAr(submittedAt)}` : "مسودة"}
        </div>
      </header>

      <div className="text-center">
        <div className="text-sm text-qu-gold-600">{tpl.title}</div>
        <h1 className="mt-1 text-xl font-bold text-qu-green-700">{title}</h1>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-muted/50 p-3 text-xs md:grid-cols-4">
        <div><dt className="text-muted-foreground">الطالب/ة</dt><dd className="font-medium">{student.name}</dd></div>
        <div><dt className="text-muted-foreground">الرقم الجامعي</dt><dd className="font-medium">{student.universityId}</dd></div>
        <div><dt className="text-muted-foreground">التخصص</dt><dd className="font-medium">{MAJOR_LABELS[student.major]}</dd></div>
        <div><dt className="text-muted-foreground">جهة التدريب</dt><dd className="font-medium">{organization}</dd></div>
      </dl>

      {tpl.sections.map((s, si) => (
        <section key={s.title} className="break-inside-avoid-page space-y-3">
          <h2 className="border-b pb-1 text-base font-bold text-qu-green-700"><span className="text-qu-gold-600">{si + 1}.</span> {s.title}</h2>
          <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            {s.fields.map((f) => {
              const v = content[f.key];
              if (f.type === "table") {
                const rows = (Array.isArray(v) ? v : []) as Record<string, unknown>[];
                return (
                  <div key={f.key} className="md:col-span-2">
                    <dt className="mb-1 font-semibold">{f.label}</dt>
                    <dd className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead><tr>{f.columns.map((c) => <th key={c.key} className="border bg-qu-green-50 p-1.5 text-start text-qu-green-800">{c.label}</th>)}</tr></thead>
                        <tbody>
                          {rows.length === 0 && <tr><td colSpan={f.columns.length} className="border p-2 text-center text-muted-foreground">—</td></tr>}
                          {rows.map((r, i) => <tr key={i}>{f.columns.map((c) => <td key={c.key} className="border p-1.5 align-top">{fmtValue(r[c.key], c.type)}</td>)}</tr>)}
                        </tbody>
                      </table>
                    </dd>
                  </div>
                );
              }
              const wide = f.type === "textarea" || f.type === "checkbox" || ("wide" in f && f.wide);
              return (
                <div key={f.key} className={wide ? "md:col-span-2" : ""}>
                  <dt className="font-semibold">{f.label}</dt>
                  <dd className="whitespace-pre-line text-foreground/80">{fmtValue(v, f.type)}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}

      {signature && (
        <footer className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
          <div className="text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">اعتماد المشرف الميداني: {signature.signer}</div>
            <div>بتاريخ {formatDateAr(signature.signedAt)}</div>
            <div dir="ltr" className="mt-1 break-all text-right font-mono text-[10px]">SHA-256: {signature.contentHash}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- صورة توقيع Data URL */}
          <img src={signature.imageData} alt={`توقيع ${signature.signer}`} className="h-16 rounded border bg-white p-1" />
        </footer>
      )}
    </article>
  );
}
