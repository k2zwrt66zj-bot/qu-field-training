// =====================================================================
//  إعدادات الجلسة والكوكيز المشتركة بين NextAuth والـ middleware
//  (بلا قاعدة بيانات: يستورده الـ middleware الذي يعمل على Edge runtime)
// =====================================================================

/** مدة الجلسة ورمز JWT: 30 يوماً (تمتد تلقائياً مع الاستخدام — جلسة منزلقة) */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * كل كم ثانية يطلب المتصفح /api/auth/session والصفحة مفتوحة.
 * كل طلب يعيد إصدار الكوكي بصلاحية 30 يوماً جديدة، ويتحقق من حالة الحساب في القاعدة.
 */
export const SESSION_REFETCH_SECONDS = 5 * 60;

/** أقصى مدة بين تحققين من حالة الحساب (مفعّل؟ الدور الحالي؟) من قاعدة البيانات (قابلة للضبط للاختبارات) */
export const USER_RECHECK_SECONDS = Number(process.env.AUTH_USER_RECHECK_SECONDS ?? 5 * 60);

/**
 * كوكيز آمنة (Secure وبادئة __Secure-) فقط حين يكون الرابط المعتمد HTTPS — القاعدة نفسها التي تتبعها NextAuth،
 * فيبقى التشغيل المحلي عبر http://localhost أو عنوان الشبكة يعمل، وتبقى أسماء الكوكيز الحالية (لا يُطلب دخول جديد).
 */
export const USE_SECURE_COOKIES = process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL;

const prefix = USE_SECURE_COOKIES ? "__Secure-" : "";
const options = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: USE_SECURE_COOKIES };

export const SESSION_COOKIE_NAME = `${prefix}next-auth.session-token`;

/**
 * sameSite: "lax" صراحةً: يُرسل الكوكي عند فتح رابط المنصة من بريد أو رسالة (تنقل علوي)
 * ولا يُرسل في الطلبات الخفية من مواقع أخرى (حماية من CSRF)
 */
export const AUTH_COOKIES = {
  sessionToken: { name: SESSION_COOKIE_NAME, options },
  callbackUrl: { name: `${prefix}next-auth.callback-url`, options },
  csrfToken: { name: `${USE_SECURE_COOKIES ? "__Host-" : ""}next-auth.csrf-token`, options },
};
