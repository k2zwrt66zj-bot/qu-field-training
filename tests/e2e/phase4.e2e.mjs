// =====================================================================
//  اختبار المرحلة 4 عبر المتصفح وHTTP: الاجتماعات الإشرافية الجماعية، وكشف الحضور اليومي الموقَّع،
//  وقرار توزيع الدرجات في المحاكاة
//  المتطلبات: خادم يعمل + بيانات تجريبية حديثة (npm run db:seed)
//  التشغيل:   npm run test:e2e:phase4   (SCREENSHOT_DIR=… لحفظ لقطات الشاشة)
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
async function api(email, method, url, data) {
  const p = await as(email);
  const r = await p.request.fetch(B + url, { method, ...(data !== undefined ? { data } : {}) });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status(), json };
}
const shot = async (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const text = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).trim() : "");
const panel = (p) => p.locator("main aside");
async function draw(p, canvas) {
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox();
  await p.mouse.move(b.x + 30, b.y + 40);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(b.x + 30 + i * 22, b.y + 40 + (i % 2) * 35, { steps: 2 });
  await p.mouse.up();
}
/** يفتح إجراءً من الشريط الجانبي ثم يوقّع أو يكتب الملاحظة ويؤكد */
async function act(p, label, { comment } = {}) {
  await panel(p).getByRole("button", { name: label, exact: true }).click();
  const dlg = p.getByRole("dialog");
  await dlg.waitFor();
  if (comment) await dlg.locator("#sign-comment").fill(comment);
  else await draw(p, dlg.locator("canvas"));
  await dlg.getByRole("button", { name: label, exact: true }).click();
  await dlg.waitFor({ state: "detached", timeout: 15000 });
}
const waitSaved = (p) => p.getByText("حُفظت كل التعديلات").waitFor({ timeout: 15000 });

const AC = "academic1@qu.edu.sa", S1 = "441100001@qu.edu.sa", F1 = "field1@example.sa", TH = "bushra.aldubaikhi@qu.edu.sa", DH = "omar.alnamlah@qu.edu.sa";

// =====================================================================
section("أ) الاجتماع الإشرافي الجماعي: إعداد رئيس الاجتماع");
const orgId = sql(`select p."organizationId" from "Placement" p join "StudentProfile" s on s.id=p."studentId" where s."universityId"='441100001'`);
const s1Placement = sql(`select p.id from "Placement" p join "StudentProfile" s on s.id=p."studentId" where s."universityId"='441100001'`);
const groupSize = Number(sql(`select count(*) from "Placement" p join "AcademicSupervisorProfile" a on a.id=p."academicSupervisorId" join "User" u on u.id=a."userId" where u.email='${AC}' and p."organizationId"='${orgId}' and p.status in ('ASSIGNED','ACTIVE','COMPLETED')`));
check(groupSize >= 2, `المجموعة الإشرافية (${groupSize} متدربين)`);

const ac = await as(AC);
await ac.goto(B + "/meetings");
check((await text(ac.locator("h1"))) === "سجل الاجتماعات الإشرافية الجماعية", "صفحة سجل الاجتماعات");
const group = ac.locator(`[data-group="${orgId}"]`);
await group.getByRole("button", { name: "اجتماع جديد" }).click();
await ac.waitForURL(/\/meetings\/[^/]+$/);
const m1 = ac.url().split("/meetings/")[1];
check((await text(ac.locator("h1"))) === "الاجتماع الإشرافي الجماعي رقم (1)", "اجتماع رقم (1)");
check(Number(sql(`select count(*) from "MeetingAttendance" where "meetingId"='${m1}'`)) === groupSize, "سجل الحضور لكل أعضاء المجموعة");
check((await ac.getByText(/التصديق على محضر الاجتماع السابق/).count()) === 0, "لا تصديق على محضر سابق في الاجتماع الأول");

await ac.locator("#m-time").fill("10:30");
await ac.locator("#m-duration").fill("60");
await ac.locator("#m-location").fill("قاعة الاجتماعات بالمؤسسة");
await ac.getByLabel("إضافة بند 1").fill("مناقشة دراسات الحالة الجارية");
const other = sql(`select u."fullName" from "MeetingAttendance" ma join "Placement" p on p.id=ma."placementId" join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" where ma."meetingId"='${m1}' and s."universityId"<>'441100001' order by u."fullName" limit 1`);
await ac.getByRole("radiogroup", { name: `حضور ${other}` }).getByRole("radio", { name: "غياب بعذر" }).click();
await ac.getByLabel(`عذر ${other}`).fill("مراجعة طبية");
await ac.locator("#m-secretary").selectOption(s1Placement);
await waitSaved(ac);
check((await text(ac.locator("main"))).includes(`أسماء الغياب بعذر: ${other} (مراجعة طبية)`), "أسماء الغياب بعذر محسوبة من السجل");
check(sql(`select "startTime"||'|'||"durationMinutes"||'|'||"secretaryPlacementId" from "SupervisionMeeting" where id='${m1}'`) === `10:30|60|${s1Placement}`, "الحفظ التلقائي للإعداد");
check((await panel(ac).getByRole("button", { name: /رفع المحضر/ }).count()) === 0, "رئيس الاجتماع لا يرفع المحضر (يرفعه الأمين)");
check((await text(panel(ac).getByLabel("نواقص المحضر"))).includes("محضر الاجتماع"), "النواقص: المحضر لم يُكتب");
await shot(ac, "p4-01-meeting-chair-draft");

// =====================================================================
section("ب) أمين الاجتماع يكتب المحضر ويرفعه بتوقيعه");
const otherEmail = sql(`select u.email from "User" u where u."fullName"='${other}' limit 1`);
let r = await api(otherEmail, "GET", `/api/meetings/${m1}`);
check(r.status === 404, "بقية الأعضاء لا يرون المسودة");
r = await api(S1, "PATCH", `/api/meetings/${m1}`, { location: "مكان آخر" });
check(r.status === 422, "الأمين لا يعدّل غير المحضر والقرارات");
const s1 = await as(S1);
await s1.goto(B + "/meetings");
check((await s1.getByText("أنت الأمين").count()) === 1, "الطالب يرى أنه أمين الاجتماع");
await s1.goto(B + `/meetings/${m1}`);
check((await s1.locator("#m-location").count()) === 0 && (await s1.locator("#m-minutes").count()) === 1, "الأمين يحرّر المحضر فقط");
await s1.locator("#m-minutes").fill(words(75, "ناقش"));
await s1.getByLabel("إضافة قرار أو توصية 1").fill("رفع خطة التدخل لكل حالة قبل الاجتماع القادم");
await waitSaved(s1);
await act(s1, "رفع المحضر بتوقيع أمين الاجتماع");
check(sql(`select status from "SupervisionMeeting" where id='${m1}'`) === "SUBMITTED", "رُفع المحضر بتوقيع الأمين");
check(sql(`select count(*) from "FormSignature" where "meetingId"='${m1}' and slot='MEETING_SECRETARY'`) === "1", "توقيع أمين الاجتماع محفوظ مع البصمة");
r = await api(otherEmail, "GET", `/api/meetings/${m1}`);
check(r.status === 200 && r.json.meeting.actions.editMinutes === false, "بعد الرفع يراه الأعضاء للقراءة");

// =====================================================================
section("ج) رئيس الاجتماع: الإعادة ثم الاعتماد");
await ac.goto(B + "/queue");
check((await text(ac.locator('[data-pending="minutes"]'))).includes("الاجتماع رقم (1)"), "المحضر يظهر في قائمة اعتماد المشرف الأكاديمي");
await ac.goto(B + `/meetings/${m1}`);
await act(ac, "إعادة المحضر للأمين", { comment: "أضف ما دار حول البند الأول بالتفصيل" });
check(sql(`select status||'|'||(select count(*) from "FormSignature" where "meetingId"='${m1}') from "SupervisionMeeting" where id='${m1}'`) === "DRAFT|0", "الإعادة تُلغي توقيع الأمين");
await s1.goto(B + `/meetings/${m1}`);
check((await text(s1.getByRole("alert"))).includes("أضف ما دار حول البند الأول"), "سبب الإعادة ظاهر للأمين");
await act(s1, "رفع المحضر بتوقيع أمين الاجتماع");
await ac.goto(B + `/meetings/${m1}`);
await act(ac, "اعتماد المحضر بتوقيع رئيس الاجتماع");
check(sql(`select status from "SupervisionMeeting" where id='${m1}'`) === "REVIEWED", "اعتمد رئيس الاجتماع المحضر");
check((await ac.locator('[data-slot] img').count()) === 2, "توقيعا الأمين ورئيس الاجتماع في المحضر");
await shot(ac, "p4-02-meeting-approved");
r = await api(AC, "PATCH", `/api/meetings/${m1}`, { location: "x" });
check(r.status === 403, "المحضر المعتمد لا يُعدَّل");
r = await api(AC, "DELETE", `/api/meetings/${m1}`);
check(r.status === 403, "المحضر المعتمد لا يُحذف");

await s1.goto(B + "/portfolio");
const mt = s1.locator("section", { has: s1.locator("#meetings-heading") });
check((await text(mt)).includes("رقم (1)") && (await text(mt)).includes("معتمد") && (await text(mt)).includes("أمين الاجتماع"), "الاجتماع في السجل المهني للطالب");

r = await api(AC, "POST", "/api/meetings", { organizationId: orgId });
check(r.status === 201 && r.json.number === 2, "الاجتماع التالي رقم (2)");
await ac.goto(B + `/meetings/${r.json.id}`);
check((await ac.getByText(/التصديق على محضر الاجتماع السابق/).count()) === 1, "الاجتماع الثاني يبدأ بالتصديق على المحضر السابق");
r = await api(AC, "DELETE", `/api/meetings/${r.json.id}`);
check(r.status === 200, "حذف مسودة لم تُرفع");
r = await api(F1, "GET", `/api/meetings/${m1}`);
check(r.status === 404, "المشرف المؤسسي لا يصل للاجتماعات الإشرافية الأكاديمية");
const dh = await as(DH);
await dh.goto(B + `/meetings/${m1}`);
check((await panel(dh).getByRole("button").allInnerTexts()).every((b) => b.includes("طباعة")), "رئيس القسم: عرض وطباعة فقط");

// =====================================================================
section("د) كشف الحضور اليومي: التوقيع والبصمة والقفل");
const fsOrg = sql(`select f."organizationId" from "FieldSupervisorProfile" f join "User" u on u.id=f."userId" where u.email='${F1}'`);
r = await api(F1, "GET", `/api/attendance-sheets`);
check(r.status === 200 && r.json.organization?.id === fsOrg && r.json.days.length > 0, `أيام التدريب في مؤسسة المشرف (${r.json?.days?.length})`);
const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const day = r.json.days.find((d) => !d.signed && d.date < today && d.present > 0);
check(!!day, "يوم سابق بحضور ولم يُوقَّع", r.json.days.slice(0, 3));
const fs = await as(F1);
await fs.goto(B + "/queue");
check((await fs.locator('[data-pending="sheets"]').count()) === 1, "قائمة المشرف المؤسسي تنبّه للكشوف غير الموقّعة");
await fs.goto(B + `/attendance-sheets/${fsOrg}/${day.date}`);
check((await text(fs.locator("h1"))).includes("سجل الحضور والانصراف لمتدربين قسم الاجتماع والخدمة الاجتماعية"), "عنوان الكشف الرسمي");
check((await fs.locator("tr[data-row]").count()) === day.expected, `صف لكل متدرب في يوم تدريبه (${day.expected})`);
await shot(fs, "p4-03-sheet-before-sign");
await panel(fs).getByRole("button", { name: "توقيع كشف اليوم" }).click();
let dlg = fs.getByRole("dialog");
await draw(fs, dlg.locator("canvas"));
await dlg.getByRole("button", { name: "توقيع الكشف" }).click();
await dlg.waitFor({ state: "detached", timeout: 15000 });
await fs.locator("[data-integrity]").waitFor();
check((await fs.locator("[data-integrity]").getAttribute("data-integrity")) === "intact", "الكشف موقّع والسجلات مطابقة");
const sheetId = sql(`select id from "AttendanceSheet" where "organizationId"='${fsOrg}' and "sheetDate"='${day.date}'`);
check(Number(sql(`select count(*) from "AttendanceRecord" where "sheetId"='${sheetId}'`)) === day.expected, "كل سجلات اليوم مرتبطة بالكشف (ومن لم يحضر سُجّل غيابه)");
check(sql(`select count(*) from "FormSignature" where "sheetId"='${sheetId}' and slot='FIELD_SUPERVISOR'`) === "1", "توقيع المشرف المؤسسي مع البصمة");
await shot(fs, "p4-04-sheet-signed");

const lockedPl = sql(`select "placementId" from "AttendanceRecord" where "sheetId"='${sheetId}' limit 1`);
r = await api(F1, "POST", "/api/attendance/manual", { placementId: lockedPl, date: day.date, status: "EXCUSED", note: "x" });
check(r.status === 409 && r.json.error.includes("موقّع"), "اليوم الموقّع لا يقبل تعديلاً يدوياً", r.json);
r = await api(F1, "POST", `/api/attendance-sheets/${fsOrg}/${day.date}`, { imageData: "data:image/png;base64,AAAA" });
check(r.status === 409, "لا يُوقَّع الكشف مرتين");

// العبث المباشر بقاعدة البيانات يُكشف
const tampered = sql(`select id from "AttendanceRecord" where "sheetId"='${sheetId}' and "checkOutAt" is not null limit 1`);
sql(`update "AttendanceRecord" set "checkOutAt" = "checkOutAt" + interval '1 hour' where id='${tampered}'`);
await fs.reload();
check((await fs.locator("[data-integrity]").getAttribute("data-integrity")) === "changed", "تعديل مباشر بعد التوقيع يُكتشف");
sql(`update "AttendanceRecord" set "checkOutAt" = "checkOutAt" - interval '1 hour' where id='${tampered}'`);
await fs.reload();
check((await fs.locator("[data-integrity]").getAttribute("data-integrity")) === "intact", "إرجاع القيمة يعيد التطابق");

const acView = await api(AC, "GET", `/api/attendance-sheets/${fsOrg}/${day.date}`);
check(acView.status === 200 && acView.json.sheet.canSign === false, "المشرف الأكاديمي يطّلع على الكشف دون توقيع");
r = await api(S1, "GET", `/api/attendance-sheets/${fsOrg}/${day.date}`);
check(r.status === 403, "الطالب لا يصل لكشوف المؤسسة");
const otherFs = sql(`select u.email from "FieldSupervisorProfile" f join "User" u on u.id=f."userId" where f."organizationId"<>'${fsOrg}' limit 1`);
r = await api(otherFs, "GET", `/api/attendance-sheets/${fsOrg}/${day.date}`);
check(r.status === 404, "مشرف مؤسسة أخرى لا يرى الكشف");
r = await api(otherFs, "POST", `/api/attendance-sheets/${fsOrg}/${day.date}`, { imageData: "data:image/png;base64,AAAA" });
check(r.status === 403, "ولا يوقّعه");
const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
r = await api(F1, "GET", `/api/attendance-sheets/${fsOrg}/${future}`);
check(r.status === 200 && r.json.sheet.canSign === false, "لا توقيع لكشف يوم لم يأتِ");

// =====================================================================
section("هـ) المحاكاة: وزن المشرف المؤسسي منقول إلى الأكاديمي");
const termId = sql(`select id from "AcademicTerm" where "isActive"`);
r = await api(TH, "POST", "/api/grades/calculate", { termId });
check(r.status === 200, "احتساب الدرجات");
const b = JSON.parse(sql(`select breakdown from "FinalGrade" g join "Placement" p on p.id=g."placementId" join "StudentProfile" s on s.id=p."studentId" where s."universityId"='441100025'`));
check(b.effectiveWeights?.academicWeight === 80 && b.effectiveWeights?.fieldWeight === 0, "طالب المحاكاة: الأكاديمي 80%", b.effectiveWeights);
check(!b.missing.includes("تقييم المشرف المؤسسي"), "لا يُطلب تقييم المشرف المؤسسي لطالب المحاكاة", b.missing);
const bf = JSON.parse(sql(`select breakdown from "FinalGrade" g join "Placement" p on p.id=g."placementId" join "StudentProfile" s on s.id=p."studentId" where s."universityId"='441100001'`));
check(bf.effectiveWeights?.fieldWeight === 40 && bf.effectiveWeights?.academicWeight === 40, "الطالب الميداني: 40 + 40 كما هو");
const sim = await as("441100025@qu.edu.sa");
await sim.goto(B + "/student");
const home = await text(sim.locator("main"));
check(!home.includes("تقييم المشرف المؤسسي") && home.includes("(80%)"), "رئيسية طالب المحاكاة: بلا بطاقة المشرف المؤسسي، والأكاديمي 80%");
const th = await as(TH);
await th.goto(B + "/training-head/grades");
check((await text(th.locator("main"))).includes("لا ينطبق"), "اعتماد النتائج: «لا ينطبق» للمكوّن الميداني في المحاكاة");

await browser.close();
console.log(`\n${fail ? "❌" : "✅"} ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
