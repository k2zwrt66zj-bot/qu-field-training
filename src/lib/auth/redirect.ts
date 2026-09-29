// =====================================================================
//  إعادة توجيه آمنة ونسبية (نقية — تستخدمها NextAuth وصفحة الدخول والاختبارات)
//  أي رابط (نسبي أو مطلق) يتحول إلى مسار على نطاق الطلب الحالي نفسه:
//   - لا عودة إلى localhost أو إلى قيمة NEXTAUTH_URL الثابتة عند فتح المنصة من نطاق آخر
//   - لا إعادة توجيه مفتوحة إلى مواقع خارجية (open redirect)
// =====================================================================

const PLACEHOLDER_ORIGIN = "http://relative.invalid";

/**
 * يعيد مساراً نسبياً آمناً: "/login" و"https://any.host/forms/1?x=1" → "/forms/1?x=1"
 * البروتوكولات غير http(s) (مثل javascript:) والقيم الفارغة → fallback
 */
export function safeRelativePath(url: string | null | undefined, fallback = "/"): string {
  if (!url) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(url, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fallback;
  // "//evil.com" أو "/\evil.com" يفسرها المتصفح نطاقاً آخر: نطوي الشرطات المتتالية في البداية
  const path = parsed.pathname.replace(/^\/+/, "/");
  return `${path}${parsed.search}${parsed.hash}`;
}
