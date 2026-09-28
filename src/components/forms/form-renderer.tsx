"use client";
import { Check, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { FieldSpec, FormSpec, Option } from "@/lib/forms/ui/types";
import { WEEKDAY_LABELS } from "@/lib/forms/catalog";
import { cn } from "@/lib/utils";
import { CheckField, ChoiceField, ListField, MultiChoiceField, NarrativeField, RefSelect, RowsField, WeekdayField, YesNoField } from "./widgets";

export interface RenderContext {
  caseStudies?: Option[];
}

/**
 * يرسم أي نموذج من وصفه التصريحي — للتحرير أو للقراءة (readOnly) بنفس التخطيط.
 * issues: رسائل التحقق لكل حقل (من قواعد الرفع نفسها التي يطبقها الخادم).
 */
export function FormRenderer({ spec, data, onChange, readOnly, issues = {}, context = {} }: {
  spec: FormSpec;
  data: Record<string, unknown>;
  onChange?: (key: string, value: unknown) => void;
  readOnly?: boolean;
  issues?: Record<string, string[]>;
  context?: RenderContext;
}) {
  return (
    <div className="space-y-4">
      {spec.sections.map((section) => {
        const fields = section.fields.filter((f) => !f.when || f.when(data));
        if (!fields.length) return null;
        return (
          <Card key={section.id} id={`section-${section.id}`} className="scroll-mt-24 print:break-inside-avoid print:shadow-none">
            <CardHeader className="rounded-t-xl border-b bg-qu-navy-50/60 pb-3">
              <CardTitle className="text-qu-navy-800">{section.title}</CardTitle>
              {section.description && <CardDescription className="leading-6">{section.description}</CardDescription>}
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
              {fields.map((f) => (
                <FieldBlock key={f.key} field={f} value={data[f.key]} onChange={(v) => onChange?.(f.key, v)} readOnly={readOnly || f.widget.type === "readonly"} messages={issues[f.key]} context={context} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FieldBlock({ field: f, value, onChange, readOnly, messages, context }: {
  field: FieldSpec; value: unknown; onChange: (v: unknown) => void; readOnly?: boolean; messages?: string[]; context: RenderContext;
}) {
  const id = `f-${f.key}`;
  const invalid = !!messages?.length;
  const w = f.widget;
  const wide = f.wide || ["prose", "rows", "list", "multiChoice", "consent"].includes(w.type) && f.wide !== false;
  return (
    <div className={cn("space-y-1.5", wide && "md:col-span-2")} data-field={f.key}>
      {w.type !== "consent" && (
        <Label htmlFor={id} className={cn(invalid && "text-red-700")}>{f.label}</Label>
      )}
      {f.hint && !readOnly && <p className="text-xs leading-5 text-muted-foreground">{f.hint}</p>}
      {readOnly ? <ReadValue field={f} value={value} context={context} /> : <Editor id={id} field={f} value={value} onChange={onChange} invalid={invalid} context={context} />}
      {invalid && !readOnly && messages!.map((m) => <p key={m} className="text-xs text-red-700">{m}</p>)}
    </div>
  );
}

function Editor({ id, field: f, value, onChange, invalid, context }: { id: string; field: FieldSpec; value: unknown; onChange: (v: unknown) => void; invalid: boolean; context: RenderContext }) {
  const w = f.widget;
  switch (w.type) {
    case "text":
      return <Input id={id} dir={w.dir} value={(value as string) ?? ""} placeholder={w.placeholder} onChange={(e) => onChange(e.target.value)} className={cn(invalid && "border-red-400")} />;
    case "number":
      return (
        <div className="flex items-center gap-2">
          <Input id={id} type="number" min={w.min} max={w.max} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={cn(invalid && "border-red-400")} />
          {w.suffix && <span className="shrink-0 text-sm text-muted-foreground">{w.suffix}</span>}
        </div>
      );
    case "date":
      return <Input id={id} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cn(invalid && "border-red-400")} />;
    case "time":
      return <Input id={id} type="time" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cn(invalid && "border-red-400")} />;
    case "prose":
      return <NarrativeField id={id} value={(value as string) ?? ""} onChange={onChange} rule={w.rule} rows={w.rows} placeholder={w.placeholder} invalid={invalid} />;
    case "choice":
      return <ChoiceField id={id} label={f.label} value={(value as string) ?? null} onChange={onChange} options={w.options} layout={w.layout} invalid={invalid} />;
    case "multiChoice":
      return <MultiChoiceField id={id} label={f.label} value={(value as string[]) ?? []} onChange={onChange} options={w.options} invalid={invalid} />;
    case "yesNo":
      return <YesNoField id={id} label={f.label} value={(value as boolean | null) ?? null} onChange={onChange} yes={w.yes} no={w.no} invalid={invalid} />;
    case "check":
      return <CheckField id={id} value={value === true} onChange={onChange} text={w.text} invalid={invalid} />;
    case "consent":
      return (
        <div className={cn("rounded-lg border-2 border-dashed p-1", invalid ? "border-red-300" : "border-qu-teal-300")}>
          <CheckField id={id} value={value === true} onChange={onChange} text={w.text} invalid={invalid} />
        </div>
      );
    case "list":
      return <ListField id={id} value={(value as string[]) ?? []} onChange={onChange} max={w.max} addLabel={w.addLabel} itemPlaceholder={w.itemPlaceholder} invalid={invalid} />;
    case "rows":
      return <RowsField id={id} label={f.label} value={(value as Record<string, string | number | null>[]) ?? []} onChange={onChange} columns={w.columns} max={w.max} addLabel={w.addLabel} fixedRows={w.fixedRows} invalid={invalid} />;
    case "weekday":
      return <WeekdayField id={id} value={(value as number | null) ?? null} onChange={onChange} invalid={invalid} />;
    case "caseStudyRef":
      return <RefSelect id={id} value={(value as string) ?? null} onChange={onChange} options={context.caseStudies ?? []} />;
    case "readonly":
      return <ReadValue field={f} value={value} context={context} />;
  }
}

// ------------------------------------------------------------------ وضع القراءة / الطباعة
const empty = <span className="text-muted-foreground">—</span>;
const arDate = (s: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`));

export function ReadValue({ field: f, value, context }: { field: FieldSpec; value: unknown; context: RenderContext }) {
  const w = f.widget;
  const box = (children: React.ReactNode) => <div className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-7">{children}</div>;
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
    if (w.type === "check" || w.type === "consent") return <Marked on={false} text={w.text} />;
    return box(empty);
  }
  switch (w.type) {
    case "date":
      return box(arDate(value as string));
    case "prose":
      return box(<span className="whitespace-pre-line">{value as string}</span>);
    case "number":
      return box(<span className="tabular-nums">{String(value)}{w.suffix ? ` ${w.suffix}` : ""}</span>);
    case "choice":
      return box(w.options.find((o) => o.value === value)?.label ?? String(value));
    case "multiChoice":
      return <div className="space-y-1">{w.options.map((o) => <Marked key={o.value} on={(value as string[]).includes(o.value)} text={o.label} />)}</div>;
    case "yesNo":
      return (
        <div className="flex gap-2 text-sm">
          <Marked on={value === true} text={w.yes} />
          <Marked on={value === false} text={w.no} />
        </div>
      );
    case "check":
    case "consent":
      return <Marked on={value === true} text={w.text} />;
    case "weekday":
      return box(WEEKDAY_LABELS[value as number]);
    case "list":
      return box(<ol className="list-inside list-decimal space-y-0.5">{(value as string[]).map((x, i) => <li key={i}>{x}</li>)}</ol>);
    case "caseStudyRef":
      return box(context.caseStudies?.find((o) => o.value === value)?.label ?? "دراسة حالة");
    case "rows":
      return (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-qu-navy-700 text-xs text-white">
              <tr>{w.columns.map((c) => <th key={c.key} className="p-2 text-start font-medium">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {(value as Record<string, unknown>[]).map((r, i) => (
                <tr key={i} className="border-t align-top odd:bg-qu-gray-100/60">
                  {w.columns.map((c) => <td key={c.key} className="whitespace-pre-line p-2">{r[c.key] == null || r[c.key] === "" ? "—" : String(r[c.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return box(String(value));
  }
}

function Marked({ on, text }: { on: boolean; text: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-md px-2 py-1 text-sm", on ? "font-medium text-qu-navy-800" : "text-muted-foreground")}>
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-qu-navy-700 bg-qu-navy-700 text-white" : "border-input")}>
        {on ? <Check className="size-3" /> : <Minus className="size-3 opacity-30" />}
      </span>
      {text}
    </div>
  );
}
