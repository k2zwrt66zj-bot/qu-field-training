// =====================================================================
//  بروفة العرض: رحلة عبدالملك العتيبي من أول دخول حتى اعتماد المباشرة
//  (npm run demo:accounts قبلها وبعدها: تعيد الرحلة إلى البداية)
//  التشغيل (والخادم يعمل): npm run test:e2e:demo     — لقطات: SHOTS=مجلد
// =====================================================================
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const B = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SHOTS = process.env.SHOTS;
const ST = "441100100@qu.edu.sa", FS = "field1@example.sa", AC = "nahes.alomari@qu.edu.sa", AC2 = "alameen.albasheer@qu.edu.sa";

let pass = 0, fail = 0;
const check = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
};
const section = (t) => console.log(`\n${t}`);
const shot = async (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const text = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).trim() : "");
const badge = (p) => p.locator("header .rounded-full").allInnerTexts().then((a) => a.join(" | "));

execSync("npm run -s demo:accounts", { stdio: "ignore" });
const browser = await chromium.launch(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {});
async function as(email, viewport = { width: 1366, height: 900 }) {
  const p = await (await browser.newContext({ viewport, locale: "ar-SA" })).newPage();
  p.on("pageerror", (e) => { fail++; console.log(`  ✗ خطأ JavaScript (${email}): ${e.message}`); });
  await p.goto(B + "/login"); await p.fill("#email", email); await p.fill("#password", "Qu@12345"); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login") && u.pathname !== "/", { timeout: 20000 });
  await p.locator("header").first().waitFor();
  return p;
}
async function draw(p, canvas) {
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox();
  await p.mouse.move(b.x + 30, b.y + 40); await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(b.x + 30 + i * 22, b.y + 40 + (i % 2) * 35, { steps: 2 });
  await p.mouse.up();
}
async function act(p, label) {
  await p.getByRole("button", { name: label, exact: true }).first().click();
  const dlg = p.getByRole("dialog"); await dlg.waitFor();
  for (const c of await dlg.locator("canvas").all()) await draw(p, c);
  if (await dlg.locator("#director-name").count()) { if (!(await dlg.locator("#director-name").inputValue())) await dlg.locator("#director-name").fill("أ. سعد المدير"); }
  await dlg.getByRole("button", { name: label, exact: true }).click();
  await dlg.waitFor({ state: "detached", timeout: 15000 });
}

section("أ) أول دخول للطالب عبدالملك العتيبي");
const st = await as(ST);
const stMobile = await as(ST, { width: 390, height: 844 });
await shot(stMobile, "demo-01-student-home-mobile");
await stMobile.context().close();
check((await text(st.locator("header"))).includes("عبدالملك العتيبي"), "الاسم في الشريط العلوي");
await shot(st, "demo-01-student-home");
await st.goto(B + "/portfolio");
check((await text(st.getByLabel("الخطوات التالية"))).includes("ابدأ بنموذج مباشرة التدريب"), "الخطوة الأولى: نموذج المباشرة");
check((await text(st.locator('[data-kind="SKILLS_LOG"]'))).includes("بعد اعتماد نموذج المباشرة"), "بقية النماذج مقفلة حتى المباشرة");
check((await st.locator("dl").first().innerText()).includes("441100100"), "بيانات الطالب من الإسناد");
await shot(st, "demo-02-portfolio-first-time");

section("ب) نموذج المباشرة ورفعه بتوقيع الطالب");
await st.locator('[data-kind="COMMENCEMENT"]').getByRole("button", { name: "إنشاء" }).click();
await st.waitForURL(/\/forms\//);
await st.getByRole("radiogroup", { name: "يوم التدريب الثابت" }).getByRole("radio", { name: "الثلاثاء" }).click();
await st.getByRole("radio", { name: "فترة صباحية" }).click();
await st.locator("#f-declarationAccepted").check();
await st.getByText("حُفظت كل التعديلات").last().waitFor({ timeout: 15000 });
await shot(st, "demo-03-commencement-draft");
await act(st, "رفع النموذج");
check((await badge(st)).includes("بانتظار توقيع المشرف المؤسسي"), "رُفع بتوقيع الطالب");

section("ج) المشرف المؤسسي يوقّع مع مدير المؤسسة");
const fs = await as(FS);
await fs.goto(B + "/queue");
const card = fs.locator('[data-student="441100100"]');
check((await text(card)).includes("مباشرة"), "المباشرة في قائمة اعتماد المشرف المؤسسي");
await card.getByRole("link", { name: /مباشرة/ }).click();
await fs.waitForURL(/\/forms\//);
await act(fs, "توقيع المشرف المؤسسي واعتماده");
check((await badge(fs)).includes("موقّع — بانتظار الاعتماد الأكاديمي"), "وُقّع من المشرف ومدير المؤسسة");
await shot(fs, "demo-04-signed");

section("د) المشرف الأكاديمي ناهس عائض العمري");
const ac = await as(AC);
check((await text(ac.locator("header"))).includes("ناهس عائض العمري"), "الاسم في الشريط العلوي");
await ac.goto(B + "/academic-supervisor");
check((await text(ac.locator("main"))).includes("عبدالملك العتيبي"), "عبدالملك ضمن طلابه");
await ac.goto(B + "/queue");
const acCard = ac.locator('[data-student="441100100"]');
await acCard.getByRole("link", { name: /مباشرة/ }).click();
await ac.waitForURL(/\/forms\//);
await act(ac, "اعتماد المشرف الأكاديمي");
check((await badge(ac)).includes("معتمد"), "اعتماد المباشرة");

section("هـ) الطالب بعد اعتماد المباشرة");
await st.goto(B + "/portfolio");
check((await text(st.getByLabel("الخطوات التالية"))).includes("التقرير التعريفي"), "الخطوة التالية: التقرير التعريفي");
check(!(await text(st.locator('[data-kind="SKILLS_LOG"]'))).includes("بعد اعتماد نموذج المباشرة"), "فُتحت بقية النماذج");
await shot(st, "demo-05-portfolio-after-commencement");

section("و) المشرف الأكاديمي الأمين محمد البشير");
const ac2 = await as(AC2);
check((await text(ac2.locator("header"))).includes("الأمين محمد البشير"), "الدخول والاسم في الشريط العلوي");
await ac2.goto(B + "/queue");
check((await text(ac2.locator("h1"))) === "قائمة الاعتماد", "قائمة الاعتماد تعمل");

await browser.close();
execSync("npm run -s demo:accounts", { stdio: "ignore" });
console.log("\n(أُعيدت رحلة عبدالملك إلى البداية بعد البروفة)");
console.log(`\n${fail ? "❌" : "✅"} ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
