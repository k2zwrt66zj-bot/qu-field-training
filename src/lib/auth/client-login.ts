// تسجيل الدخول من المتصفح بمسارات نسبية (على نطاق الصفحة الحالية) ونتيجة من رمز الحالة HTTP.
// لا نستخدم signIn() من next-auth/react هنا: فهي تحلل رابط الرد بـ new URL() فتفشل مع إعادة التوجيه
// النسبية، وعند كلمة مرور خاطئة تبني رابطاً مطلقاً من NEXTAUTH_URL (قد يكون localhost).
import { getSession } from "next-auth/react";
import { LOCKED_ERROR } from "./password-policy";

export async function credentialsLogin(email: string, password: string): Promise<"ok" | "invalid" | "locked" | "error"> {
  try {
    const { csrfToken } = await fetch("/api/auth/csrf", { cache: "no-store" }).then((r) => r.json());
    const res = await fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
    });
    if (res.status === 401) {
      // NextAuth يضع سبب الرفض في رابط الرد (?error=…)؛ القفل المؤقت له رسالة خاصة
      const { url } = await res.json().catch(() => ({ url: "" }));
      const error = url ? new URL(url, location.origin).searchParams.get("error") : null;
      return error === LOCKED_ERROR ? "locked" : "invalid";
    }
    if (!res.ok) return "error";
    // مزامنة الجلسة في المتصفح وإشعار التبويبات الأخرى
    await getSession();
    return "ok";
  } catch {
    return "error";
  }
}
