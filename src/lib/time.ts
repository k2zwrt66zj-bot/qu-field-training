// أدوات الوقت بتوقيت الرياض (Asia/Riyadh = UTC+3 دون توقيت صيفي)

export const TZ = "Asia/Riyadh";
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** تاريخ اليوم بتوقيت الرياض كـ Date (منتصف الليل UTC) صالح لحقول @db.Date */
export function riyadhDateOnly(d: Date = new Date()): Date {
  const local = new Date(d.getTime() + RIYADH_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** رقم يوم الأسبوع بتوقيت الرياض (0 = الأحد) */
export function riyadhWeekday(d: Date = new Date()): number {
  return new Date(d.getTime() + RIYADH_OFFSET_MS).getUTCDay();
}

/** دقائق منذ منتصف الليل بتوقيت الرياض */
export function riyadhMinutesOfDay(d: Date = new Date()): number {
  const local = new Date(d.getTime() + RIYADH_OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatDateAr(d: Date | string, withWeekday = false): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withWeekday ? { weekday: "long" } : {}),
  }).format(new Date(d));
}

/** تاريخ مختصر للجداول: "الأحد 27 سبتمبر" */
export function formatShortDateAr(d: Date | string): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(d));
}

export function formatHijri(d: Date | string): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
    timeZone: TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(d));
}

export function formatTimeAr(d: Date | string): string {
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

/** عدد أيام العمل (حسب أيام الأسبوع المحددة) بين تاريخين شاملين */
export function countWorkdays(start: Date, end: Date, workDays: number[]): number {
  let n = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (workDays.includes(cur.getUTCDay())) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}
