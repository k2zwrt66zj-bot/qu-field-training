// =====================================================================
//  رسالة وصول المتدرب للمشرف المؤسسي (اختيارية):
//  - الإعداد من صفحة المشرف (مفتاح + رقم جوال) والتحقق من الرقم
//  - تُسجَّل الرسالة عند أول تحضير ناجح فقط إن فعّلها المشرف، ولا شيء إن أوقفها
//  - بلا مزوّد رسائل مضبوط: لا إرسال فعلي، وتُسجَّل المحاولة بسببها (لا يتأثر التحضير)
//  التشغيل (والخادم يعمل، بعد npm run db:seed): npm run test:e2e:sms
// =====================================================================
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const B = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const DB = (process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/qu_field_training").split("?")[0];
const sql = (q) => execSync(`psql "${DB}" -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const FS = "field1@example.sa";

let pass = 0, fail = 0;
const check = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
};
const section = (t) => console.log(`\n${t}`);

const browser = await chromium.launch(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {});
async function login(email, viewport = { width: 1366, height: 900 }) {
  const p = await (await browser.newContext({ viewport, locale: "ar-SA" })).newPage();
  await p.goto(B + "/login"); await p.fill("#email", email); await p.fill("#password", "Qu@12345"); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return p;
}
const api = async (p, method, path, data) => {
  const r = await p.request.fetch(B + path, { method, data, headers: data ? { "Content-Type": "application/json" } : {} });
  return { status: r.status(), json: await r.json().catch(() => null) };
};

/** يجهّز متدرباً ميدانياً لدى المشرف للتحضير اليوم: يوم تدريب، بلا سجل اليوم، بلا كشف موقّع */
function prepareTrainee(skip = 0) {
  const row = sql(`select p.id, u.email, o.latitude, o.longitude, o.id, u.id from "Placement" p
    join "FieldSupervisorProfile" f on f.id=p."fieldSupervisorId" join "User" fu on fu.id=f."userId"
    join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" join "Organization" o on o.id=p."organizationId"
    left join "CourseSection" c on c.id=p."sectionId"
    where fu.email='${FS}' and p.status in ('ASSIGNED','ACTIVE') and (c.mode is null or c.mode='FIELD')
      and p."startDate" <= (now() at time zone 'Asia/Riyadh')::date and p."endDate" >= (now() at time zone 'Asia/Riyadh')::date
    order by u.email offset ${skip} limit 1`).split("|");
  const [placementId, email, lat, lng, orgId, userId] = row;
  const today = "(now() at time zone 'Asia/Riyadh')::date";
  sql(`update "Placement" set "workDays"='{0,1,2,3,4,5,6}' where id='${placementId}'`);
  sql(`delete from "AttendanceRecord" where "placementId"='${placementId}' and date=${today}`);
  sql(`delete from "AttendanceAttempt" where "placementId"='${placementId}'`);
  sql(`update "AttendanceSheet" set "signedAt"=null where "organizationId"='${orgId}' and "sheetDate"=${today}`);
  sql(`update "User" set "deviceId"=null where id='${userId}'`);
  return { placementId, email, lat: Number(lat), lng: Number(lng) };
}
async function checkIn(t) {
  const p = await login(t.email);
  const r = await api(p, "POST", "/api/attendance/check-in", { samples: [{ latitude: t.lat, longitude: t.lng, accuracy: 8, timestamp: Date.now() }], deviceId: "e2e-sms-device-0001" });
  await p.context().close();
  return r;
}
async function smsLog(recordId) {
  for (let i = 0; i < 20; i++) {
    const m = sql(`select meta::text from "AuditLog" where action='sms.arrival' and "entityId"='${recordId}' order by "createdAt" desc limit 1`);
    if (m) return JSON.parse(m);
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

section("أ) إعداد المشرف المؤسسي");
const fs = await login(FS);
let r = await api(fs, "GET", "/api/field-supervisor/notifications");
check(r.status === 200 && r.json.smsOnArrival === false, "الإعداد معطّل افتراضياً", r.json);
r = await api(fs, "PATCH", "/api/field-supervisor/notifications", { smsOnArrival: true, phone: "12345" });
check(r.status === 422 && r.json.error.includes("رقم الجوال"), "رفض رقم جوال غير صالح", r.json);
r = await api(fs, "PATCH", "/api/field-supervisor/notifications", { smsOnArrival: true, phone: "+966 55 123 4567" });
check(r.status === 200 && r.json.smsOnArrival === true && r.json.phone === "0551234567", "تفعيل الرسالة وحفظ الرقم بصيغة موحّدة", r.json);
check(r.json.smsConfigured === false, "لا مزوّد رسائل مضبوط في بيئة الاختبار");
const student = await login("441100001@qu.edu.sa");
r = await api(student, "PATCH", "/api/field-supervisor/notifications", { smsOnArrival: true });
check(r.status === 403, "الطالب لا يغيّر إعداد المشرف");
await student.context().close();

await fs.goto(B + "/field-supervisor");
const sw = fs.getByRole("switch", { name: "رسالة نصية عند وصول المتدرب" });
check((await sw.getAttribute("aria-checked")) === "true", "المفتاح مفعّل في صفحة المشرف");
check((await fs.locator("#sup-phone").inputValue()) === "0551234567", "الرقم ظاهر في صفحة المشرف");
check((await fs.getByText("يبدأ الإرسال الفعلي بعد تفعيل مزوّد الرسائل").count()) === 1, "تنبيه بأن المزوّد غير مفعّل بعد");

section("ب) وصول المتدرب والمشرف مفعّل للرسالة");
const t1 = prepareTrainee(0);
r = await checkIn(t1);
check(r.status === 200 && r.json.ok, `تحضير ناجح (${t1.email})`, r.json);
let log = await smsLog(r.json.recordId);
check(!!log, "سُجّلت رسالة الوصول للمشرف", log);
check(log?.to === "•••567" && log?.sent === false && /غير مفعّلة/.test(log?.reason ?? ""), "الرقم مخفي في السجل، ولا إرسال فعلي بلا مزوّد", log);

section("ج) المشرف أوقف الرسالة");
await fs.getByRole("switch", { name: "رسالة نصية عند وصول المتدرب" }).click();
await fs.getByText("أُوقفت رسائل الوصول").waitFor();
check(sql(`select "smsOnArrival" from "FieldSupervisorProfile" f join "User" u on u.id=f."userId" where u.email='${FS}'`) === "f", "الإيقاف من الصفحة محفوظ");
const t2 = prepareTrainee(1);
r = await checkIn(t2);
check(r.status === 200 && r.json.ok, `تحضير ناجح (${t2.email})`, r.json);
await new Promise((res) => setTimeout(res, 2500));
check(sql(`select count(*) from "AuditLog" where action='sms.arrival' and "entityId"='${r.json.recordId}'`) === "0", "لا رسالة بعد الإيقاف");

await browser.close();
console.log(`\n${fail ? "❌" : "✅"} ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
