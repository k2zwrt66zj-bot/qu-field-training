// =====================================================================
//  توليد التوثيق وفق APA (الإصدار السابع) — للمراجع العربية والإنجليزية
//  يعيد نصاً عادياً (للحفظ والبحث) وHTML بخط مائل لعناوين المصادر (للعرض والطباعة)
// =====================================================================

export type ApaSourceType = "BOOK_CHAPTER" | "JOURNAL_ARTICLE" | "CONFERENCE_PAPER";

export interface ApaInput {
  sourceType: ApaSourceType;
  authors: string[]; // بصيغة "العتيبي، خ." أو "Smith, J. A."
  publicationYear?: number | null;
  title: string;
  containerTitle?: string | null; // الكتاب / المجلة / وقائع المؤتمر
  editors?: string | null; // "خ. العتيبي" أو "J. Smith & K. Lee"
  volume?: string | null;
  issue?: string | null;
  pages?: string | null; // "101-110"
  publisher?: string | null;
  doi?: string | null;
  url?: string | null;
}

const ARABIC = /[؀-ۿ]/;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const clean = (s?: string | null) => (s ?? "").trim().replace(/\s+/g, " ");
const endWithPeriod = (s: string) => (/[.?!؟]$/.test(s) ? s : `${s}.`);

export function normalizeDoi(doi?: string | null): string | null {
  const d = clean(doi);
  if (!d) return null;
  const m = d.match(/10\.\d{4,9}\/\S+/);
  return m ? `https://doi.org/${m[0]}` : null;
}

const normalizePages = (p?: string | null) => clean(p).replace(/\s*[-–—]\s*/g, "–");

function joinAuthors(authors: string[], ar: boolean): string {
  const a = authors.map(clean).filter(Boolean);
  if (a.length === 0) return "";
  if (a.length === 1) return a[0];
  if (ar) return `${a.slice(0, -1).join("، ")}، و${a.at(-1)}`;
  if (a.length <= 20) return `${a.slice(0, -1).join(", ")}, & ${a.at(-1)}`;
  // APA 7: أول 19 ثم … ثم الأخير
  return `${a.slice(0, 19).join(", ")}, . . . ${a.at(-1)}`;
}

/** يولد التوثيق؛ لغة القالب تتبع لغة العنوان/المؤلفين */
export function formatApa(input: ApaInput): { text: string; html: string } {
  const ar = ARABIC.test(input.title) || input.authors.some((x) => ARABIC.test(x));
  const L = ar
    ? { nd: "د.ت.", in: "في", ed: "(محرر)", eds: "(محررون)", pp: "ص ص.", p: "ص." }
    : { nd: "n.d.", in: "In", ed: "(Ed.)", eds: "(Eds.)", pp: "pp.", p: "p." };

  const authors = joinAuthors(input.authors, ar);
  const year = `(${input.publicationYear ?? L.nd}).`;
  const title = endWithPeriod(clean(input.title));
  const container = clean(input.containerTitle);
  const pages = normalizePages(input.pages);
  const doi = normalizeDoi(input.doi) ?? (clean(input.url) || null);
  const publisher = clean(input.publisher);

  // أجزاء: نص + مائل؟ + ملاصق لما قبله بلا مسافة؟
  type Part = { s: string; italic?: boolean; tight?: boolean };
  const parts: Part[] = [];
  const push = (s: string, italic = false, tight = false) => { if (s) parts.push({ s, italic, tight }); };
  const sep = ar ? "،" : ",";

  if (authors) push(endWithPeriod(authors));
  push(year);
  push(title);

  if (input.sourceType === "JOURNAL_ARTICLE") {
    // Author. (Year). Title. *Journal*, *Vol*(Issue), pages. DOI
    if (container) {
      const vol = clean(input.volume);
      const iss = clean(input.issue);
      if (vol) {
        push(`${container}${sep}`, true);
        push(vol, true);
        push(`${iss ? `(${iss})` : ""}${pages ? `${sep} ${pages}` : ""}.`, false, true);
      } else {
        push(`${container}${pages ? sep : "."}`, true);
        if (pages) push(`${pages}.`);
      }
    }
  } else {
    // فصل في كتاب / وقائع مؤتمر: In E. Editor (Ed.), *Book* (pp. x–y). Publisher. DOI
    const editors = clean(input.editors);
    const multiEd = /&|،\s*و|, /.test(editors);
    push(editors ? `${L.in} ${editors} ${multiEd ? L.eds : L.ed}${sep}` : L.in);
    if (container) push(pages ? container : `${container}.`, true);
    if (pages) push(`(${pages.includes("–") ? L.pp : L.p} ${pages}).`);
    if (publisher) push(endWithPeriod(publisher));
  }
  if (doi) push(doi);

  let text = "";
  let html = "";
  for (const { s: seg, italic, tight } of parts) {
    const glue = text === "" || tight ? "" : " ";
    text += glue + seg;
    html += glue + (italic ? `<i>${esc(seg)}</i>` : esc(seg));
  }
  return { text, html };
}
