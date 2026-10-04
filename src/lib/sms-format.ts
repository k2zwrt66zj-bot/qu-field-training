// =====================================================================
//  تنسيق الرسائل النصية (بلا اعتماد على الخادم: قابل للاختبار)
// =====================================================================

/** وقت الرياض بأرقام لاتينية (مثل 07:58 ص) — مطابق لـ formatTimeAr في time.ts */
const timeAr = (d: Date | string) =>
  new Intl.DateTimeFormat("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

/**
 * رقم جوال سعودي بالصيغة الدولية 9665XXXXXXXX، أو null إن لم يكن صالحاً.
 * يقبل: 05XXXXXXXX · 5XXXXXXXX · 9665XXXXXXXX · +9665XXXXXXXX · 009665XXXXXXXX (مع مسافات أو شرطات، وأرقام عربية).
 */
export function normalizeSaudiMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[\s\-()+]/g, "")
    .replace(/^00/, "");
  if (!/^\d+$/.test(digits)) return null;
  const local = digits.startsWith("966") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^5\d{8}$/.test(local) ? `966${local}` : null;
}

/** عرض الرقم للمستخدم: 05XXXXXXXX */
export const displaySaudiMobile = (intl: string) => `0${intl.slice(3)}`;

/** آخر ثلاثة أرقام فقط (للسجلات) */
export const maskMobile = (intl: string) => `•••${intl.slice(-3)}`;

/** نص رسالة وصول المتدرب للمشرف المؤسسي */
export function arrivalMessage(p: { studentName: string; female: boolean; organization: string; at: Date | string; late?: boolean }) {
  const verb = p.female ? "وصلت المتدربة" : "وصل المتدرب";
  return `منصة التدريب الميداني - جامعة القصيم: ${verb} ${p.studentName} إلى ${p.organization} الساعة ${timeAr(p.at)}${p.late ? " (متأخر)" : ""}.`;
}
