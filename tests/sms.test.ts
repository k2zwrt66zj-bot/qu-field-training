// رسالة وصول المتدرب: تنسيق الرقم السعودي ونص الرسالة واختيار المزوّد
import { test } from "node:test";
import assert from "node:assert/strict";
import { arrivalMessage, displaySaudiMobile, maskMobile, normalizeSaudiMobile } from "../src/lib/sms-format.ts";
import { sendSms, smsProvider } from "../src/server/sms.ts";

test("sms: توحيد أرقام الجوال السعودية بالصيغة الدولية", () => {
  for (const v of ["0551234567", "551234567", "966551234567", "+966551234567", "00966551234567", "055 123 4567", "055-123-4567", "٠٥٥١٢٣٤٥٦٧"]) {
    assert.equal(normalizeSaudiMobile(v), "966551234567", v);
  }
  for (const v of ["", null, undefined, "0161234567", "05512345", "05512345678", "abc", "+971551234567"]) {
    assert.equal(normalizeSaudiMobile(v as string), null, String(v));
  }
  assert.equal(displaySaudiMobile("966551234567"), "0551234567");
  assert.equal(maskMobile("966551234567"), "•••567");
});

test("sms: نص رسالة الوصول (المتدرب/المتدربة والتأخر)", () => {
  const at = new Date("2026-10-04T04:58:00Z"); // 07:58 بتوقيت الرياض
  const m = arrivalMessage({ studentName: "محمد العنزي", female: false, organization: "مستشفى بريدة المركزي", at });
  assert.ok(m.includes("وصل المتدرب محمد العنزي إلى مستشفى بريدة المركزي") && m.includes("07:58") && !m.includes("متأخر"), m);
  const f = arrivalMessage({ studentName: "هند الدوسري", female: true, organization: "جمعية البر", at, late: true });
  assert.ok(f.includes("وصلت المتدربة هند الدوسري") && f.includes("(متأخر)"), f);
  assert.ok(m.length <= 140, `طول الرسالة ${m.length}`);
});

test("sms: المزوّد من البيئة، وبلا إعداد لا إرسال ولا استثناء", async () => {
  assert.equal(smsProvider({}), null);
  assert.equal(smsProvider({ SMS_PROVIDER: "Taqnyat" }), "taqnyat");
  assert.equal(smsProvider({ SMS_PROVIDER: "unifonic" }), "unifonic");
  assert.equal(smsProvider({ SMS_PROVIDER: "msegat" }), "msegat");
  assert.equal(smsProvider({ SMS_PROVIDER: "other" }), null);
  const saved = { p: process.env.SMS_PROVIDER, k: process.env.SMS_API_KEY };
  delete process.env.SMS_PROVIDER;
  delete process.env.SMS_API_KEY;
  const r = await sendSms("966551234567", "اختبار");
  assert.equal(r.sent, false);
  if (saved.p !== undefined) process.env.SMS_PROVIDER = saved.p;
  if (saved.k !== undefined) process.env.SMS_API_KEY = saved.k;
});

test("sms: شكل الطلب لكل مزوّد، وفشل المزوّد لا يرمي استثناء", async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  let status = 200;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status });
  }) as typeof fetch;
  try {
    process.env.SMS_API_KEY = "KEY";
    process.env.SMS_SENDER = "QU-Training";

    process.env.SMS_PROVIDER = "taqnyat";
    assert.deepEqual(await sendSms("966551234567", "مرحبا"), { sent: true, provider: "taqnyat" });
    assert.equal(calls[0].url, "https://api.taqnyat.sa/v1/messages");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer KEY");
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { recipients: ["966551234567"], body: "مرحبا", sender: "QU-Training" });

    process.env.SMS_PROVIDER = "unifonic";
    await sendSms("966551234567", "مرحبا");
    const u = new URLSearchParams(String(calls[1].init.body));
    assert.equal(calls[1].url, "https://el.cloud.unifonic.com/rest/SMS/messages");
    assert.deepEqual([u.get("AppSid"), u.get("SenderID"), u.get("Recipient"), u.get("Body")], ["KEY", "QU-Training", "966551234567", "مرحبا"]);

    process.env.SMS_PROVIDER = "msegat";
    process.env.SMS_USERNAME = "qu";
    await sendSms("966551234567", "مرحبا");
    assert.equal(calls[2].url, "https://www.msegat.com/gw/sendsms.php");
    assert.deepEqual(JSON.parse(String(calls[2].init.body)), { userName: "qu", apiKey: "KEY", numbers: "966551234567", userSender: "QU-Training", msg: "مرحبا", msgEncoding: "UTF8" });

    status = 401;
    const bad = await sendSms("966551234567", "مرحبا");
    assert.equal(bad.sent, false);
    globalThis.fetch = (async () => { throw new Error("network down"); }) as typeof fetch;
    const down = await sendSms("966551234567", "مرحبا");
    assert.ok(!down.sent && down.reason.includes("network down"));
  } finally {
    globalThis.fetch = realFetch;
    process.env = saved;
  }
});
