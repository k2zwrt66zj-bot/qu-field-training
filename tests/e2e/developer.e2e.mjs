// =====================================================================
//  صفحة «عن المنصة والمطور» عبر المتصفح:
//  - رابط «عن المنصة والمطور» في القائمة الجانبية لجميع الأدوار (سطح المكتب وقائمة الجوال)
//  - محتوى الصفحة: البطاقة الشخصية، رؤية المنصة، حقوق الملكية بنصها المعتمد، أزرار التواصل
//  - سطر التذييل في صفحات المنصة وصفحة الدخول، والبيانات الوصفية (author/creator/publisher)
//  التشغيل: npm run test:e2e:developer   (لقطات الشاشة: SHOTS=مجلد)
// =====================================================================
import { chromium } from "playwright";

const B = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SHOTS = process.env.SHOTS;
const IP = "هذا النظام مصنف ومحمي. جميع حقوق الملكية الفكرية، التصميم، والكود المصدري محفوظة للمطور عبدالملك عواض العتيبي © 2026";
const CREDIT = "تم التطوير بواسطة عبدالملك العتيبي © 2026";
const AUTHOR = "Abdalmalik Awad Al-Otaibi";
const LINK = "عن المنصة والمطور";

let pass = 0, fail = 0;
const check = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
};
const section = (t) => console.log(`\n${t}`);
const shot = async (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const browser = await chromium.launch(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {});
async function login(email, viewport = { width: 1366, height: 900 }) {
  const p = await (await browser.newContext({ viewport, locale: "ar-SA" })).newPage();
  p.on("pageerror", (e) => { fail++; console.log(`  ✗ خطأ JavaScript (${email}): ${e.message}`); });
  await p.goto(B + "/login");
  await p.fill("#email", email); await p.fill("#password", "Qu@12345"); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return p;
}

section("أ) صفحة الدخول والبيانات الوصفية");
{
  const p = await (await browser.newContext()).newPage();
  await p.goto(B + "/login");
  check((await p.getByText(CREDIT, { exact: true }).count()) === 1, "سطر التذييل في صفحة الدخول");
  for (const name of ["author", "creator", "publisher"]) {
    check((await p.locator(`meta[name=${name}]`).getAttribute("content")) === AUTHOR, `metadata: ${name} = ${AUTHOR}`);
  }
  await p.goto(B + "/developer");
  check(new URL(p.url()).pathname === "/login" && new URL(p.url()).searchParams.get("callbackUrl") === "/developer", "الصفحة تتطلب الدخول (callbackUrl نسبي)", p.url());
  await p.context().close();
}

section("ب) الرابط في القائمة الجانبية لجميع الأدوار");
const ROLES = {
  STUDENT: "441100001@qu.edu.sa",
  FIELD_SUPERVISOR: "field1@example.sa",
  ACADEMIC_SUPERVISOR: "academic1@qu.edu.sa",
  TRAINING_HEAD: "bushra.aldubaikhi@qu.edu.sa",
  DEPARTMENT_HEAD: "omar.alnamlah@qu.edu.sa",
  ADMIN: "admin@qu.edu.sa",
};
for (const [role, email] of Object.entries(ROLES)) {
  const p = await login(email);
  const link = p.locator("aside").getByRole("link", { name: LINK });
  await p.locator("aside nav a").first().waitFor();
  check((await link.count()) === 1, `${role}: الرابط في القائمة الجانبية`);
  check((await p.locator("footer").getByText(CREDIT, { exact: true }).count()) === 1, `${role}: سطر التذييل أسفل الصفحة`);
  await link.click();
  await p.waitForURL((u) => u.pathname === "/developer");
  check((await p.locator("h1").innerText()).trim() === "عبدالملك عواض العتيبي", `${role}: تفتح صفحة المطور`);
  check((await link.getAttribute("class")).includes("font-semibold"), `${role}: الرابط مميّز كصفحة حالية`);
  if (role === "STUDENT") {
    check((await p.getByText("مؤسس ومطور المنصة (Founder & Lead Developer)").count()) === 1, "المسمى: مؤسس ومطور المنصة (Founder & Lead Developer)");
    check((await p.getByRole("heading", { name: "رؤية المنصة" }).count()) === 1, "قسم رؤية المنصة");
    check((await p.getByText("حلٌّ سحابي مبتكر ومستدام لأتمتة التدريب الميداني").count()) === 1, "نص الرؤية");
    check((await p.getByTestId("ip-notice").innerText()).trim() === IP, "حقوق الملكية بنصها المعتمد");
    check((await p.getByText("البريد الإلكتروني").count()) === 1 && (await p.getByText("لينكدإن").count()) === 1, "زرا التواصل: البريد وLinkedIn");
    await shot(p, "developer-desktop");
    // الصفحة بلا روابط خارجية غير مضبوطة (البريد وLinkedIn يُضبطان من البيئة)
    const hrefs = await p.locator("main a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    check(hrefs.every((h) => h.startsWith("/") || h.startsWith("mailto:") || h.startsWith("https://")), "روابط الصفحة صالحة", hrefs);
  }
  await p.context().close();
}

section("ج) الجوال (PWA)");
{
  const p = await login("441100025@qu.edu.sa", { width: 390, height: 844 });
  const bottom = await p.locator("nav.fixed a").allInnerTexts();
  check(!bottom.some((l) => l.includes(LINK)), "الشريط السفلي للجوال بلا تغيير (أدوار الطالب فقط)", bottom);
  await p.getByRole("button", { name: "القائمة" }).click();
  const drawer = p.getByRole("dialog");
  check((await drawer.getByText(CREDIT).count()) === 1, "سطر التذييل في قائمة الجوال");
  await shot(p, "developer-mobile-drawer");
  await drawer.getByRole("link", { name: LINK }).click();
  await p.waitForURL((u) => u.pathname === "/developer");
  check((await p.getByRole("dialog").count()) === 0, "القائمة تُغلق بعد الانتقال");
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, "لا تمرير أفقي على شاشة 390px", overflow);
  const footer = p.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  const fb = await footer.getByText(CREDIT).boundingBox();
  const nb = await p.locator("nav.fixed").boundingBox();
  check(fb.y + fb.height <= nb.y, "التذييل لا يختفي خلف الشريط السفلي", { footer: fb, nav: nb });
  await shot(p, "developer-mobile");
  await p.context().close();
}

await browser.close();
console.log(`\nالنتيجة: ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
