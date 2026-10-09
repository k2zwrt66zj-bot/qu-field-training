// =====================================================================
//  كبح محاولات الدخول حسب عنوان IP (دفاع ثانوي مكمّل لقفل الحساب)
// ---------------------------------------------------------------------
//  قفل الحساب يوقف تخمين كلمة مرور حساب واحد؛ وهذا يوقف «الرش» (تجربة
//  كلمة مرور واحدة على حسابات كثيرة من المصدر نفسه). يُحتسب الفشل فقط،
//  فلا يتأثر الدخول الناجح لعدة مستخدمين من الشبكة نفسها.
//  ملاحظة: الذاكرة هنا لكل نسخة خادم (serverless)، فالكبح تقريبي؛
//  الحماية الأساسية تبقى قفل الحساب في قاعدة البيانات.
// =====================================================================

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = Number(process.env.LOGIN_IP_MAX ?? 50);
const ENABLED = process.env.LOGIN_IP_THROTTLE !== "off";

const hits = new Map<string, number[]>();

const prune = (arr: number[], now: number) => arr.filter((t) => now - t < WINDOW_MS);

/** هل تجاوز هذا العنوان حدّ المحاولات الفاشلة ضمن النافذة؟ */
export function ipThrottled(ip: string | null | undefined, now = Date.now()): boolean {
  if (!ENABLED || !ip) return false;
  const arr = prune(hits.get(ip) ?? [], now);
  if (arr.length) hits.set(ip, arr);
  else hits.delete(ip);
  return arr.length >= MAX_FAILURES;
}

/** يسجّل محاولة دخول فاشلة من هذا العنوان */
export function ipRecordFailure(ip: string | null | undefined, now = Date.now()): void {
  if (!ENABLED || !ip) return;
  const arr = prune(hits.get(ip) ?? [], now);
  arr.push(now);
  hits.set(ip, arr);
  // كبح نمو الخريطة: نظّف العناوين المنتهية عند تجاوز حجم معقول
  if (hits.size > 5000) for (const [k, v] of hits) if (prune(v, now).length === 0) hits.delete(k);
}

/** نجاح الدخول يصفّر عدّاد العنوان */
export function ipClear(ip: string | null | undefined): void {
  if (ip) hits.delete(ip);
}
