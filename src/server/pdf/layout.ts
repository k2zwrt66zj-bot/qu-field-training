// =====================================================================
//  الإطار الرسمي لمستندات PDF: ترويسة «نماذج التدريب الميداني» (عربي | الشعار | إنجليزي)
//  تتكرر في كل صفحة (thead)، وتذييل يحمل هوية المستند وبصمته ورمز التحقق (tfoot)
// =====================================================================
import QRCode from "qrcode";
import type { SignatureSlot } from "@prisma/client";
import { BRAND } from "@/lib/brand";
import { INSTITUTION } from "@/lib/labels";
import { SLOT_LABELS } from "@/lib/forms/catalog";
import { embeddedFonts, logoDataUri } from "./engine";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** نص سردي بفقرات (بلا HTML من المستخدم) */
export const paras = (s: unknown) =>
  String(s ?? "").trim() ? String(s).trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`).join("") : `<p class="empty">—</p>`;

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", ...opts });
export const pdfDate = (d: Date | string | null | undefined) => (d ? fmt({ day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : "—");
export const pdfDateTime = (d: Date | string | null | undefined) => (d ? fmt({ day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—");
export const pdfDay = (s: string | null | undefined) => (s ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`)) : "—");

export const CSS = `
  @page { size: A4; margin: 10mm 12mm 14mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: ${BRAND.ink}; font-family: "Amiri", serif; font-size: 13pt; line-height: 1.75; background: #fff; }
  .sans, table, .meta, .sig, .badge, footer { font-family: "IBM Plex Sans Arabic", sans-serif; }
  table.frame { width: 100%; border-collapse: collapse; }
  table.frame > thead > tr > td, table.frame > tfoot > tr > td, table.frame > tbody > tr > td { padding: 0; border: 0; }
  .doc + .doc { break-before: page; }
  .hdr { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; padding-bottom: 6px; border-bottom: 3px double ${BRAND.teal}; margin-bottom: 10px; }
  .hdr .ar { font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 8.6pt; line-height: 1.6; color: ${BRAND.navy}; font-weight: 600; }
  .hdr .en { font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 8pt; line-height: 1.6; color: ${BRAND.navy}; direction: ltr; text-align: left; }
  .hdr img { height: 52px; }
  .ftr { margin-top: 10px; border-top: 1px solid ${BRAND.teal}; padding-top: 4px; display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 7.5pt; color: #4a4f57; font-family: "IBM Plex Sans Arabic", sans-serif; }
  .ftr img { width: 46px; height: 46px; }
  .ftr code { direction: ltr; unicode-bidi: isolate; font-size: 7pt; }
  h1.title { text-align: center; color: ${BRAND.navy}; font-size: 17pt; margin: 4px 0 2px; }
  .subtitle { text-align: center; color: ${BRAND.tealText}; font-size: 10pt; margin-bottom: 8px; font-family: "IBM Plex Sans Arabic", sans-serif; }
  h2.sec { font-size: 12.5pt; color: ${BRAND.navy}; margin: 12px 0 5px; padding: 3px 8px; background: ${BRAND.cellGray}; border-inline-start: 4px solid ${BRAND.navy}; break-after: avoid; }
  .desc { font-size: 10pt; color: #4a4f57; margin: 0 0 6px; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 9.6pt; line-height: 1.6; margin: 4px 0 8px; }
  table.grid th, table.grid td { border: 1px solid #b9bec5; padding: 4px 7px; vertical-align: top; text-align: start; }
  table.grid th { background: ${BRAND.navy}; color: #fff; font-weight: 600; }
  table.grid th.light { background: ${BRAND.cellGray}; color: ${BRAND.navy}; width: 26%; }
  table.grid tr { break-inside: avoid; }
  .field { margin: 4px 0 8px; break-inside: avoid-page; }
  .field .lbl { font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 9.6pt; font-weight: 600; color: ${BRAND.navy}; }
  .prose { border: 1px solid #d5d9de; border-radius: 3px; padding: 4px 10px; min-height: 2.2em; text-align: justify; }
  .prose p { margin: 0 0 6px; }
  .empty { color: #9aa0a8; }
  .marks { display: flex; flex-wrap: wrap; gap: 4px 14px; font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 9.6pt; }
  .box { display: inline-block; width: 11px; height: 11px; border: 1.3px solid ${BRAND.navy}; vertical-align: -1px; margin-inline-end: 4px; position: relative; }
  .box.on { background: ${BRAND.navy}; }
  .box.on::after { content: ""; position: absolute; inset: 1px 3px 3px; border: solid #fff; border-width: 0 1.6px 1.6px 0; transform: rotate(40deg); }
  ol.list { margin: 0; padding-inline-start: 22px; }
  .sigs { display: grid; gap: 8px; margin-top: 12px; break-inside: avoid; }
  .sig { border: 1px solid #b9bec5; border-radius: 4px; padding: 6px; text-align: center; font-size: 9pt; min-height: 118px; position: relative; }
  .sig .role { color: ${BRAND.navy}; font-weight: 600; }
  .sig .img { height: 52px; display: flex; align-items: center; justify-content: center; }
  .sig .img img { max-height: 52px; max-width: 90%; }
  .sig .blank { height: 52px; border-bottom: 1px dotted #7b8088; margin: 0 14%; }
  .sig .name { font-weight: 600; }
  .sig .when { color: #5f656d; font-size: 7.8pt; }
  .stamp { position: absolute; inset-inline-start: 6px; top: 22px; width: 64px; height: 64px; border-radius: 50%; border: 1.5px dashed #9aa0a8; color: #9aa0a8; font-size: 7.5pt; display: flex; align-items: center; justify-content: center; }
  .stamp img { width: 64px; height: 64px; object-fit: contain; opacity: .9; }
  .stamp.has { border: 0; }
  .meta { width: 100%; border-collapse: collapse; font-size: 9.3pt; margin-bottom: 6px; }
  .meta th, .meta td { border: 1px solid #b9bec5; padding: 3px 7px; text-align: start; }
  .meta th { background: ${BRAND.cellGray}; color: ${BRAND.navy}; font-weight: 600; white-space: nowrap; }
  .badge { display: inline-block; font-size: 8pt; padding: 0 8px; border-radius: 10px; background: ${BRAND.cellGray}; color: ${BRAND.navy}; border: 1px solid #c9ccd1; }
  .badge.ok { background: #e6f5ee; color: #166534; border-color: #a7dcc0; }
  .badge.warn { background: #fdf3dc; color: #8a5a00; border-color: #efd28f; }
  .badge.bad { background: #fde8e8; color: #9b1c1c; border-color: #f2b8b8; }
  .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .photos figure { margin: 0; border: 1px solid #d5d9de; padding: 3px; break-inside: avoid; }
  .photos img { width: 100%; height: 120px; object-fit: cover; }
  .photos figcaption { font-size: 7.5pt; text-align: center; font-family: "IBM Plex Sans Arabic", sans-serif; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .num { font-variant-numeric: tabular-nums; }
  .cover { height: 205mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; }
  .cover img.logo { height: 110px; }
  .cover h1 { font-size: 30pt; color: ${BRAND.navy}; margin: 18px 0 4px; }
  .cover .band { width: 70%; height: 6px; background: linear-gradient(90deg, ${BRAND.navy}, ${BRAND.tealDeep}, ${BRAND.teal}); border-radius: 3px; }
  .cover table { width: 78%; margin-top: 16px; }
  .toc li { font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 10.5pt; }
`;

export interface DocPart {
  /** HTML محتوى المستند (بلا ترويسة) */
  body: string;
  /** وصف المستند في التذييل */
  label: string;
  /** بصمة المحتوى (تُطبع مختصرة) */
  hash?: string | null;
  /** رابط التحقق (يُطبع رمز QR) */
  verifyUrl?: string | null;
}

async function header(): Promise<string> {
  const logo = await logoDataUri();
  const i = INSTITUTION;
  return `<div class="hdr">
    <div class="ar">${[i.country, i.ministry, i.university, i.college, i.department].map(esc).join("<br/>")}</div>
    <img src="${logo}" alt="شعار جامعة القصيم"/>
    <div class="en">${[i.en.country, i.en.ministry, i.en.university, i.en.college, i.en.department].map(esc).join("<br/>")}</div>
  </div>`;
}

async function footer(p: DocPart, generatedAt: Date): Promise<string> {
  const qr = p.verifyUrl ? await QRCode.toDataURL(p.verifyUrl, { margin: 0, width: 120, color: { dark: BRAND.navy } }) : null;
  return `<div class="ftr">
    <div>${esc(p.label)} — صادر إلكترونياً من منصة التدريب الميداني، ${esc(INSTITUTION.unit)} — ${pdfDateTime(generatedAt)}
      ${p.hash ? `<br/>بصمة المحتوى (SHA-256): <code>${esc(p.hash.slice(0, 32))}…</code>` : ""}
      ${p.verifyUrl ? `<br/>للتحقق من سلامة المستند امسح الرمز أو افتح: <code>${esc(p.verifyUrl)}</code>` : ""}</div>
    ${qr ? `<img src="${qr}" alt="رمز التحقق"/>` : ""}
  </div>`;
}

/** مستند HTML كامل: كل جزء يبدأ بصفحة جديدة وبترويسته وتذييله المتكررين */
export async function officialDocument(title: string, parts: DocPart[]): Promise<string> {
  const [fonts, hdr] = await Promise.all([embeddedFonts(), header()]);
  const now = new Date();
  const docs = await Promise.all(
    parts.map(async (p) => `<table class="frame doc"><thead><tr><td>${hdr}</td></tr></thead><tfoot><tr><td>${await footer(p, now)}</td></tr></tfoot><tbody><tr><td>${p.body}</td></tr></tbody></table>`)
  );
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${fonts}\n${CSS}</style></head><body>${docs.join("")}</body></html>`;
}

// ------------------------------------------------------------------ عناصر مشتركة

export const mark = (on: boolean, text: string) => `<span><span class="box${on ? " on" : ""}"></span>${esc(text)}</span>`;

export interface SigBox {
  role: string;
  name?: string | null;
  imageData?: string | null;
  signedAt?: Date | string | null;
  /** نص بديل لاعتماد إلكتروني بلا صورة توقيع */
  note?: string | null;
  /** مكان الختم: صورة الختم إن وُجدت، وإلا دائرة فارغة */
  stamp?: { image?: string | null } | null;
}

/** صف خانات التوقيع (وأماكن الختم) — الفارغة تُطبع خطاً منقطاً للتوقيع اليدوي */
export function signatureBoxes(boxes: SigBox[]): string {
  return `<div class="sigs" style="grid-template-columns: repeat(${Math.min(boxes.length, 4)}, 1fr)">${boxes
    .map((b) => {
      const signed = !!(b.imageData || b.note);
      return `<div class="sig">
        <div class="role">${esc(b.role)}</div>
        ${b.imageData ? `<div class="img"><img src="${b.imageData}" alt="توقيع"/></div>` : b.note ? `<div class="img"><span class="badge ok">${esc(b.note)}</span></div>` : `<div class="blank"></div>`}
        <div class="name">${esc(b.name ?? (signed ? "" : "الاسم: ...................."))}</div>
        <div class="when">${b.signedAt ? pdfDateTime(b.signedAt) : "التاريخ: ....../....../......"}</div>
        ${b.stamp ? `<div class="stamp${b.stamp.image ? " has" : ""}">${b.stamp.image ? `<img src="${b.stamp.image}" alt="ختم المؤسسة"/>` : "الختم"}</div>` : ""}
      </div>`;
    })
    .join("")}</div>`;
}

export const slotRole = (slot: SignatureSlot) => SLOT_LABELS[slot];
