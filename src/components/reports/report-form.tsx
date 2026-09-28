"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LoaderCircle, Plus, Save, Send, ShieldAlert, Trash2 } from "lucide-react";
import type { ReportTemplate } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { REPORT_TEMPLATES, completion, isEmptyValue, type Column, type Field, type ReportContent } from "@/lib/report-templates";
import { cn } from "@/lib/utils";

type Row = Record<string, string | number | null>;
const AUTOSAVE_MS = 60_000;

/**
 * نموذج تقرير ميداني يُولَّد بالكامل من تعريف القالب.
 * حفظ تلقائي كل دقيقة عند وجود تعديلات، وتحذير عند مغادرة الصفحة قبل الحفظ.
 */
export function ReportForm({ id, template, initialTitle, initialContent }: { id: string; template: ReportTemplate; initialTitle: string; initialContent: ReportContent }) {
  const router = useRouter();
  const tpl = REPORT_TEMPLATES[template];
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState<ReportContent>(initialContent);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<{ text: string; missing?: string[] } | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [pending, start] = useTransition();
  const saving = useRef(false);

  const progress = useMemo(() => completion(tpl, content), [tpl, content]);

  const setField = (key: string, value: unknown) => {
    setContent((c) => ({ ...c, [key]: value }));
    setDirty(true);
  };

  const persist = useCallback(
    async (submit: boolean) => {
      if (saving.current) return false;
      saving.current = true;
      setError(null);
      try {
        const res = await fetch(`/api/reports/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, submit }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError({ text: json.error, missing: json.details?.map((d: { message: string }) => d.message) });
          return false;
        }
        setDirty(false);
        setSavedAt(new Date());
        return true;
      } finally {
        saving.current = false;
      }
    },
    [id, title, content]
  );

  // حفظ تلقائي
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void persist(false), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, persist]);

  // تحذير قبل المغادرة
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const submit = () => {
    setShowMissing(true);
    if (progress.missing.length) {
      setError({ text: "أكمل الحقول الإلزامية قبل الرفع:", missing: progress.missing });
      return;
    }
    if (!confirm("بعد الرفع لن تتمكن من التعديل إلا إذا أعاده المشرف. متابعة؟")) return;
    start(async () => {
      if (await persist(true)) {
        router.push("/student/reports");
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {tpl.notice && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" /> {tpl.notice}
          </p>
        )}
        <Card>
          <CardContent className="space-y-1.5 p-5">
            <Label htmlFor="report-title">عنوان التقرير</Label>
            <Input id="report-title" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
          </CardContent>
        </Card>

        {tpl.sections.map((section, si) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle><span className="text-qu-teal-700">{si + 1}.</span> {section.title}</CardTitle>
              {section.description && <CardDescription>{section.description}</CardDescription>}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {section.fields.map((f) => (
                <FieldInput key={f.key} field={f} value={content[f.key]} onChange={(v) => setField(f.key, v)} invalid={showMissing && !!f.required && isEmptyValue(f, content[f.key])} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>{tpl.title}</CardTitle>
            <CardDescription>{tpl.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الحقول الإلزامية</span>
              <span className="font-semibold tabular-nums">{progress.done} / {progress.total}</span>
            </div>
            <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
            <p className="text-xs text-muted-foreground">
              {dirty ? "توجد تعديلات غير محفوظة (حفظ تلقائي كل دقيقة)" : savedAt ? `حُفظ ${savedAt.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}` : "لا تعديلات"}
            </p>
            {error && (
              <div role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                {error.text}
                {error.missing && <ul className="mt-1 list-inside list-disc text-xs">{error.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
              </div>
            )}
            <div className="grid gap-2">
              <Button variant="outline" disabled={pending || !dirty} onClick={() => start(async () => { await persist(false); })}>
                {pending ? <LoaderCircle className="animate-spin" /> : savedAt && !dirty ? <CircleCheck /> : <Save />} حفظ المسودة
              </Button>
              <Button disabled={pending} onClick={submit}><Send /> رفع للمشرف الميداني</Button>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function FieldInput({ field: f, value, onChange, invalid }: { field: Field; value: unknown; onChange: (v: unknown) => void; invalid: boolean }) {
  const id = `f-${f.key}`;
  const label = (
    <Label htmlFor={id} className={cn(invalid && "text-red-700")}>
      {f.label}{f.required && <span className="text-red-600"> *</span>}
    </Label>
  );
  const hint = f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>;
  const ring = invalid ? "border-red-400 ring-1 ring-red-300" : "";

  switch (f.type) {
    case "textarea":
      return (
        <div className="space-y-1.5 md:col-span-2">
          {label}
          <Textarea id={id} className={cn("min-h-28", ring)} placeholder={f.placeholder} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
          {hint}
        </div>
      );
    case "text":
    case "date":
      return (
        <div className={cn("space-y-1.5", f.wide && "md:col-span-2")}>
          {label}
          <Input id={id} type={f.type} className={ring} placeholder={f.type === "text" ? f.placeholder : undefined} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
          {hint}
        </div>
      );
    case "number":
      return (
        <div className="space-y-1.5">
          {label}
          <Input id={id} type="number" min={f.min} max={f.max} className={ring} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
          {hint}
        </div>
      );
    case "select":
      return (
        <div className="space-y-1.5">
          {label}
          <Select id={id} className={ring} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">— اختر —</option>
            {f.options.map((o) => <option key={o}>{o}</option>)}
          </Select>
          {hint}
        </div>
      );
    case "checkbox":
      return (
        <label className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm md:col-span-2", invalid && "border-red-400 bg-red-50")}>
          <input id={id} type="checkbox" className="mt-1" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span>{f.label}{f.required && <span className="text-red-600"> *</span>}</span>
        </label>
      );
    case "table":
      return (
        <div className="space-y-1.5 md:col-span-2">
          {label}
          {hint}
          <TableInput columns={f.columns} maxRows={f.maxRows ?? 50} rows={(value as Row[]) ?? []} onChange={onChange} invalid={invalid} fieldLabel={f.label} />
        </div>
      );
  }
}

function TableInput({ columns, rows, maxRows, onChange, invalid, fieldLabel }: { columns: Column[]; rows: Row[]; maxRows: number; onChange: (v: Row[]) => void; invalid: boolean; fieldLabel: string }) {
  const blank = (): Row => Object.fromEntries(columns.map((c) => [c.key, c.type === "number" ? null : ""]));
  const data = rows.length ? rows : [blank()];
  const setCell = (i: number, key: string, v: string | number | null) => onChange(data.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  return (
    <div className={cn("overflow-x-auto rounded-lg border", invalid && "border-red-400")}>
      <table className="w-full min-w-[600px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="w-8 p-2">#</th>
            {columns.map((c) => <th key={c.key} className="p-2 text-start" style={{ width: c.width }}>{c.label}</th>)}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2 text-center text-xs text-muted-foreground">{i + 1}</td>
              {columns.map((c) => (
                <td key={c.key} className="p-1">
                  {c.type === "select" ? (
                    <Select aria-label={`${fieldLabel} ${i + 1} ${c.label}`} value={(r[c.key] as string) ?? ""} onChange={(e) => setCell(i, c.key, e.target.value)} className="h-9">
                      <option value="">—</option>
                      {c.options!.map((o) => <option key={o}>{o}</option>)}
                    </Select>
                  ) : (
                    <Input
                      aria-label={`${fieldLabel} ${i + 1} ${c.label}`}
                      className="h-9"
                      type={c.type}
                      value={r[c.key] == null ? "" : String(r[c.key])}
                      onChange={(e) => setCell(i, c.key, c.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                    />
                  )}
                </td>
              ))}
              <td className="p-1">
                <Button type="button" size="icon" variant="ghost" className="size-8 text-red-700" disabled={data.length === 1} onClick={() => onChange(data.filter((_, j) => j !== i))} aria-label={`حذف الصف ${i + 1}`}><Trash2 /></Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t p-2">
        <Button type="button" size="sm" variant="ghost" disabled={data.length >= maxRows} onClick={() => onChange([...data, blank()])}><Plus /> إضافة صف</Button>
      </div>
    </div>
  );
}
