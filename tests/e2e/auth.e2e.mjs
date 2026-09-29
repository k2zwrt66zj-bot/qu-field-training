// =====================================================================
//  اختبار المصادقة والجلسات عبر المتصفح:
//  - فتح المنصة من نطاق يختلف عن NEXTAUTH_URL (127.0.0.1 بدل localhost): الدخول والخروج يبقيان على النطاق نفسه
//  - الجلسة 30 يوماً بكوكي HttpOnly وSameSite=Lax، وتمتد تلقائياً مع كل تحديث للجلسة
//  - لا إعادة توجيه مفتوحة عبر callbackUrl
//  - إيقاف الحساب يُنهي الجلسة القائمة (يتطلب خادماً بـ AUTH_USER_RECHECK_SECONDS=0 للتحقق الفوري)
//  التشغيل: AUTH_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:auth
// =====================================================================
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const B = process.env.AUTH_BASE_URL ?? "http://127.0.0.1:3000";
const ORIGIN = new URL(B).origin;
const DB = (process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/qu_field_training").split("?")[0];
const sql = (q) => execSync(`psql "${DB}" -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const DAY = 86_400;

let pass = 0, fail = 0;
const check = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
};
const section = (t) => console.log(`\n${t}`);

const browser = await chromium.launch(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {});
async function login(ctx, email, path = "/login") {
  const p = await ctx.newPage();
  await p.goto(B + path);
  await p.fill("#email", email); await p.fill("#password", "Qu@12345"); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return p;
}
const sessionCookie = async (ctx) => (await ctx.cookies()).find((c) => c.name.endsWith("next-auth.session-token"));

section(`أ) نطاق مختلف عن NEXTAUTH_URL (${process.env.NEXTAUTH_URL ?? "—"}) ← ${ORIGIN}`);
let ctx = await browser.newContext();
let p = await login(ctx, "441100001@qu.edu.sa");
check(new URL(p.url()).origin === ORIGIN, `بعد الدخول: البقاء على ${ORIGIN}`, p.url());
const c1 = await sessionCookie(ctx);
check(!!c1, "كوكي الجلسة موجود");
const days = (c1.expires - Date.now() / 1000) / DAY;
check(days > 29.9 && days <= 30.01, `صلاحية الجلسة 30 يوماً (${days.toFixed(2)})`);
check(c1.httpOnly && c1.sameSite === "Lax", `HttpOnly وSameSite=Lax (${c1.sameSite})`);

section("ب) التحديث التلقائي للجلسة (جلسة منزلقة)");
const r = await p.request.get(B + "/api/auth/session");
const s = await r.json();
check(r.ok() && s.user?.role === "STUDENT", "/api/auth/session يعيد الجلسة");
check(((new Date(s.expires).getTime() - Date.now()) / 1000 / DAY) > 29.9, "انتهاء الجلسة بعد 30 يوماً من آخر تحديث");
check(/next-auth\.session-token=/.test(r.headers()["set-cookie"] ?? ""), "كل تحديث يعيد إصدار الكوكي بصلاحية جديدة");

section("ج) تسجيل الخروج إلى /login على النطاق نفسه");
await p.goto(B + "/portfolio");
await p.getByRole("button", { name: "خروج" }).click();
await p.waitForURL((u) => u.pathname === "/login", { timeout: 20000 });
check(p.url() === `${ORIGIN}/login`, `الخروج إلى ${ORIGIN}/login على نطاق الطلب نفسه`, p.url());
check(!(await sessionCookie(ctx)), "حُذف كوكي الجلسة");
await p.goto(B + "/portfolio");
await p.waitForURL((u) => u.pathname === "/login");
check(new URL(p.url()).origin === ORIGIN && new URL(p.url()).searchParams.get("callbackUrl") === "/portfolio", "بعد الخروج: الصفحات المحمية تحوّل إلى /login على النطاق نفسه مع callbackUrl نسبي", p.url());
await ctx.close();

section("د) كلمة مرور خاطئة: رسالة واضحة دون مغادرة النطاق");
ctx = await browser.newContext();
p = await ctx.newPage();
await p.goto(B + "/login");
await p.fill("#email", "441100001@qu.edu.sa"); await p.fill("#password", "wrong-pass"); await p.click("button[type=submit]");
await p.getByText("البريد الإلكتروني أو كلمة المرور غير صحيحة").waitFor({ timeout: 15000 });
check(p.url() === `${ORIGIN}/login` && !(await sessionCookie(ctx)), "رسالة الخطأ على الصفحة نفسها وبلا جلسة", p.url());
await ctx.close();

section("هـ) العودة بعد الدخول إلى الصفحة المطلوبة، ولا إعادة توجيه مفتوحة");
ctx = await browser.newContext();
p = await login(ctx, "441100001@qu.edu.sa", "/login?callbackUrl=%2Fportfolio");
check(p.url() === `${ORIGIN}/portfolio`, "callbackUrl نسبي: العودة إلى /portfolio", p.url());
await ctx.close();
ctx = await browser.newContext();
p = await login(ctx, "441100001@qu.edu.sa", `/login?callbackUrl=${encodeURIComponent("https://evil.example/phish")}`);
check(new URL(p.url()).origin === ORIGIN, "callbackUrl خارجي لا يُخرج المستخدم من المنصة", p.url());
await ctx.close();

section("و) إيقاف الحساب يُنهي الجلسة القائمة");
ctx = await browser.newContext();
p = await login(ctx, "441100002@qu.edu.sa");
sql(`update "User" set "isActive"=false where email='441100002@qu.edu.sa'`);
try {
  const after = await (await p.request.get(B + "/api/auth/session")).json();
  check(!after?.user, "الجلسة أُلغيت بعد إيقاف الحساب", after);
  await p.goto(B + "/portfolio");
  await p.waitForURL((u) => u.pathname === "/login", { timeout: 20000 });
  check(true, "الحساب الموقوف يُحوَّل إلى صفحة الدخول");
} finally {
  sql(`update "User" set "isActive"=true where email='441100002@qu.edu.sa'`);
}
await ctx.close();

await browser.close();
console.log(`\n${fail ? "❌" : "✅"} ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
