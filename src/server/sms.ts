// =====================================================================
//  إرسال الرسائل النصية عبر مزوّد سعودي — يُحدَّد بمتغيرات البيئة (على الخادم فقط)
//   SMS_PROVIDER = taqnyat | unifonic | msegat   (فارغ: لا إرسال فعلي، تُسجَّل المحاولة فقط)
//   SMS_SENDER   = اسم المرسل المعتمد لدى المزوّد (مثل QU-Training)
//   taqnyat : SMS_API_KEY (Bearer)
//   unifonic: SMS_API_KEY (AppSid)
//   msegat  : SMS_API_KEY (apiKey) + SMS_USERNAME
// =====================================================================

export type SmsProvider = "taqnyat" | "unifonic" | "msegat";
export type SmsResult = { sent: true; provider: SmsProvider } | { sent: false; provider: SmsProvider | null; reason: string };

export function smsProvider(env: Record<string, string | undefined> = process.env): SmsProvider | null {
  const p = env.SMS_PROVIDER?.trim().toLowerCase();
  return p === "taqnyat" || p === "unifonic" || p === "msegat" ? p : null;
}

/** هل خدمة الرسائل مفعّلة على الخادم؟ (للعرض في الواجهة) */
export const smsConfigured = () => !!smsProvider() && !!process.env.SMS_API_KEY;

/** يرسل رسالة إلى رقم بصيغة 9665XXXXXXXX. لا يرمي استثناء أبداً: يعيد النتيجة لتُسجَّل */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const provider = smsProvider();
  const key = process.env.SMS_API_KEY;
  const sender = process.env.SMS_SENDER ?? "";
  if (!provider || !key) return { sent: false, provider, reason: "خدمة الرسائل غير مفعّلة على الخادم" };

  const timeout = AbortSignal.timeout(8_000);
  try {
    let res: Response;
    if (provider === "taqnyat") {
      res = await fetch("https://api.taqnyat.sa/v1/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: [to], body, sender }),
        signal: timeout,
      });
    } else if (provider === "unifonic") {
      res = await fetch("https://el.cloud.unifonic.com/rest/SMS/messages", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ AppSid: key, SenderID: sender, Body: body, Recipient: to }),
        signal: timeout,
      });
    } else {
      res = await fetch("https://www.msegat.com/gw/sendsms.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: process.env.SMS_USERNAME ?? "", apiKey: key, numbers: to, userSender: sender, msg: body, msgEncoding: "UTF8" }),
        signal: timeout,
      });
    }
    if (!res.ok) return { sent: false, provider, reason: `رفض المزوّد الطلب (${res.status})` };
    return { sent: true, provider };
  } catch (e) {
    return { sent: false, provider, reason: `تعذّر الاتصال بالمزوّد: ${(e as Error).message}` };
  }
}
