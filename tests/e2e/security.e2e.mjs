// =====================================================================
//  الأمان والاعتماد اليومي:
//  - قفل الحساب مؤقتاً بعد 5 محاولات خاطئة (برسالة واضحة)، وكلمة المرور الصحيحة لا تفتحه أثناء القفل
//  - كلمة المرور المؤقتة: تحويل إلزامي لصفحة الحساب، وتغييرها بسياسة كلمات المرور
//  - المشرف المؤسسي يعتمد يوماً بلا انصراف بتحديد المدة، ويرفض بسبب يظهر للمتدرب
//  - ترويسات الأمان
//  التشغيل (والخادم يعمل، بعد npm run db:seed): npm run test:e2e:security
// =====================================================================
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const B = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const DB = (process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/qu_field_training").split("?")[0];
const sql = (q) => execSync(`psql "${DB}" -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const PW = "Qu@12345";
const TEST = "security.test@example.sa";

let pass = 0, fail = 0;
const check = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
};
const section = (t) => console.log(`\n${t}`);

// مستخدم اختبار بكلمة مرور بيانات العرض (لا نقفل حسابات العرض)
sql(`delete from "AuditLog" where "entityId"='sec_test_user'`);
sql(`delete from "User" where email='${TEST}'`);
sql(`insert into "User" (id, email, "passwordHash", "fullName", role, "updatedAt") select 'sec_test_user', '${TEST}', "passwordHash", 'مستخدم اختبار الأمان', 'DEPARTMENT_HEAD', now() from "User" where email='omar.alnamlah@qu.edu.sa'`);

const browser = await chromium.launch(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {});
const newPage = async (viewport = { width: 1366, height: 900 }) => (await browser.newContext({ viewport, locale: "ar-SA" })).newPage();
async function tryLogin(p, email, password) {
  await p.goto(B + "/login");
  await p.fill("#email", email); await p.fill("#password", password); await p.click("button[type=submit]");
  await Promise.race([p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }), p.locator("form p.text-red-700").waitFor({ timeout: 15000 })]).catch(() => {});
  return new URL(p.url()).pathname.startsWith("/login") ? (await p.locator("form p.text-red-700").innerText().catch(() => "")) : "ok";
}

section("أ) القفل المؤقت بعد تكرار كلمة المرور الخاطئة");
let p = await newPage();
for (let i = 1; i <= 4; i++) {
  const r = await tryLogin(p, TEST, "wrong-pass-" + i);
  if (i === 4) check(r.includes("غير صحيحة"), "المحاولات 1–4: «غير صحيحة»", r);
}
check(sql(`select "failedLogins" from "User" where email='${TEST}'`) === "4", "عُدّت المحاولات الخاطئة");
let r = await tryLogin(p, TEST, "wrong-pass-5");
check(r.includes("أُوقف الدخول مؤقتاً"), "المحاولة الخامسة: قفل برسالة واضحة", r);
check(sql(`select "lockedUntil" > now() + interval '14 minutes' from "User" where email='${TEST}'`) === "t", "القفل 15 دقيقة");
r = await tryLogin(p, TEST, PW);
check(r.includes("أُوقف الدخول مؤقتاً"), "كلمة المرور الصحيحة لا تفتح الحساب أثناء القفل", r);
check(sql(`select count(*) from "AuditLog" where action='auth.locked' and "entityId"='sec_test_user'`) === "1", "القفل مسجّل في سجل التدقيق");
sql(`update "User" set "lockedUntil"=now() - interval '1 minute' where email='${TEST}'`);
r = await tryLogin(p, TEST, PW);
check(r === "ok", "بعد انتهاء القفل: الدخول يعمل", r);
check(sql(`select "failedLogins" from "User" where email='${TEST}'`) === "0", "الدخول الناجح يصفّر العدّاد");
await p.context().close();

r = await tryLogin(p = await newPage(), "no-such-user@example.sa", "whatever123");
check(r.includes("غير صحيحة"), "بريد غير مسجّل: الرسالة نفسها (لا يُكشف وجود الحسابات)", r);
await p.context().close();

section("ب) كلمة المرور المؤقتة وتغييرها");
sql(`update "User" set "mustChangePassword"=true where email='${TEST}'`);
p = await newPage();
await tryLogin(p, TEST, PW);
await p.waitForURL((u) => u.pathname === "/account", { timeout: 15000 }).catch(() => {});
check(new URL(p.url()).pathname === "/account", "تحويل إلزامي إلى صفحة الحساب", p.url());
check((await p.locator("main [role=alert]").innerText()).includes("كلمة مرور مؤقتة"), "تنبيه كلمة المرور المؤقتة");
await p.goto(B + "/department-head");
check(new URL(p.url()).pathname === "/account", "لا وصول لبقية الصفحات قبل التغيير", p.url());
await p.fill("#pw-current", PW);
await p.fill("#pw-new", "Qu@12345");
check((await p.getByText("شائعة").count()) === 1, "رفض كلمة مرور شائعة قبل الإرسال");
await p.fill("#pw-new", "Buraidah2026");
await p.fill("#pw-confirm", "Buraidah2027");
check((await p.getByText("غير متطابقتين").count()) === 1 && (await p.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }).isDisabled()), "عدم التطابق يمنع الحفظ");
await p.fill("#pw-confirm", "Buraidah2026");
await p.fill("#pw-current", "wrong-current-1");
await p.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }).click();
await p.getByText("كلمة المرور الحالية غير صحيحة").waitFor();
check(true, "كلمة المرور الحالية الخاطئة مرفوضة");
await p.fill("#pw-current", PW);
await p.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }).click();
await p.getByText("تم تغيير كلمة المرور بنجاح").waitFor();
check(sql(`select "mustChangePassword"::text || '|' || ("passwordChangedAt" is not null)::text from "User" where email='${TEST}'`) === "false|true", "حُفظت كلمة المرور الجديدة ورُفع شرط التغيير");
await p.goto(B + "/department-head");
check(new URL(p.url()).pathname === "/department-head", "بعد التغيير: الوصول طبيعي دون إعادة دخول", p.url());
await p.context().close();
p = await newPage();
check((await tryLogin(p, TEST, PW)).includes("غير صحيحة"), "كلمة المرور القديمة لم تعد تعمل");
check((await tryLogin(p, TEST, "Buraidah2026")) === "ok", "كلمة المرور الجديدة تعمل");
await p.context().close();

section("ج) المشرف المؤسسي: اعتماد يوم بلا انصراف، ورفض بسبب");
const today = "(now() at time zone 'Asia/Riyadh')::date";
const pl = sql(`select p.id, u.id, o.id from "Placement" p join "FieldSupervisorProfile" f on f.id=p."fieldSupervisorId" join "User" fu on fu.id=f."userId"
  join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" join "Organization" o on o.id=p."organizationId"
  where fu.email='field1@example.sa' and p.status='ACTIVE' order by s."universityId" limit 2`).split("\n").map((l) => l.split("|"));
for (const [pid, , oid] of pl) {
  sql(`update "AttendanceSheet" set "signedAt"=null where "organizationId"='${oid}' and "sheetDate"=${today}`);
  sql(`delete from "AttendanceRecord" where "placementId"='${pid}' and date=${today}`);
  sql(`insert into "AttendanceRecord" (id, "placementId", date, status, "checkInAt", "approvalStatus", "updatedAt") values ('sec_rec_${pid}', '${pid}', ${today}, 'PRESENT', now() - interval '3 hours', 'PENDING', now())`);
}
const [recA, recB] = pl.map(([pid]) => `sec_rec_${pid}`);
p = await newPage();
await tryLogin(p, "field1@example.sa", PW);
await p.goto(B + "/field-supervisor");
const rowA = p.locator(`[data-record="${recA}"]`);
check((await rowA.innerText()).includes("لم ينصرف"), "سجل اليوم بلا انصراف ظاهر");
check(await rowA.getByRole("button", { name: /^اعتماد / }).isEnabled() && await rowA.locator("input[type=checkbox]").isEnabled(), "زر الاعتماد ✓ والتحديد متاحان (كانا معطّلين)");
await rowA.getByRole("button", { name: /^اعتماد / }).click();
const dlg = p.getByRole("dialog");
check((await dlg.innerText()).includes("لم يُسجَّل الانصراف"), "نافذة تحديد مدة العمل");
await dlg.locator("#adj-hours").fill("3");
await dlg.locator("#adj-minutes").fill("30");
await dlg.getByRole("button", { name: /اعتماد 3س 30د/ }).click();
await dlg.waitFor({ state: "detached" });
check(sql(`select "approvalStatus"||'|'||"workedMinutes" from "AttendanceRecord" where id='${recA}'`) === "APPROVED|210", "اعتُمد بمدة 3س 30د");
const rowB = p.locator(`[data-record="${recB}"]`);
await rowB.getByRole("button", { name: /^رفض / }).click();
await p.getByRole("dialog").locator("#reject-note").fill("لم يحضر فعلياً في هذا اليوم");
await p.getByRole("dialog").getByRole("button", { name: "تأكيد الرفض" }).click();
await p.getByRole("dialog").waitFor({ state: "detached" });
check(sql(`select "approvalStatus"||'|'||coalesce("supervisorNote",'') from "AttendanceRecord" where id='${recB}'`) === "REJECTED|لم يحضر فعلياً في هذا اليوم", "رُفض مع السبب");
const stEmail = sql(`select u.email from "Placement" p join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" where p.id='${pl[1][0]}'`);
await p.context().close();
p = await newPage();
await tryLogin(p, stEmail, PW);
await p.goto(B + "/student/attendance");
check((await p.locator("main").innerText()).includes("ملاحظة المشرف: لم يحضر فعلياً في هذا اليوم"), "سبب الرفض يظهر للمتدرب في سجل حضوره");
await p.context().close();

section("د) ترويسات الأمان");
const res = await fetch(B + "/login");
const h = Object.fromEntries(["strict-transport-security", "x-frame-options", "x-content-type-options", "referrer-policy"].map((k) => [k, res.headers.get(k)]));
check(h["strict-transport-security"]?.includes("max-age=63072000") && h["x-frame-options"] === "DENY" && h["x-content-type-options"] === "nosniff", "HSTS وX-Frame-Options وnosniff", h);
const cookie = res.headers.getSetCookie?.().join(" ") ?? "";
const r401 = await fetch(B + "/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
check(r401.status === 401, "واجهة تغيير كلمة المرور تتطلب الدخول", r401.status);

sql(`delete from "AttendanceRecord" where id like 'sec_rec_%'`);
sql(`delete from "User" where email='${TEST}'`);
await browser.close();
console.log(`\n${fail ? "❌" : "✅"} ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
