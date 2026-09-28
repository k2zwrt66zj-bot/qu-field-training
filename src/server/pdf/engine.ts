// =====================================================================
//  محرك PDF الرسمي: HTML ← Chromium (puppeteer-core) ← PDF بمقاس A4
//  - الخطوط مضمّنة محلياً (Amiri للمتن كما في الدليل، وIBM Plex Sans Arabic للجداول)
//    فلا يعتمد التوليد على الإنترنت
//  - متصفح واحد يُعاد استخدامه بين الطلبات ويُغلق بعد دقيقة خمول
// =====================================================================
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Browser } from "puppeteer-core";

const FONT_CSS = ["@fontsource/amiri/400.css", "@fontsource/amiri/700.css", "@fontsource/ibm-plex-sans-arabic/400.css", "@fontsource/ibm-plex-sans-arabic/600.css"];
/** نضمّن مجموعتي العربية واللاتينية (القائمة) فقط لتصغير حجم المستند */
const WANTED = /-(arabic|latin)-\d+-normal \*\//;

let fontCss: Promise<string> | null = null;

/** @font-face بصيغة data URI مع unicode-range (تُقرأ مرة واحدة وتُخزَّن) */
export function embeddedFonts(): Promise<string> {
  fontCss ??= (async () => {
    const parts: string[] = [];
    for (const rel of FONT_CSS) {
      const file = path.join(process.cwd(), "node_modules", rel);
      const dir = path.dirname(file);
      const css = await readFile(file, "utf8");
      for (const block of css.split(/(?=\/\* )/)) {
        if (!WANTED.test(block)) continue;
        const woff2 = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
        if (!woff2) continue;
        const b64 = (await readFile(path.join(dir, "files", woff2))).toString("base64");
        parts.push(block.replace(/src:[^;]+;/, `src: url(data:font/woff2;base64,${b64}) format('woff2');`));
      }
    }
    return parts.join("\n");
  })();
  return fontCss;
}

let logo: Promise<string> | null = null;
export function logoDataUri(): Promise<string> {
  logo ??= readFile(path.join(process.cwd(), process.env.LOGO_PATH ?? "public/brand/qu-logo.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);
  return logo;
}

// ------------------------------------------------------------------ المتصفح

let browser: Promise<Browser> | null = null;
let idle: NodeJS.Timeout | null = null;

/** مسار المتصفح: CHROME_EXECUTABLE_PATH، وإلا أشهر مسارات Chrome/Edge/Chromium على ويندوز وماك ولينكس */
const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium",
];
let chromePath: string | null | undefined;
export function resolveChrome(): string | null {
  if (chromePath !== undefined) return chromePath;
  const env = process.env.CHROME_EXECUTABLE_PATH;
  chromePath = (env && existsSync(env) ? env : CANDIDATES.find((c) => existsSync(c))) ?? null;
  return chromePath;
}
export const pdfAvailable = () => !!resolveChrome();

async function getBrowser(): Promise<Browser> {
  if (idle) clearTimeout(idle);
  idle = setTimeout(() => {
    const b = browser;
    browser = null;
    void b?.then((x) => x.close()).catch(() => undefined);
  }, 60_000);
  browser ??= import("puppeteer-core").then((p) =>
    p.default.launch({ executablePath: resolveChrome()!, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-dev-shm-usage"] })
  );
  const b = await browser;
  if (!b.connected) {
    browser = null;
    return getBrowser();
  }
  return b;
}

/** يحوّل مستنداً HTML كاملاً إلى PDF (null إن لم يتوفر Chromium على الخادم) */
export async function htmlToPdf(html: string): Promise<Uint8Array | null> {
  if (!pdfAvailable()) return null;
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      // ترقيم الصفحات بأرقام لاتينية (قالب التذييل لا يحمّل خطوط الصفحة)
      footerTemplate: `<div style="width:100%;font-size:8px;color:#7b8088;text-align:center;font-family:sans-serif"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    });
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** استجابة PDF، أو نسخة HTML للطباعة من المتصفح إن لم يتوفر Chromium (أو طُلبت صراحة) */
export async function pdfResponse(html: string, fileName: string, req: Request): Promise<Response> {
  const wantsHtml = new URL(req.url).searchParams.get("format") === "html";
  const pdf = wantsHtml ? null : await htmlToPdf(html);
  if (!pdf) {
    const printable = html.replace("</body>", `<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400))</script></body>`);
    return new Response(printable, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
  }
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
}
