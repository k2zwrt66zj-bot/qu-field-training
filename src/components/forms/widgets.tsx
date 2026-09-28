"use client";
import { useEffect, useRef } from "react";
import { Check, Minus, Plus, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { countWords, looksLikeBulletList, type NarrativeRule } from "@/lib/forms/narrative";
import { WEEKDAY_LABELS } from "@/lib/forms/catalog";
import type { Column, Option } from "@/lib/forms/ui/types";
import { cn } from "@/lib/utils";

const inputCls = (invalid?: boolean) => (invalid ? "border-red-400 ring-1 ring-red-200" : "");

// ------------------------------------------------------------------ نص سردي
/** حقل سردي: يتمدد تلقائياً، يعدّ الكلمات، وينبّه لحظياً إن كُتب نقاطاً */
export function NarrativeField({ id, value, onChange, rule, rows = 4, placeholder, invalid }: {
  id: string; value: string; onChange: (v: string) => void; rule?: NarrativeRule; rows?: number; placeholder?: string; invalid?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, rows * 24 + 16)}px`;
  }, [value, rows]);
  const words = countWords(value);
  const bullets = rule?.noBullets && looksLikeBulletList(value);
  return (
    <div className="space-y-1">
      <textarea
        ref={ref}
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={cn("w-full resize-none overflow-hidden rounded-md border border-input bg-card px-3 py-2 text-sm leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", inputCls(invalid))}
      />
      {(rule || bullets) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {bullets ? (
            <span className="flex items-center gap-1 text-amber-700"><TriangleAlert className="size-3.5" /> يُكتب بأسلوب سردي علمي متصل وليس نقاطاً</span>
          ) : <span />}
          {rule && (
            <span className={cn("tabular-nums", words >= rule.minWords ? "text-emerald-700" : "text-muted-foreground")}>
              {words} / {rule.minWords} كلمة
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ قائمة نصوص
export function ListField({ id, value, onChange, max, addLabel = "إضافة", itemPlaceholder, invalid }: {
  id: string; value: string[]; onChange: (v: string[]) => void; max: number; addLabel?: string; itemPlaceholder?: string; invalid?: boolean;
}) {
  const items = value.length ? value : [""];
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <div className={cn("space-y-2 rounded-lg", invalid && "ring-1 ring-red-300")}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
          <Input
            id={i === 0 ? id : undefined}
            aria-label={`${addLabel} ${i + 1}`}
            value={item}
            placeholder={itemPlaceholder}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (items.length < max) onChange([...items, ""]);
              }
            }}
          />
          <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0 text-muted-foreground" disabled={items.length === 1 && !item} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`حذف ${i + 1}`}><X /></Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" disabled={items.length >= max} onClick={() => onChange([...items, ""])}><Plus /> {addLabel}</Button>
    </div>
  );
}

// ------------------------------------------------------------------ جدول صفوف
type Row = Record<string, string | number | null>;

export function RowsField({ id, value, onChange, columns, max, addLabel = "إضافة صف", fixedRows, invalid, label }: {
  id: string; value: Row[]; onChange: (v: Row[]) => void; columns: Column[]; max: number; addLabel?: string; fixedRows?: boolean; invalid?: boolean; label: string;
}) {
  const blank = (): Row => Object.fromEntries(columns.map((c) => [c.key, c.type === "number" ? null : ""]));
  const rows = value.length || fixedRows ? value : [blank()];
  const setCell = (i: number, key: string, v: string | number | null) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div id={id} className={cn("overflow-x-auto rounded-lg border", invalid && "border-red-400")}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-qu-navy-700 text-xs text-white">
          <tr>
            {!fixedRows && <th className="w-8 p-2 font-medium">م</th>}
            {columns.map((c) => <th key={c.key} className="p-2 text-start font-medium" style={{ width: c.width }}>{c.label}</th>)}
            {!fixedRows && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t align-top odd:bg-qu-gray-100/60">
              {!fixedRows && <td className="p-2 text-center text-xs text-muted-foreground">{i + 1}</td>}
              {columns.map((c) => (
                <td key={c.key} className="p-1">
                  {c.readOnly ? (
                    <div className="px-2 py-2 text-center font-semibold tabular-nums">{r[c.key]}</div>
                  ) : c.type === "prose" ? (
                    <textarea
                      aria-label={`${label} ${i + 1} ${c.label}`}
                      className="min-h-[38px] w-full resize-y rounded-md border border-input bg-card px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={2}
                      value={(r[c.key] as string) ?? ""}
                      onChange={(e) => setCell(i, c.key, e.target.value)}
                    />
                  ) : (
                    <Input
                      aria-label={`${label} ${i + 1} ${c.label}`}
                      className="h-9"
                      type={c.type}
                      value={r[c.key] == null ? "" : String(r[c.key])}
                      onChange={(e) => setCell(i, c.key, c.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                    />
                  )}
                </td>
              ))}
              {!fixedRows && (
                <td className="p-1">
                  <Button type="button" size="icon" variant="ghost" className="size-8 text-red-700" disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`حذف الصف ${i + 1}`}><X /></Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!fixedRows && (
        <div className="border-t p-2">
          <Button type="button" size="sm" variant="ghost" disabled={rows.length >= max} onClick={() => onChange([...rows, blank()])}><Plus /> {addLabel}</Button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ اختيار
export function ChoiceField({ id, value, onChange, options, layout = "inline", invalid, label }: {
  id: string; value: string | null; onChange: (v: string | null) => void; options: Option[]; layout?: "cards" | "inline"; invalid?: boolean; label: string;
}) {
  return (
    <div id={id} role="radiogroup" aria-label={label} className={cn(layout === "cards" ? "grid gap-2 md:grid-cols-3" : "flex flex-wrap gap-2", invalid && "rounded-lg ring-1 ring-red-300")}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : o.value)}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2 text-start text-sm transition-colors",
              on ? "border-qu-navy-700 bg-qu-navy-50 font-medium text-qu-navy-800" : "bg-card hover:bg-accent",
              layout === "cards" && "min-h-16"
            )}
          >
            <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-qu-navy-700 bg-qu-navy-700 text-white" : "border-input")}>
              {on && <Check className="size-3" />}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function MultiChoiceField({ id, value, onChange, options, invalid, label }: {
  id: string; value: string[]; onChange: (v: string[]) => void; options: Option[]; invalid?: boolean; label: string;
}) {
  return (
    <div id={id} role="group" aria-label={label} className={cn("grid gap-2", invalid && "rounded-lg ring-1 ring-red-300")}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <label key={o.value} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors", on ? "border-qu-navy-700 bg-qu-navy-50" : "bg-card hover:bg-accent")}>
            <input type="checkbox" className="mt-1 accent-[#0f486e]" checked={on} onChange={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])} />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/** خانة (√) ثنائية كما في جداول التقييم الرسمية: اختيار أحد الطرفين، والضغط مجدداً يلغي */
export function YesNoField({ id, value, onChange, yes, no, invalid, label }: {
  id: string; value: boolean | null; onChange: (v: boolean | null) => void; yes: string; no: string; invalid?: boolean; label: string;
}) {
  const btn = (v: boolean, text: string) => {
    const on = value === v;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => onChange(on ? null : v)}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors",
          on ? (v ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "text-muted-foreground hover:bg-accent"
        )}
      >
        {on ? (v ? <Check className="size-4" /> : <Minus className="size-4" />) : null}
        {text}
      </button>
    );
  };
  return (
    <div id={id} role="radiogroup" aria-label={label} className={cn("flex gap-1 rounded-lg border bg-card p-1", invalid && "border-red-400")}>
      {btn(true, yes)}
      {btn(false, no)}
    </div>
  );
}

export function CheckField({ id, value, onChange, text, invalid }: { id: string; value: boolean; onChange: (v: boolean) => void; text: string; invalid?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm", value && "border-qu-navy-700 bg-qu-navy-50", invalid && "border-red-400")}>
      <input id={id} type="checkbox" className="mt-1 accent-[#0f486e]" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {text}
    </label>
  );
}

export function WeekdayField({ id, value, onChange, invalid }: { id: string; value: number | null; onChange: (v: number | null) => void; invalid?: boolean }) {
  return (
    <div id={id} role="radiogroup" aria-label="يوم التدريب الثابت" className={cn("grid grid-cols-5 gap-1 rounded-lg border bg-card p-1", invalid && "border-red-400")}>
      {WEEKDAY_LABELS.slice(0, 5).map((d, i) => (
        <button key={d} type="button" role="radio" aria-checked={value === i} onClick={() => onChange(value === i ? null : i)}
          className={cn("rounded-md py-2 text-sm transition-colors", value === i ? "bg-qu-navy-700 font-semibold text-white" : "hover:bg-accent")}>
          {d}
        </button>
      ))}
    </div>
  );
}

export function RefSelect({ id, value, onChange, options }: { id: string; value: string | null; onChange: (v: string | null) => void; options: Option[] }) {
  return (
    <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— مقابلة مستقلة —</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
}
