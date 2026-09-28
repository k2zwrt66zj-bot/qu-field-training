// =====================================================================
//  اختبار الواجهات عبر المتصفح لكل الأطراف: السجل المهني، شاشة النموذج، قوائم الاعتماد،
//  نظرة الاختناقات، مسار المحاكاة، والتحول من السجلات القديمة
//  المتطلبات: خادم يعمل (npm run build && npm start) + بيانات تجريبية حديثة مع الترحيل:
//             npm run db:seed && npm run db:migrate-legacy -- --apply
//  التشغيل:   npm run test:e2e:ui   (SCREENSHOT_DIR=… لحفظ لقطات الشاشة)
// =====================================================================
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const B = process.env.BASE_URL ?? "http://localhost:3000";
const DB = (process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/qu_field_training").split("?")[0];
const SHOTS = process.env.SCREENSHOT_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sql = (q) => execSync(`psql "${DB}" -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const words = (n, w = "كلمة") => Array.from({ length: n }, (_, i) => `${w}${i}`).join(" ");

let pass = 0, fail = 0;
const check = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ""); }
};
const section = (t) => console.log(`\n${t}`);

const browser = await chromium.launch(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {});
const sessions = {};
async function as(email, viewport = { width: 1366, height: 900 }) {
  const key = `${email}@${viewport.width}`;
  if (sessions[key]) return sessions[key];
  const p = await (await browser.newContext({ viewport, locale: "ar-SA" })).newPage();
  p.on("pageerror", (e) => { fail++; console.log(`  ✗ خطأ JavaScript في الصفحة (${email}): ${e.message}`); });
  await p.goto(B + "/login"); await p.fill("#email", email); await p.fill("#password", "Qu@12345"); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return (sessions[key] = p);
}
const shot = async (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const text = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).trim() : "");
const navLabels = async (p) => {
  await p.locator("aside nav a").first().waitFor();
  return (await p.locator("aside nav a").allInnerTexts()).map((s) => s.trim());
};
/** الشريط الجانبي لشاشة النموذج (لا الشريط الجانبي للتطبيق) */
const panel = (p) => p.locator("main aside");
const kinds = (p) => p.locator("[data-kind]").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));

/** يرسم توقيعاً على لوحة التوقيع */
async function draw(p, canvas) {
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox();
  await p.mouse.move(b.x + 30, b.y + 40);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(b.x + 30 + i * 22, b.y + 40 + (i % 2) * 35, { steps: 2 });
  await p.mouse.up();
}
/** يفتح إجراءً من الشريط الجانبي، ويوقّع كل لوحات النافذة، ويكتب الملاحظة إن طُلبت، ثم يؤكد */
async function act(p, label, { comment } = {}) {
  await p.getByRole("button", { name: label, exact: true }).first().click();
  const dlg = p.getByRole("dialog");
  await dlg.waitFor();
  const pads = dlg.locator("canvas");
  for (let i = 0; i < (await pads.count()); i++) await draw(p, pads.nth(i));
  if (comment) await dlg.locator("#action-comment").fill(comment);
  const confirm = dlg.getByRole("button", { name: label, exact: true });
  await confirm.click();
  await dlg.waitFor({ state: "detached", timeout: 15000 });
}
const badge = (p) => p.locator("header .rounded-full").allInnerTexts().then((a) => a.join(" | "));

// =====================================================================
section("أ) طالب ميداني: السجل المهني قبل المباشرة");
const TH = "abdullah.altijani@qu.edu.sa", DH = "omar.alnamlah@qu.edu.sa";
const th = await as(TH);
const termId = sql(`select id from "AcademicTerm" where "isActive"`);
const assigned = await th.request.post(B + "/api/placements/auto-assign", { data: { termId, dryRun: false } });
check(assigned.ok(), "التوزيع الآلي لطالب جديد");
const NEW = "441100006@qu.edu.sa";
const [plId, FS, AC] = sql(`select p.id, fu.email, au.email from "Placement" p join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" join "FieldSupervisorProfile" f on f.id=p."fieldSupervisorId" join "User" fu on fu.id=f."userId" join "AcademicSupervisorProfile" a on a.id=p."academicSupervisorId" join "User" au on au.id=a."userId" where u.email='${NEW}'`).split("|");
check(sql(`select status from "Placement" where id='${plId}'`) === "ASSIGNED", `إسناد جديد بانتظار المباشرة (المشرف المؤسسي ${FS})`);

const st = await as(NEW);
const nav = await navLabels(st);
check(nav.includes("السجل المهني") && nav.includes("التحضير الميداني") && !nav.some((l) => l.includes("السجلات اليومية") || l.includes("التقارير الميدانية")), "قائمة الطالب: السجل المهني بدل الصفحات القديمة", nav);
await st.goto(B + "/portfolio");
check((await text(st.locator("h1"))) === "السجل المهني للتدريب الميداني", "غلاف السجل المهني للتدريب الميداني");
check(JSON.stringify(await kinds(st)) === JSON.stringify(["COMMENCEMENT", "ORGANIZATION_PROFILE", "TRAINING_PLAN", "SKILLS_LOG", "GROUP_PROGRAM", "COMMUNITY_PROGRAM", "QUICK_SITUATION", "CASE_STUDY", "INTERVIEW", "READING"]), "النماذج العشرة بترتيب الدليل الرسمي", await kinds(st));
check((await text(st.locator('[data-kind="SKILLS_LOG"]'))).includes("بعد اعتماد نموذج المباشرة"), "بقية النماذج مقفلة حتى اعتماد المباشرة");
check((await text(st.getByLabel("الخطوات التالية"))).includes("ابدأ بنموذج مباشرة التدريب"), "الخطوة التالية: المباشرة");
check((await text(st.locator("dl").first())).includes("441100006"), "بيانات المتدرب/ـة من الإسناد");
await shot(st, "01-portfolio-field-before-commencement");

// =====================================================================
section("ب) نموذج المباشرة: تعبئة وحفظ تلقائي ورفع بتوقيع الطالب");
await st.locator('[data-kind="COMMENCEMENT"]').getByRole("button", { name: "إنشاء" }).click();
await st.waitForURL(/\/forms\//);
const cmId = st.url().split("/forms/")[1];
check((await badge(st)).includes("مسودة"), "نموذج جديد بحالة مسودة");
await st.getByRole("radiogroup", { name: "يوم التدريب الثابت" }).getByRole("radio", { name: "الثلاثاء" }).click();
await st.getByRole("radio", { name: "فترة مسائية" }).click();
await st.locator("#f-declarationAccepted").check();
await st.getByText("حُفظت كل التعديلات").waitFor({ timeout: 15000 });
check(sql(`select "fixedTrainingDay"||'|'||shift||'|'||"declarationAccepted" from "CommencementForm" where "formId"='${cmId}'`) === "2|EVENING|true", "الحفظ التلقائي وصل إلى القاعدة");
check((await text(panel(st))).includes("100%"), "اكتمال المتطلبات 100%");
await shot(st, "02-form-commencement-draft");
await act(st, "رفع النموذج");
check((await badge(st)).includes("بانتظار توقيع المشرف المؤسسي"), "رُفع بتوقيع الطالب");
check(sql(`select count(*) from "FormSignature" where "formId"='${cmId}' and slot='STUDENT'`) === "1", "توقيع الطالب محفوظ مع البصمة");
check((await st.getByRole("button", { name: "رفع النموذج" }).count()) === 0 && (await st.locator("#f-declarationAccepted").count()) === 0, "بعد الرفع: عرض فقط");

// =====================================================================
section("ج) قائمة اعتماد المشرف المؤسسي: التوقيع مع مدير المؤسسة");
const fs = await as(FS);
const fsNav = await navLabels(fs);
check(fsNav.includes("قائمة الاعتماد") && !fsNav.some((l) => l.includes("السجلات والتقارير")), "قائمة المشرف المؤسسي محدّثة", fsNav);
await fs.goto(B + "/queue");
check((await text(fs.locator("h1"))) === "قائمة الاعتماد", "صفحة قائمة الاعتماد");
const card = fs.locator('[data-student="441100006"]');
check((await text(card)).includes("مباشرة الطالب/ـة"), "المباشرة تظهر مجمّعة تحت اسم الطالب");
await shot(fs, "03-queue-field-supervisor");
await card.getByRole("link", { name: /مباشرة/ }).click();
await fs.waitForURL(/\/forms\//);
check((await fs.getByRole("button", { name: "إعادة من المشرف المؤسسي" }).count()) === 1, "زر الإعادة متاح للمشرف المؤسسي");
await fs.getByRole("button", { name: "توقيع المشرف المؤسسي واعتماده", exact: true }).click();
const dlg = fs.getByRole("dialog");
check((await dlg.locator("canvas").count()) === 2 && (await dlg.locator("#director-name").count()) === 1, "نافذة التوقيع: المشرف + مدير المؤسسة");
if (!(await dlg.locator("#director-name").inputValue())) await dlg.locator("#director-name").fill("أ. سعد المدير");
await shot(fs, "04-sign-dialog");
for (const c of await dlg.locator("canvas").all()) await draw(fs, c);
await dlg.getByRole("button", { name: "توقيع المشرف المؤسسي واعتماده", exact: true }).click();
await dlg.waitFor({ state: "detached", timeout: 15000 });
check((await badge(fs)).includes("موقّع — بانتظار الاعتماد الأكاديمي"), "وُقّع ثلاثياً");
check(sql(`select status from "Placement" where id='${plId}'`) === "ACTIVE", "المباشرة فعّلت التدريب");
await fs.goto(B + "/queue");
check((await fs.locator('[data-student="441100006"]').count()) === 0, "خرج من قائمة المشرف المؤسسي");

// =====================================================================
section("د) قائمة الاعتماد الأكاديمي");
const ac = await as(AC);
await ac.goto(B + "/queue");
const acCard = ac.locator('[data-student="441100006"]');
check((await text(acCard)).includes("مباشرة"), "المباشرة الموقّعة تنتظر المشرف الأكاديمي");
await acCard.getByRole("link", { name: /مباشرة/ }).click();
await ac.waitForURL(/\/forms\//);
await act(ac, "اعتماد المشرف الأكاديمي");
check((await badge(ac)).includes("معتمد"), "اعتماد أكاديمي");

// =====================================================================
section("هـ) سجل المهارات: النواقص قبل الرفع، ثم إعادة بملاحظة");
await st.goto(B + "/portfolio");
check((await text(st.getByLabel("الخطوات التالية"))).includes("التقرير التعريفي"), "الخطوة التالية بعد المباشرة: التقرير التعريفي");
await st.locator('[data-kind="SKILLS_LOG"]').getByRole("button", { name: "جديد" }).click();
await st.waitForURL(/\/forms\//);
const slId = st.url().split("/forms/")[1];
await st.getByRole("button", { name: "رفع النموذج", exact: true }).click();
await st.getByRole("button", { name: "إخفاء النواقص" }).waitFor({ timeout: 10000 });
check((await st.getByRole("dialog").count()) === 0, "لا تُفتح نافذة الرفع والنموذج ناقص");
check((await panel(st).locator("ul li").count()) > 0, "قائمة النواقص تظهر بروابط إلى الحقول");
await shot(st, "05-form-missing-requirements");
const patch = await st.request.patch(B + `/api/forms/${slId}`, { data: { data: { topics: ["حضور لجنة الحالات", "مقابلة أولية"], skillsNarrative: words(60, "مهارة"), knowledgeNarrative: words(60, "معرفة"), difficulties: words(25, "صعوبة") } } });
check(patch.ok(), "تعبئة المحتوى", await patch.text().catch(() => ""));
await st.reload();
check((await text(panel(st))).includes("100%"), "اكتملت المتطلبات");
await act(st, "رفع النموذج");
check((await badge(st)).includes("بانتظار توقيع المشرف المؤسسي"), "رُفع سجل المهارات");
await fs.goto(B + `/forms/${slId}`);
await act(fs, "إعادة من المشرف المؤسسي", { comment: "وضّح المهارات المهنية بأمثلة من يومك التدريبي" });
check((await badge(fs)).includes("معاد للتعديل"), "أعاده المشرف المؤسسي");
await st.goto(B + "/portfolio");
const back = st.getByLabel("الخطوات التالية").getByRole("link", { name: /أُعيد إليك/ });
check((await back.count()) === 1, "الطالب يرى الإعادة كخطوة تالية مع رابط");
await back.click();
await st.waitForURL(/\/forms\//);
check((await text(st.locator("body"))).includes("وضّح المهارات المهنية"), "ملاحظة الإعادة ظاهرة في النموذج");
check((await st.getByRole("button", { name: "رفع النموذج", exact: true }).count()) === 1, "يمكن تعديله وإعادة رفعه");
await act(st, "رفع النموذج");
check((await badge(st)).includes("بانتظار توقيع المشرف المؤسسي"), "أُعيد رفعه بعد التعديل");

// =====================================================================
section("و) التدريب بالمحاكاة");
const SIM = "441100025@qu.edu.sa";
const sim = await as(SIM, { width: 390, height: 844 });
await sim.goto(B + "/student");
check((await sim.getByRole("link", { name: "السجل المهني" }).count()) > 0 && (await sim.getByRole("link", { name: /التحضير الآن/ }).count()) === 0, "الرئيسية: السجل المهني بدل التحضير");
await shot(sim, "06-student-home-simulation-mobile");
const simNav = await sim.locator("nav.fixed a").allInnerTexts();
check(!simNav.some((l) => l.includes("التحضير")), "لا رابط تحضير في قائمة الجوال", simNav);
await sim.goto(B + "/student/attendance");
check(new URL(sim.url()).pathname === "/portfolio", "صفحة التحضير تحوّل إلى السجل المهني");
check((await text(sim.locator("h1"))) === "السجل المهني للتدريب الميداني بالمحاكاة", "غلاف السجل المهني بالمحاكاة");
const simKinds = await kinds(sim);
check(!simKinds.includes("COMMENCEMENT") && !simKinds.includes("ORGANIZATION_PROFILE") && simKinds.length === 8, "بلا مباشرة ولا تقرير تعريفي (8 نماذج)", simKinds);
check((await sim.getByText("سجل الحضور والانصراف").count()) === 0, "لا سجل حضور في سجل المحاكاة");
check((await sim.locator('[data-kind="QUICK_SITUATION"]').getByRole("button").count()) === 2, "الموقف السريع: اختيار المدرسة أو المستشفى");
await shot(sim, "07-portfolio-simulation-mobile");
await sim.locator('[data-kind="READING"]').getByRole("button", { name: "جديد" }).click();
await sim.waitForURL(/\/forms\//);
check((await text(sim.locator("body"))).includes("التدريب الميداني بالمحاكاة"), "النموذج يعرض مسار المحاكاة");
check(!(await text(sim.getByLabel("مسار النموذج"))).includes("توقيع المشرف المؤسسي"), "مسار النموذج بلا خطوة المشرف المؤسسي");
await shot(sim, "08-form-reading-simulation-mobile");

// =====================================================================
section("ز) التحول: الأرشيف والروابط القديمة والمسارات المتوقفة");
const S1 = "441100001@qu.edu.sa";
const s1 = await as(S1);
await s1.goto(B + "/portfolio");
const archive = s1.locator("section", { has: s1.locator("#archive-heading") });
const archived = await archive.getByRole("link").count();
check(archived === Number(sql(`select count(*) from "FieldForm" f join "Placement" p on p.id=f."placementId" join "StudentProfile" s on s.id=p."studentId" where s."universityId"='441100001' and f.data->'_legacy' is not null`)) && archived > 0, `الأرشيف يعرض السجلات المرحَّلة (${archived})`);
await s1.goto(B + "/student/logbooks");
check(new URL(s1.url()).pathname === "/portfolio", "الرابط القديم للسجلات يحوّل إلى السجل المهني");
const [legacyReport, reportOwner] = sql(`select r.id, u.email from "FieldReport" r join "Placement" p on p.id=r."placementId" join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" order by r."createdAt" limit 1`).split("|");
const owner = await as(reportOwner);
await owner.goto(B + `/student/reports/${legacyReport}`);
const migratedId = sql(`select id from "FieldForm" where data->'_legacy'->>'id'='${legacyReport}'`);
check(owner.url().endsWith(`/forms/${migratedId}`), "رابط تقرير قديم يحوّل إلى النموذج المرحَّل");
check((await owner.locator("header h1").count()) === 1, "النموذج المرحَّل يُعرض");
// ما كان قيد المراجعة عند التحول يُستكمل من قائمة الاعتماد الجديدة
const [pendingLegacy, legacyFs] = sql(`select f.id, fu.email from "FieldForm" f join "Placement" p on p.id=f."placementId" join "FieldSupervisorProfile" fp on fp.id=p."fieldSupervisorId" join "User" fu on fu.id=fp."userId" where f.data->'_legacy' is not null and f.status='SUBMITTED' order by f."submittedAt" limit 1`).split("|");
if (pendingLegacy) {
  const lf = await as(legacyFs);
  await lf.goto(B + "/queue?kind=LEGACY");
  const rows = lf.locator(`a[href="/forms/${pendingLegacy}"]`);
  check((await rows.count()) === 1 && (await text(rows)).includes("مرحّل"), "السجل المرحَّل المعلّق يظهر في قائمة المشرف بشارة «مرحّل»");
  await rows.first().click();
  await lf.waitForURL(/\/forms\//);
  await act(lf, "توقيع المشرف المؤسسي واعتماده");
  check(sql(`select status from "FieldForm" where id='${pendingLegacy}'`) === "SIGNED", "استكمال توقيع سجل مرحَّل بعد التحول");
}
const gone = await s1.request.post(B + "/api/logbooks", { data: {} });
check(gone.status() === 410, "الكتابة على السجلات القديمة متوقفة (410)");
const gone2 = await s1.request.post(B + "/api/reports", { data: {} });
check(gone2.status() === 410, "إنشاء تقرير قديم متوقف (410)");

// =====================================================================
section("ح) نظرة الاختناقات لرئيس الوحدة ورئيس القسم");
await th.goto(B + "/queue");
check((await text(th.locator("h1"))) === "متابعة الاعتماد", "صفحة متابعة الاعتماد");
const thBody = await text(th.locator("main"));
check(thBody.includes("بانتظار المشرف المؤسسي") && thBody.includes("المعلّق حسب المشرف") && thBody.includes("مدة الانتظار"), "بطاقات المؤشرات وجداول الاختناق");
const fsName = sql(`select "fullName" from "User" where email='${FS}'`);
check(thBody.includes("نموذج تسجيل المهارات والمعارف الأسبوعية") && thBody.includes(fsName), `المعلّق يظهر مع المشرف المسؤول (${fsName})`);
await shot(th, "09-queue-overview-training-head");
const chips = th.getByRole("navigation", { name: "تصفية حسب النموذج" });
await chips.getByRole("link", { name: /سجلات مرحّلة/ }).click();
await th.waitForURL(/kind=LEGACY/);
const legacyRows = th.locator("main a[href^='/forms/']");
const legacyTexts = await legacyRows.allInnerTexts();
check(legacyTexts.length > 0 && legacyTexts.every((t) => t.includes("مرحّل")), `التصفية: السجلات المرحَّلة وحدها (${legacyTexts.length})`);
await chips.getByRole("link", { name: /نموذج تسجيل المهارات/ }).click();
await th.waitForURL(/kind=SKILLS_LOG/);
check((await th.locator("main a[href^='/forms/']").allInnerTexts()).every((t) => t.includes("نموذج تسجيل المهارات")), "التصفية حسب النموذج الرسمي");
const dh = await as(DH);
check((await navLabels(dh)).includes("متابعة الاعتماد"), "رئيس القسم يصل لمتابعة الاعتماد");
await dh.goto(B + `/forms/${slId}`);
const dhButtons = await panel(dh).locator("button").allInnerTexts();
check(!dhButtons.some((b) => /اعتماد|توقيع|إعادة|رفع/.test(b)), "رئيس القسم: عرض فقط بلا إجراءات", dhButtons);
await dh.goto(B + `/portfolio/${plId}`);
check((await text(dh.locator("h1"))) === "السجل المهني للتدريب الميداني", "رئيس القسم يطّلع على سجل الطالب");
check((await dh.getByRole("button", { name: /إنشاء|جديد/ }).count()) === 0, "لا أزرار إنشاء لغير الطالب");

// =====================================================================
section("ط) حدود الوصول");
const simPl = sql(`select p.id from "Placement" p join "StudentProfile" s on s.id=p."studentId" where s."universityId"='441100025'`);
const r404 = await fs.goto(B + `/portfolio/${simPl}`);
check(r404.status() === 404, "المشرف المؤسسي لا يصل لسجل طالب ليس تحت إشرافه");
await st.goto(B + "/queue");
check(new URL(st.url()).pathname === "/portfolio", "الطالب يُحوَّل من قائمة الاعتماد إلى سجله");
await st.goto(B + `/portfolio/${simPl}`);
check(new URL(st.url()).pathname === "/portfolio", "الطالب لا يفتح سجل غيره");
const fOther = await fs.goto(B + `/forms/${sql(`select f.id from "FieldForm" f where f."placementId"='${simPl}' limit 1`) || "x"}`);
check(fOther.status() === 404, "المشرف المؤسسي لا يفتح نماذج المحاكاة");

await browser.close();
console.log(`\n${fail ? "❌" : "✅"} ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
