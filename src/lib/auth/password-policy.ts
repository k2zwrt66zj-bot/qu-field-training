// =====================================================================
//  سياسة كلمات المرور والقفل المؤقت (بلا اعتماد على الخادم: قابلة للاختبار)
// =====================================================================

/** عدد المحاولات الخاطئة المتتالية قبل القفل، ومدة القفل */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/** كلمات مرور شائعة أو معروفة (منها كلمة مرور بيانات العرض) */
const COMMON = new Set(["qu@12345", "12345678", "password", "password1", "qwerty123", "11111111", "123456789", "abc12345", "p@ssw0rd"]);

/** يعيد سبب الرفض، أو null إن كانت كلمة المرور مقبولة */
export function passwordProblem(pw: string, ctx: { email?: string; current?: string } = {}): string | null {
  if (pw.length < 8) return "كلمة المرور 8 أحرف على الأقل";
  if (pw.length > 128) return "كلمة المرور طويلة جداً";
  if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d/.test(pw)) return "يجب أن تحتوي كلمة المرور على حروف وأرقام";
  if (COMMON.has(pw.toLowerCase())) return "كلمة المرور شائعة ويسهل تخمينها";
  if (ctx.current && pw === ctx.current) return "اختر كلمة مرور مختلفة عن الحالية";
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && pw.toLowerCase().includes(local)) return "لا تستخدم بريدك أو رقمك الجامعي في كلمة المرور";
  return null;
}

/** حالة القفل بعد محاولة خاطئة: العدّاد الجديد، وموعد انتهاء القفل إن بلغ الحد */
export function afterFailedLogin(failed: number, now = new Date()): { failedLogins: number; lockedUntil: Date | null } {
  const n = failed + 1;
  return n >= MAX_FAILED_LOGINS ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) } : { failedLogins: n, lockedUntil: null };
}

/** رمز خطأ القفل في رد NextAuth (يُقرأ في صفحة الدخول) */
export const LOCKED_ERROR = "AccountLocked";
