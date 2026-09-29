// تسجيل الدخول من المتصفح بمسارات نسبية (على نطاق الصفحة الحالية) ونتيجة من رمز الحالة HTTP.
// لا نستخدم signIn() من next-auth/react هنا: فهي تحلل رابط الرد بـ new URL() فتفشل مع إعادة التوجيه
// النسبية، وعند كلمة مرور خاطئة تبني رابطاً مطلقاً من NEXTAUTH_URL (قد يكون localhost).
import { getSession } from "next-auth/react";

export async function credentialsLogin(email: string, password: string): Promise<"ok" | "invalid" | "error"> {
  try {
    const { csrfToken } = await fetch("/api/auth/csrf", { cache: "no-store" }).then((r) => r.json());
    const res = await fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
    });
    if (res.status === 401) return "invalid";
    if (!res.ok) return "error";
    // مزامنة الجلسة في المتصفح وإشعار التبويبات الأخرى
    await getSession();
    return "ok";
  } catch {
    return "error";
  }
}
