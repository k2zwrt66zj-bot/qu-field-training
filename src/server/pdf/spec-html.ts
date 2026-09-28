// يرسم أي نموذج من وصفه التصريحي (نفس وصف الواجهة) بتخطيط الجداول الرسمية للطباعة
import type { FieldSpec, FormSpec, Option } from "@/lib/forms/ui/types";
import { WEEKDAY_LABELS } from "@/lib/forms/catalog";
import { esc, mark, paras, pdfDay } from "./layout";

const BLOCK = new Set(["prose", "rows", "list", "multiChoice", "consent"]);
const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

/** قيمة حقل قصير داخل خلية جدول */
function inlineValue(f: FieldSpec, v: unknown, ctx: { caseStudies?: Option[] }): string {
  const w = f.widget;
  if (w.type === "yesNo") return `<span class="marks">${mark(v === true, w.yes)}${mark(v === false, w.no)}</span>`;
  if (w.type === "check") return `<span class="marks">${mark(v === true, w.text)}</span>`;
  if (isEmpty(v)) return `<span class="empty">—</span>`;
  switch (w.type) {
    case "date":
      return esc(pdfDay(String(v).slice(0, 10)));
    case "number":
      return `<span class="num">${esc(v)}${w.suffix ? ` ${esc(w.suffix)}` : ""}</span>`;
    case "choice":
      return `<span class="marks">${w.options.map((o) => mark(o.value === v, o.label)).join("")}</span>`;
    case "weekday":
      return esc(WEEKDAY_LABELS[v as number]);
    case "caseStudyRef":
      return esc(ctx.caseStudies?.find((o) => o.value === v)?.label ?? "دراسة حالة");
    case "text":
      return w.dir === "ltr" ? `<span class="ltr">${esc(v)}</span>` : esc(v);
    default:
      return esc(v);
  }
}

function blockValue(f: FieldSpec, v: unknown): string {
  const w = f.widget;
  switch (w.type) {
    case "prose":
      return `<div class="prose">${paras(v)}</div>`;
    case "list":
      return isEmpty(v) ? `<div class="prose"><p class="empty">—</p></div>` : `<div class="prose"><ol class="list">${(v as string[]).map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`;
    case "multiChoice":
      return `<div class="marks">${w.options.map((o) => mark(Array.isArray(v) && (v as string[]).includes(o.value), o.label)).join("")}</div>`;
    case "consent":
      return `<div class="marks">${mark(v === true, w.text)}</div>`;
    case "rows": {
      const rows = (v as Record<string, unknown>[] | null) ?? [];
      return `<table class="grid"><thead><tr><th style="width:28px">م</th>${w.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${
        rows.length
          ? rows.map((r, i) => `<tr><td class="num">${i + 1}</td>${w.columns.map((c) => `<td>${isEmpty(r[c.key]) ? "" : esc(r[c.key]).replace(/\n/g, "<br/>")}</td>`).join("")}</tr>`).join("")
          : `<tr><td colspan="${w.columns.length + 1}" class="empty">—</td></tr>`
      }</tbody></table>`;
    }
    default:
      return esc(v);
  }
}

export function renderSpecHtml(spec: FormSpec, data: Record<string, unknown>, ctx: { caseStudies?: Option[] } = {}): string {
  return spec.sections
    .map((section) => {
      const fields = section.fields.filter((f) => !f.when || f.when(data));
      if (!fields.length) return "";
      const out: string[] = [];
      let pending: FieldSpec[] = [];
      // الحقول القصيرة: جدول بعمودين (العنوان | القيمة) × 2 كما في الجداول الرسمية
      const flush = () => {
        if (!pending.length) return;
        const rows: string[] = [];
        for (let i = 0; i < pending.length; i += 2) {
          const pair = pending.slice(i, i + 2);
          rows.push(
            `<tr>${pair.map((f) => `<th class="light">${esc(f.label)}</th><td${pair.length === 1 ? ' colspan="3"' : ""}>${inlineValue(f, data[f.key], ctx)}</td>`).join("")}</tr>`
          );
        }
        out.push(`<table class="grid">${rows.join("")}</table>`);
        pending = [];
      };
      for (const f of fields) {
        if (BLOCK.has(f.widget.type) || (f.wide && f.widget.type !== "choice" && f.widget.type !== "yesNo")) {
          flush();
          out.push(`<div class="field">${f.widget.type === "consent" ? "" : `<div class="lbl">${esc(f.label)}</div>`}${BLOCK.has(f.widget.type) ? blockValue(f, data[f.key]) : `<div class="prose">${inlineValue(f, data[f.key], ctx)}</div>`}</div>`);
        } else pending.push(f);
      }
      flush();
      return `<section><h2 class="sec">${esc(section.title)}</h2>${section.description ? `<p class="desc">${esc(section.description)}</p>` : ""}${out.join("")}</section>`;
    })
    .join("");
}
