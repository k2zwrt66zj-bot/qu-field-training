import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import type { LetterType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INSTITUTION, MAJOR_LABELS } from "@/lib/labels";
import { formatDateAr, formatHijri } from "@/lib/time";

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  REFERRAL: "خطاب توجيه متدرب",
  COMMENCEMENT: "خطاب مباشرة تدريب",
  COMPLETION: "إفادة إتمام تدريب ميداني",
};

/** رقم صادر تسلسلي لكل سنة: FT-2026-000001 */
export async function nextSerial(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.letter.count({ where: { serialNumber: { startsWith: `FT-${year}-` } } });
  return `FT-${year}-${String(count + 1).padStart(6, "0")}`;
}

export async function issueLetter(placementId: string, type: LetterType, issuedById: string) {
  // إعادة المحاولة عند تعارض الرقم التسلسلي في الإصدار المتزامن
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.letter.create({
        data: {
          placementId,
          type,
          issuedById,
          serialNumber: await nextSerial(),
          verificationCode: randomBytes(9).toString("base64url"),
        },
      });
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  throw new Error("unreachable");
}

async function logoDataUri(): Promise<string> {
  const file = process.env.LOGO_PATH ?? "public/brand/logo.svg";
  const buf = await readFile(path.join(process.cwd(), file));
  const mime = file.endsWith(".png") ? "image/png" : file.endsWith(".jpg") ? "image/jpeg" : "image/svg+xml";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** يولّد HTML كامل للخطاب (يُستخدم للعرض/الطباعة ولتوليد PDF على الخادم) */
export async function renderLetterHtml(letterId: string, baseUrl: string, opts: { printButton?: boolean } = {}) {
  const letter = await prisma.letter.findUniqueOrThrow({
    where: { id: letterId },
    include: {
      placement: {
        include: {
          student: { include: { user: true } },
          organization: true,
          term: true,
          academicSupervisor: { include: { user: true } },
          fieldSupervisor: { include: { user: true } },
        },
      },
    },
  });
  const p = letter.placement;
  const st = p.student;
  const isFemale = st.gender === "FEMALE";
  const studentWord = isFemale ? "الطالبة" : "الطالب";
  const verifyUrl = `${baseUrl}/verify/${letter.verificationCode}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 160, color: { dark: "#0b5537" } });
  const logo = await logoDataUri();
  const addressee = p.organization.contactTitle ?? "سعادة مدير";

  const bodies: Record<LetterType, string> = {
    REFERRAL: `
      <p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>
      <p>تهديكم ${INSTITUTION.unit} بـ${INSTITUTION.department} في ${INSTITUTION.college} أطيب تحية، وتشكر لكم تعاونكم المثمر في إعداد الكفاءات الوطنية المتخصصة،
      ونفيدكم بأنه قد تم توجيه ${studentWord} الموضحة بياناته${isFemale ? "ا" : ""} أدناه لقضاء فترة التدريب الميداني لدى جهتكم الموقرة، وذلك خلال الفترة
      من <b>${formatDateAr(p.startDate)}</b> إلى <b>${formatDateAr(p.endDate)}</b>، بواقع <b>${p.requiredHours}</b> ساعة تدريبية.</p>
      <p>نأمل التكرم بتسهيل مهمة ${studentWord}، وتكليف مشرف ميداني لمتابعته${isFemale ? "ا" : ""} واعتماد الحضور اليومي والتقييم عبر منصة التدريب الميداني الإلكترونية.</p>`,
    COMMENCEMENT: `
      <p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>
      <p>نفيدكم بمباشرة ${studentWord} الموضحة بياناته${isFemale ? "ا" : ""} أدناه التدريب الميداني لدى جهتكم الموقرة اعتباراً من <b>${formatDateAr(p.startDate)}</b>،
      ونأمل التكرم بإحاطتنا بأي ملاحظات تخص انتظام${isFemale ? "ها" : "ه"} خلال فترة التدريب.</p>`,
    COMPLETION: `
      <p>تفيد ${INSTITUTION.unit} بـ${INSTITUTION.department} بأن ${studentWord} الموضحة بياناته${isFemale ? "ا" : ""} أدناه قد أتم${isFemale ? "ت" : ""} متطلبات التدريب الميداني
      لدى <b>${esc(p.organization.name)}</b> خلال الفترة من <b>${formatDateAr(p.startDate)}</b> إلى <b>${formatDateAr(p.endDate)}</b>،
      بعدد ساعات معتمدة <b>${Math.round(p.approvedMinutes / 60)}</b> ساعة.</p>
      <p>وقد أعطيت له${isFemale ? "ا" : ""} هذه الإفادة بناءً على طلب${isFemale ? "ها" : "ه"} دون أدنى مسؤولية على الجامعة.</p>`,
  };

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${LETTER_TYPE_LABELS[letter.type]} - ${esc(st.user.fullName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Amiri", "Traditional Arabic", serif; color: #1d2320; font-size: 15.5pt; line-height: 1.9; margin: 0; background: #eceeed; }
  .page { background: #fff; width: 210mm; max-width: 100%; min-height: 297mm; margin: 12px auto; padding: 14mm 16mm; }
  header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 3px double #b8963e; padding-bottom: 8px; }
  header .right { font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 10.5pt; line-height: 1.7; color: #0b5537; font-weight: 600; }
  header .left { font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 10pt; text-align: left; line-height: 1.8; }
  header img { width: 88px; height: 88px; }
  h1 { text-align: center; color: #0b5537; font-size: 20pt; margin: 18px 0 6px; }
  .to { margin-top: 10px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 11pt; }
  td, th { border: 1px solid #c9cdcb; padding: 6px 10px; }
  th { background: #ecf7f1; color: #0b5537; width: 28%; text-align: right; }
  .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 30px; text-align: center; }
  .signs .role { color: #0b5537; font-weight: 700; }
  .signs .line { margin-top: 42px; border-top: 1px dotted #7b817e; width: 70%; margin-inline: auto; }
  footer { margin-top: 28px; display: flex; justify-content: space-between; align-items: end;
    font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 8.5pt; color: #4a4f4d; border-top: 1px solid #b8963e; padding-top: 6px; }
  footer img { width: 72px; height: 72px; }
  .toolbar { text-align: center; margin: 12px; font-family: "IBM Plex Sans Arabic", sans-serif; }
  .toolbar button, .toolbar a { background: #0f6b45; color: #fff; border: 0; border-radius: 8px; padding: 8px 18px; font: inherit; cursor: pointer; text-decoration: none; margin: 0 4px; }
  @media print { body { background: #fff; } .page { margin: 0; padding: 0; width: auto; min-height: auto; } .toolbar { display: none; } footer { break-inside: avoid; } }
</style>
</head>
<body>
${opts.printButton ? `<div class="toolbar"><button onclick="window.print()">طباعة / حفظ PDF</button><a href="/api/letters/${letter.id}/pdf">تنزيل PDF</a></div>` : ""}
<div class="page">
  <header>
    <div class="right">المملكة العربية السعودية<br/>${INSTITUTION.university}<br/>${INSTITUTION.college}<br/>${INSTITUTION.department}</div>
    <img src="${logo}" alt="شعار جامعة القصيم" />
    <div class="left">الرقم: ${letter.serialNumber}<br/>التاريخ: ${formatHijri(letter.issuedAt)}<br/>الموافق: ${formatDateAr(letter.issuedAt)}</div>
  </header>

  <h1>${LETTER_TYPE_LABELS[letter.type]}</h1>
  ${letter.type !== "COMPLETION" ? `<div class="to">${esc(addressee)} ${esc(p.organization.name)} &nbsp;&nbsp; ${/مديرة|رئيسة|مشرفة/.test(addressee) ? "حفظها الله" : "حفظه الله"}</div>` : ""}
  ${bodies[letter.type]}

  <table>
    <tr><th>اسم ${studentWord}</th><td>${esc(st.user.fullName)}</td></tr>
    <tr><th>الرقم الجامعي</th><td>${esc(st.universityId)}</td></tr>
    <tr><th>التخصص</th><td>${MAJOR_LABELS[st.major]}</td></tr>
    <tr><th>جهة التدريب</th><td>${esc(p.organization.name)} - ${esc(p.organization.city)}</td></tr>
    <tr><th>المشرف الأكاديمي</th><td>${esc(p.academicSupervisor?.user.fullName) || "—"}${p.academicSupervisor?.user.phone ? ` (${esc(p.academicSupervisor.user.phone)})` : ""}</td></tr>
    <tr><th>الفصل الدراسي</th><td>${esc(p.term.name)}</td></tr>
  </table>

  <p>شاكرين لكم حسن تعاونكم،،، وتقبلوا وافر التحية والتقدير.</p>

  <div class="signs">
    <div><div class="role">رئيس وحدة التدريب الميداني</div><div>${INSTITUTION.trainingHead}</div><div class="line"></div></div>
    <div><div class="role">رئيس القسم</div><div>${INSTITUTION.departmentHead}</div><div class="line"></div></div>
  </div>

  <footer>
    <div>هذا الخطاب صادر إلكترونياً من منصة التدريب الميداني.<br/>للتحقق من صحته امسح الرمز أو زر: ${esc(verifyUrl)}</div>
    <img src="${qr}" alt="رمز التحقق" />
  </footer>
</div>
</body>
</html>`;
}

/** توليد PDF على الخادم عبر Chromium (إن توفر) */
export async function renderLetterPdf(html: string): Promise<Uint8Array | null> {
  const executablePath = process.env.CHROME_EXECUTABLE_PATH;
  if (!executablePath) return null;
  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.launch({ executablePath, args: ["--no-sandbox", "--font-render-hinting=none"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 }).catch(() => undefined);
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 8_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
