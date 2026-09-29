// =====================================================================
//  اختبار المرحلة 5: مخرجات PDF الرسمية (النماذج، والسجل المهني، والمحضر، والكشف)
//  يتحقق من: ملف PDF فعلي، والترويسة الرسمية، والتواقيع والأختام وأماكنها، والبصمة ورمز التحقق،
//  والصلاحيات، والإخفاء، وصفحة التحقق العامة
//  المتطلبات: خادم يعمل + بيانات من اختبارَي النماذج والمرحلة 4 (npm run test:e2e:all يشغّلها بالترتيب)
// =====================================================================
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const B = process.env.BASE_URL ?? "http://localhost:3000";
const DB = (process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/qu_field_training").split("?")[0];
const sql = (q) => execSync(`psql "${DB}" -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();

let pass = 0, fail = 0;
const check = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
};
const section = (t) => console.log(`\n${t}`);

const browser = await chromium.launch(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {});
const pages = {};
async function as(email) {
  if (pages[email]) return pages[email];
  const p = await (await browser.newContext()).newPage();
  await p.goto(B + "/login"); await p.fill("#email", email); await p.fill("#password", "Qu@12345"); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return (pages[email] = p);
}
async function fetchAs(email, url) {
  const r = await (await as(email)).request.get(B + url, { timeout: 120000 });
  return { status: r.status(), type: r.headers()["content-type"] ?? "", body: await r.body() };
}
const isPdf = (r) => r.status === 200 && r.type.includes("application/pdf") && r.body.subarray(0, 5).toString() === "%PDF-";
const html = async (email, url) => (await fetchAs(email, `${url}?format=html`)).body.toString("utf8");
const OFFICIAL = ["المملكة العربية السعودية", "وزارة التعليم", "جامعة القصيم", "كلية اللغات والعلوم الإنسانية", "قسم الاجتماع والخدمة الاجتماعية", "Qassim University", "College of Languages &amp; Social Sciences"];
const hasHeader = (h) => OFFICIAL.every((s) => h.includes(s));

const TH = "bushra.aldubaikhi@qu.edu.sa", AC = "academic1@qu.edu.sa", F1 = "field1@example.sa", S1 = "441100001@qu.edu.sa", DH = "omar.alnamlah@qu.edu.sa";
const formOf = (uid, kind, extra = "") => sql(`select f.id from "FieldForm" f join "Placement" p on p.id=f."placementId" join "StudentProfile" s on s.id=p."studentId" where s."universityId"='${uid}' and f.kind='${kind}' and f.status<>'DRAFT' ${extra} order by f.sequence limit 1`);
const plOf = (uid) => sql(`select p.id from "Placement" p join "StudentProfile" s on s.id=p."studentId" where s."universityId"='${uid}'`);

// =====================================================================
section("أ) النموذج الرسمي: المباشرة الموقّعة ثلاثياً مع الختم");
const cm = formOf("441100006", "COMMENCEMENT");
check(!!cm, "نموذج مباشرة موقّع في البيانات");
let r = await fetchAs(TH, `/api/forms/${cm}/pdf`);
check(isPdf(r), `ملف PDF فعلي (${Math.round(r.body.length / 1024)} KB)`, r.type);
let h = await html(TH, `/api/forms/${cm}/pdf`);
check(hasHeader(h), "الترويسة الرسمية بالعربية والإنجليزية");
check(h.includes('alt="شعار جامعة القصيم"'), "شعار الجامعة");
check(h.includes("@font-face") && h.includes("font/woff2;base64"), "الخطوط مضمّنة (لا اعتماد على الإنترنت)");
for (const role of ["توقيع الطالب/ـة", "توقيع المشرف المؤسسي", "مدير المؤسسة (الختم والتوقيع)", "اعتماد المشرف الأكاديمي"]) check(h.includes(role), `خانة: ${role}`);
check((h.match(/alt="توقيع"/g) ?? []).length === 3, "صور التواقيع الثلاثة مضمّنة");
check(h.includes('alt="ختم المؤسسة"'), "ختم المؤسسة الرسمي في خانة المدير");
check(/بصمة المحتوى \(SHA-256\)/.test(h) && h.includes('alt="رمز التحقق"'), "بصمة المحتوى ورمز التحقق في التذييل");

section("ب) أماكن التوقيع الفارغة للتوقيع اليدوي");
const qs = sql(`select f.id from "FieldForm" f join "QuickSituation" q on q."formId"=f.id where q.domain='MEDICAL' and f.status='SUBMITTED' limit 1`);
h = await html(TH, `/api/forms/${qs}/pdf`);
check(h.includes('class="blank"') && h.includes("التاريخ: ....../....../......"), "خانة غير موقّعة تُطبع خطاً للتوقيع والتاريخ");

section("ج) الإخفاء والصلاحيات في المخرجات");
const full = sql(`select q."medicalFileNumber" from "QuickSituation" q where q."formId"='${qs}'`);
check(!h.includes(full) && h.includes("•••"), "رئيس الوحدة: رقم الملف الطبي مخفي في PDF");
const acHtml = await html(AC, `/api/forms/${qs}/pdf`);
check(acHtml.includes(full), "المشرف الأكاديمي المسؤول: الرقم كاملاً");
const rd = formOf("441100001", "READING");
check((await fetchAs(F1, `/api/forms/${rd}/pdf`)).status === 404, "المشرف المؤسسي لا يصدّر القراءات");
check((await fetchAs("441100002@qu.edu.sa", `/api/forms/${rd}/pdf`)).status === 404, "طالب آخر لا يصدّر نموذج غيره");
const draft = sql(`select id from "FieldForm" where status='DRAFT' limit 1`);
if (draft) check((await fetchAs(TH, `/api/forms/${draft}/pdf`)).status === 404, "المسودة لا تُصدَّر لغير صاحبها");
check(isPdf(await fetchAs(DH, `/api/forms/${cm}/pdf`)), "رئيس القسم يصدّر للاطلاع");

section("د) صفحة التحقق العامة (رمز QR)");
const cmHtml = await html(TH, `/api/forms/${cm}/pdf`);
const link = cmHtml.match(/\/verify\/f\/([^?"]+)\?h=([0-9a-f]{16})/);
check(!!link, "رابط التحقق مضمّن في رمز QR");
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${B}/verify/f/${link[1]}?h=${link[2]}`);
let vt = await anon.locator("main, body").first().innerText();
check(vt.includes("مطابق للنسخة المعتمدة"), "التحقق بلا تسجيل دخول: مطابق");
const fullName = sql(`select u."fullName" from "User" u join "StudentProfile" s on s."userId"=u.id where s."universityId"='441100006'`);
check(!vt.includes(fullName), "لا يكشف اسم الطالب كاملاً ولا محتوى النموذج");
sql(`update "CommencementForm" set shift = case when shift='MORNING' then 'EVENING'::"TrainingShift" else 'MORNING'::"TrainingShift" end where "formId"='${cm}'`);
await anon.reload();
vt = await anon.locator("body").innerText();
check(vt.includes("تغيّر بعد طباعة"), "تعديل المحتوى بعد الطباعة يُكتشف");
sql(`update "CommencementForm" set shift = case when shift='MORNING' then 'EVENING'::"TrainingShift" else 'MORNING'::"TrainingShift" end where "formId"='${cm}'`);

// =====================================================================
section("هـ) السجل المهني الكامل");
r = await fetchAs(S1, `/api/portfolio/${plOf("441100001")}/pdf`);
check(isPdf(r), `السجل المهني PDF (${Math.round(r.body.length / 1024)} KB)`);
h = await html(S1, `/api/portfolio/${plOf("441100001")}/pdf`);
check(h.includes("السجل المهني للتدريب الميداني") && h.includes("محتويات السجل المهني"), "الغلاف والمحتويات");
const nonDraft = Number(sql(`select count(*) from "FieldForm" f join "Placement" p on p.id=f."placementId" join "StudentProfile" s on s.id=p."studentId" where s."universityId"='441100001' and f.status<>'DRAFT'`));
check((h.match(/class="frame doc"/g) ?? []).length === nonDraft + 4, `كل نموذج مرفوع بصفحاته (${nonDraft}) + الغلاف والمحتويات والاجتماعات والحضور`);
const iCase = h.indexOf('<h1 class="title">دراسة الحالة وفقاً لخطوات التدخل المهني'), iRead = h.indexOf('<h1 class="title">نموذج القراءة رقم');
check(iCase > 0 && iRead > iCase, "بترتيب الدليل الرسمي (دراسة الحالة قبل القراءات)");
check(h.includes("سجل الاجتماعات الإشرافية الجماعية") && h.includes("سجل الحضور والانصراف"), "الاجتماعات وسجل الحضور");
const otherNames = sql(`select u."fullName" from "Placement" p join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" where p."organizationId"=(select "organizationId" from "Placement" where id='${plOf("441100001")}') and s."universityId"<>'441100001' limit 1`);
const attSection = h.slice(h.lastIndexOf("سجل الحضور والانصراف</h1>"));
check(!attSection.includes(otherNames), "سجل الحضور في السجل المهني يخص الطالب وحده (خصوصية بقية المتدربين)");
check((await fetchAs("441100002@qu.edu.sa", `/api/portfolio/${plOf("441100001")}/pdf`)).status === 404, "طالب آخر لا يصدّر سجل غيره");
check(isPdf(await fetchAs(AC, `/api/portfolio/${plOf("441100001")}/pdf`)), "المشرف الأكاديمي يصدّر سجل طالبه");
h = await html("441100025@qu.edu.sa", `/api/portfolio/${plOf("441100025")}/pdf`);
check(h.includes("السجل المهني للتدريب الميداني بالمحاكاة") && !h.includes("سجل الحضور والانصراف</h1>") && !h.includes("مباشرة الطالب/ـة لمؤسسة التدريب الميداني</h1>"), "سجل المحاكاة: غلافه، وبلا مباشرة ولا حضور");

// =====================================================================
section("و) محضر الاجتماع وكشف الحضور");
const mt = sql(`select id from "SupervisionMeeting" where status='REVIEWED' limit 1`);
r = await fetchAs(AC, `/api/meetings/${mt}/pdf`);
check(isPdf(r), "محضر الاجتماع PDF");
h = await html(AC, `/api/meetings/${mt}/pdf`);
check(hasHeader(h) && ["أولاً / الجزء الإحصائي", "ثانيًا / جدول الأعمال", "ثالثًا / محضر الاجتماع", "رابعًا / القرارات والتوصيات", "الأعضاء", "أمين الاجتماع", "رئيس الاجتماع"].every((s) => h.includes(s)), "أقسام المحضر الرسمية وخانات التوقيع");
check((h.match(/<img src="data:image\/png;base64[^"]+" style="max-height:50px"/g) ?? []).length === 2, "توقيعا الأمين ورئيس الاجتماع");
check((await fetchAs(F1, `/api/meetings/${mt}/pdf`)).status === 404, "المشرف المؤسسي لا يصدّر المحاضر");
const [org, day] = sql(`select "organizationId", to_char("sheetDate",'YYYY-MM-DD') from "AttendanceSheet" where "signedAt" is not null limit 1`).split("|");
r = await fetchAs(F1, `/api/attendance-sheets/${org}/${day}/pdf`);
check(isPdf(r), "كشف الحضور الموقَّع PDF");
h = await html(F1, `/api/attendance-sheets/${org}/${day}/pdf`);
check(hasHeader(h) && h.includes("سجل الحضور والانصراف لمتدربين قسم الاجتماع والخدمة الاجتماعية بجامعة القصيم") && h.includes("توقيع المشرف المؤسسي") && h.includes("سجلات اليوم مطابقة"), "الكشف: العنوان الرسمي والتوقيع وسلامة البصمة");
check((await fetchAs(S1, `/api/attendance-sheets/${org}/${day}/pdf`)).status === 403, "الطالب لا يصدّر كشف المؤسسة");

section("ز) أزرار التنزيل في الواجهات");
const s1 = await as(S1);
await s1.goto(`${B}/portfolio`);
check((await s1.getByRole("link", { name: /تنزيل السجل المهني PDF/ }).count()) === 1, "زر السجل المهني PDF");
await s1.goto(`${B}/forms/${rd}`);
check((await s1.getByRole("link", { name: /تنزيل PDF الرسمي/ }).count()) === 1, "زر PDF في شاشة النموذج");

await browser.close();
console.log(`\n${fail ? "❌" : "✅"} ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
