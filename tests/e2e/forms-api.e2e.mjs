// =====================================================================
//  اختبار شامل لواجهة النماذج الرسمية عبر HTTP بحسابات حقيقية لكل الأطراف
//  المتطلبات: خادم يعمل (npm run build && npm start) + قاعدة ببيانات تجريبية حديثة (npm run db:seed)
//  التشغيل:   npm run test:e2e:forms
//  المتغيرات: BASE_URL (افتراضي http://localhost:3000)، DATABASE_URL، CHROME_EXECUTABLE_PATH
// =====================================================================
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const B = process.env.BASE_URL ?? "http://localhost:3000";
const ROOT = process.cwd();
const SIG = readFileSync(`${ROOT}/prisma/fixtures/sample-signature.txt`, "utf8").trim();
const DB = (process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/qu_field_training").split("?")[0];
const sql = (q) => execSync(`psql "${DB}" -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const words = (n, w = "كلمة") => Array.from({ length: n }, (_, i) => `${w}${i}`).join(" ");

let pass = 0, fail = 0;
const check = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ""); }
};
const section = (t) => console.log(`\n${t}`);

const b = await chromium.launch(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {});
const sessions = {};
async function as(email) {
  if (sessions[email]) return sessions[email];
  const p = await (await b.newContext()).newPage();
  await p.goto(B + "/login"); await p.fill("#email", email); await p.fill("#password", "Qu@12345"); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return (sessions[email] = p);
}
async function api(email, method, url, data, multipart) {
  const p = await as(email);
  const r = await p.request.fetch(B + url, { method, ...(multipart ? { multipart } : data !== undefined ? { data } : {}) });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status(), json, headers: r.headers(), body: multipart === "raw" ? null : undefined, raw: r };
}
const tr = (email, id, body) => api(email, "POST", `/api/forms/${id}/transition`, body);
const sig = (slot, extra = {}) => ({ slot, imageData: SIG, ...extra });

// =====================================================================
section("أ) المباشرة: طالب موزَّع حديثاً → توقيع ثلاثي الأطراف → تفعيل التدريب");
const TH = "abdullah.altijani@qu.edu.sa";
const termId = sql(`select id from "AcademicTerm" where "isActive"`);
let r = await api(TH, "POST", "/api/placements/auto-assign", { termId, dryRun: false });
check(r.status === 200 && r.json.assigned.length > 0, `التوزيع الآلي نفّذ (${r.json?.assigned?.length} طالب)`);
const NEW = "441100006@qu.edu.sa";
const [plId, fsEmail, acEmail] = sql(`select p.id, fu.email, au.email from "Placement" p join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" join "FieldSupervisorProfile" f on f.id=p."fieldSupervisorId" join "User" fu on fu.id=f."userId" join "AcademicSupervisorProfile" a on a.id=p."academicSupervisorId" join "User" au on au.id=a."userId" where u.email='${NEW}'`).split("|");
check(!!plId && sql(`select status from "Placement" where id='${plId}'`) === "ASSIGNED", `الإسناد بحالة ASSIGNED (المشرف المؤسسي ${fsEmail})`);

r = await api(NEW, "POST", "/api/forms", { kind: "SKILLS_LOG" });
check(r.status === 409 && r.json.error.includes("المباشرة"), "لا نماذج أخرى قبل اعتماد المباشرة", r.json);
r = await api(NEW, "POST", "/api/forms", { kind: "COMMENCEMENT" });
check(r.status === 201, "إنشاء نموذج المباشرة");
const cmId = r.json.id;
r = await api(NEW, "POST", "/api/forms", { kind: "COMMENCEMENT" });
check(r.status === 409 && r.json.details?.existingId === cmId, "نموذج فردي: لا يتكرر (يعيد معرّف الموجود)");
r = await api(NEW, "GET", `/api/forms/${cmId}`);
check(r.json.form.data.commencementDate && r.json.form.data.declarationAccepted === false, "تعبئة مسبقة من الإسناد", r.json.form.data);
check(JSON.stringify(r.json.form.allowedActions) === JSON.stringify(["VIEW", "EDIT", "DELETE", "UPLOAD", "EXPORT", "SUBMIT"]), "إجراءات الطالب على المسودة", r.json.form.allowedActions);
r = await api(fsEmail, "GET", `/api/forms/${cmId}`);
check(r.status === 404, "المشرف المؤسسي لا يرى المسودة");

r = await api(NEW, "PATCH", `/api/forms/${cmId}`, { data: { fixedTrainingDay: 2, shift: "EVENING", declarationAccepted: true } });
check(r.status === 200 && r.json.form.data.fixedTrainingDay === 2, "حفظ المسودة");
r = await tr(NEW, cmId, { action: "SUBMIT" });
check(r.status === 422 && r.json.error.includes("توقيع الطالب"), "الرفع يتطلب توقيع الطالب", r.json);
r = await tr(NEW, cmId, { action: "SUBMIT", signatures: [sig("STUDENT")] });
check(r.status === 200 && r.json.form.status === "SUBMITTED", "رفع مع توقيع الطالب");
r = await api(NEW, "PATCH", `/api/forms/${cmId}`, { data: { shift: "MORNING" } });
check(r.status === 403, "لا تعديل بعد الرفع");

r = await tr(fsEmail, cmId, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR")] });
check(r.status === 422 && r.json.error.includes("مدير المؤسسة"), "توقيع المشرف وحده لا يكفي", r.json);
r = await tr(fsEmail, cmId, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR"), sig("ORG_DIRECTOR", { signerName: "أ. سعد المدير", withStamp: true })] });
check(r.status === 422 && r.json.error.includes("ختم"), "الختم مطلوب مرفوعاً قبل استخدامه", r.json);
const orgId = sql(`select "organizationId" from "Placement" where id='${plId}'`);
r = await api(fsEmail, "POST", `/api/organizations/${orgId}/stamp`, undefined, { file: { name: "stamp.png", mimeType: "image/png", buffer: readFileSync(`${ROOT}/public/brand/emblem-192.png`) } });
check(r.status === 201, "المشرف المؤسسي رفع ختم مؤسسته");
r = await api("field5@example.sa", "POST", `/api/organizations/${orgId}/stamp`, undefined, { file: { name: "x.png", mimeType: "image/png", buffer: readFileSync(`${ROOT}/public/brand/emblem-64.png`) } });
check(r.status === 403, "لا يرفع مشرف ختم مؤسسة أخرى");
r = await tr(fsEmail, cmId, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR"), sig("ORG_DIRECTOR", { signerName: "أ. سعد المدير", withStamp: true })] });
check(r.status === 200 && r.json.form.status === "SIGNED", "توقيع المشرف + المدير بالختم");
check(r.json.form.signatures.map((s) => s.slot).join(",") === "STUDENT,FIELD_SUPERVISOR,ORG_DIRECTOR", "ثلاث خانات توقيع محفوظة", r.json.form.signatures.map((s) => s.slot));
const [pst, pwd, pshift, pcommenced] = sql(`select status, "workDays", shift, "commencedAt" from "Placement" where id='${plId}'`).split("|");
check(pst === "ACTIVE" && pwd === "{2}" && pshift === "EVENING" && !!pcommenced, `أثر المباشرة على الإسناد: ${pst} ${pwd} ${pshift} ${pcommenced}`);
check(sql(`select "directorName" from "CommencementForm" where "formId"='${cmId}'`) === "أ. سعد المدير", "لقطة اسم المدير وقت التوقيع");
r = await tr(acEmail, cmId, { action: "ACADEMIC_APPROVE" });
check(r.status === 200 && r.json.form.status === "REVIEWED", "إحاطة المشرف الأكاديمي");

// =====================================================================
section("ب) دراسة الحالة + مقابلة مرتبطة: إعادة بملاحظة ثم توقيع ثم اعتماد بدرجة");
const S1 = "441100001@qu.edu.sa", F1 = "field1@example.sa", A1 = "academic1@qu.edu.sa";
r = await api(S1, "POST", "/api/forms", { kind: "CASE_STUDY" });
const csId = r.json.id;
r = await api(S1, "PATCH", `/api/forms/${csId}`, { data: { caseAlias: "الحالة (س)", hacker: true } });
check(r.status === 422, "رفض الحقول غير المعرّفة");
r = await api(S1, "PATCH", `/api/forms/${csId}`, { data: { caseAlias: "الحالة (س)", familyMembers: [{ name: "(م)", age: 58, relation: "العميل" }, { name: "(ز)", age: 50, relation: "الزوجة" }] } });
check(r.status === 200 && r.json.form.data.familyMembers.length === 2, "حفظ جزئي مع جدول التكوين الأسري");
r = await tr(S1, csId, { action: "SUBMIT" });
check(r.status === 422 && r.json.details.length > 10, `الرفع الناقص مرفوض بقائمة الحقول (${r.json.details?.length} ملاحظة)`);
check(r.json.details.some((d) => d.path === "physicalAspect") && r.json.details.some((d) => d.message.includes("الإقرار")), "الرسائل محددة بالحقل");

r = await api(S1, "POST", "/api/forms", { kind: "INTERVIEW" });
const ivId = r.json.id;
r = await api(S1, "PATCH", `/api/forms/${ivId}`, { data: { caseStudyFormId: csId, interviewDate: "2026-09-14", durationMinutes: 45, location: "مكتب الأخصائي", parties: "العميل", goals: "بناء العلاقة", content: words(70), skillsUsed: "الإنصات", positives: "تجاوب", difficulties: [{ difficulty: "تحفظ العميل", coping: "التقبل" }] } });
check(r.status === 200 && r.json.form.data.caseStudyFormId === csId, "ربط المقابلة بدراسة الحالة");
r = await api(S1, "GET", `/api/forms/${csId}`);
check(r.json.form.linkedInterviewFormIds?.includes(ivId), "دراسة الحالة تعرض المقابلات المرتبطة");
const otherCs = await api("441100003@qu.edu.sa", "POST", "/api/forms", { kind: "CASE_STUDY" });
r = await api(S1, "PATCH", `/api/forms/${ivId}`, { data: { caseStudyFormId: otherCs.json.id } });
check(r.status === 422, "لا ربط بدراسة حالة لطالب آخر");

const aspect = words(12);
const fullCase = {
  consentConfirmed: true, physicalAspect: aspect, psychologicalAspect: aspect, mentalAspect: aspect, behavioralAspect: aspect,
  familyDynamics: "علاقة جيدة بالزوجة", mainProblem: "انسحاب اجتماعي", subProblems: ["قلق"], strengths: "دعم الأسرة",
  participatingSystems: "الأسرة والفريق الطبي", mainGoal: "تحسين التكيف", subGoals: ["الالتزام بالعلاج"], professionalContract: "لقاء أسبوعي",
  therapeuticModels: ["المعرفي السلوكي"], techniques: ["إعادة البناء المعرفي"],
  initProblemsWellFormulated: true, initGoalsMeasurable: true, initGoalsAchievable: true, initTechniquesAppropriate: true, initResponsibilitiesClear: false,
  assessmentPositives: "تعاون", planningPositives: "وضوح", interventionPositives: "تحسن", finalOutcome: "POSITIVE_CHANGE",
  terminationType: "PLANNED", plannedGoalsAchieved: true, plannedTimeAppropriate: true, plannedProblemHandled: true, plannedResourcesUsed: true, plannedNeedsReferral: false,
  followUpInterval: "CLOSE", followUpPurposes: ["SERVICE_EVALUATION"], followUpMethods: ["PHONE_CALLS"], resultPerformsSocialRole: true,
};
r = await api(S1, "PATCH", `/api/forms/${csId}`, { data: fullCase });
check(r.status === 200, "استكمال دراسة الحالة");
r = await tr(S1, csId, { action: "SUBMIT" });
check(r.status === 200 && r.json.form.status === "SUBMITTED", "رفع دراسة الحالة");
r = await tr(F1, csId, { action: "FIELD_RETURN" });
check(r.status === 422, "الإعادة تتطلب ملاحظة");
r = await tr(F1, csId, { action: "FIELD_RETURN", comment: "وضّح ديناميكية الأسرة بتفصيل أكبر" });
check(r.status === 200 && r.json.form.status === "RETURNED" && r.json.form.comments.length === 1, "إعادة بملاحظة");
r = await api(S1, "PATCH", `/api/forms/${csId}`, { data: { familyDynamics: "علاقة داعمة مع الزوجة وتواصل ضعيف مع الأبناء المقيمين خارج المدينة" } });
check(r.status === 200, "التعديل بعد الإعادة");
r = await tr(S1, csId, { action: "SUBMIT" });
r = await tr(F1, csId, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR")] });
check(r.status === 200 && r.json.form.status === "SIGNED", "توقيع المشرف المؤسسي");
r = await tr("academic2@qu.edu.sa", csId, { action: "ACADEMIC_APPROVE" });
check(r.status === 404, "مشرف أكاديمي غير مسند لا يرى النموذج");
r = await tr(A1, csId, { action: "ACADEMIC_APPROVE", score: 88 });
check(r.status === 200 && r.json.form.status === "REVIEWED" && r.json.form.academicScore === 88, "اعتماد أكاديمي بدرجة 88");
const [hash] = sql(`select s."contentHash" from "FormSignature" fs join "Signature" s on s.id=fs."signatureId" where fs."formId"='${csId}'`).split("\n");
check(/^[0-9a-f]{64}$/.test(hash), "التوقيع مرتبط ببصمة SHA-256 للمحتوى");

// الأطراف الأخرى
r = await api("omar.alnamlah@qu.edu.sa", "GET", `/api/forms/${csId}`);
check(r.status === 200 && JSON.stringify(r.json.form.allowedActions) === '["VIEW","EXPORT"]', "رئيس القسم: عرض وتصدير فقط");
r = await api("omar.alnamlah@qu.edu.sa", "POST", `/api/forms/${csId}/comments`, { body: "ملاحظة" });
check(r.status === 403, "رئيس القسم لا يعلّق");
r = await api("441100003@qu.edu.sa", "GET", `/api/forms/${csId}`);
check(r.status === 404, "طالب آخر لا يرى النموذج");
r = await api("field2@example.sa", "GET", `/api/forms/${csId}`);
check(r.status === 404, "مشرف مؤسسي لجهة أخرى لا يرى النموذج");

// =====================================================================
section("ج) القراءات: توثيق APA آلي، ولا تمرّ على المشرف المؤسسي");
r = await api(S1, "POST", "/api/forms", { kind: "READING" });
const rdId = r.json.id;
check(r.json.sequence === 1, "القراءة رقم (1)");
r = await api(S1, "PATCH", `/api/forms/${rdId}`, { data: { sourceType: "JOURNAL_ARTICLE", readingDate: "2026-09-15", authors: ["Smith, J. A."], publicationYear: 2023, title: "Social work in hospitals", containerTitle: "Health & Social Work", volume: "48", issue: "2", pages: "101-110", doi: "10.1093/hsw/hlad001", purpose: words(20), professionalBenefit: words(45) } });
check(r.json.form.data.apaCitation === "Smith, J. A. (2023). Social work in hospitals. Health & Social Work, 48(2), 101–110. https://doi.org/10.1093/hsw/hlad001", "توليد APA", r.json.form.data.apaCitation);
check(r.json.form.apaHtml.includes("<i>48</i>"), "نسخة HTML بخط مائل للطباعة");
await tr(S1, rdId, { action: "SUBMIT" });
r = await tr(F1, rdId, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR")] });
check(r.status === 404, "المشرف المؤسسي لا يرى القراءات");
r = await tr(A1, rdId, { action: "ACADEMIC_APPROVE" });
check(r.status === 200 && r.json.form.status === "REVIEWED", "اعتماد أكاديمي مباشر");
r = await api(S1, "POST", "/api/forms", { kind: "READING" });
check(r.json.sequence === 2, "القراءة التالية رقم (2)");

// =====================================================================
section("د) الخطة ← سجل المهارات: تعديل مشترك، ربط آلي بأسبوع الخطة، ورفض النقاط");
r = await api(S1, "POST", "/api/forms", { kind: "TRAINING_PLAN" });
const plnId = r.json.id;
r = await api(S1, "GET", `/api/forms/${plnId}`);
const weeks = r.json.form.data.weeks;
check(weeks.length >= 10 && weeks.length <= 18, `صفوف الأسابيع مولَّدة من مدة التدريب (${weeks.length})`);
const currentWeek = Number(sql(`select floor((current_date - "startDate")/7)+1 from "Placement" p join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" where u.email='${S1}'`));
const weeksData = weeks.map((w) => ({ ...w, tasks: w.weekNumber === currentWeek ? "حضور لجنة الحالات، مقابلة أولية، إعداد تقرير اجتماعي" : `مهام الأسبوع ${w.weekNumber}`, responsible: "الطالب والمشرف المؤسسي" }));
r = await api(S1, "PATCH", `/api/forms/${plnId}`, { data: { generalGoal: "إكساب مهارات الممارسة المهنية", weeks: weeksData } });
await tr(S1, plnId, { action: "SUBMIT" });
r = await api(F1, "PATCH", `/api/forms/${plnId}`, { data: { weeks: [{ ...weeksData[0], tasks: "جولة تعريفية بأقسام المستشفى (عدّلها المشرف)" }, ...weeksData.slice(1)] } });
check(r.status === 200 && r.json.form.data.weeks[0].tasks.includes("المشرف"), "المشرف المؤسسي يعدّل الخطة أثناء المراجعة");
r = await api(S1, "PATCH", `/api/forms/${plnId}`, { data: { generalGoal: "x" } });
check(r.status === 403, "الطالب لا يعدّل بعد الرفع");
await tr(F1, plnId, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR")] });

r = await api(S1, "POST", "/api/forms", { kind: "SKILLS_LOG" });
const slId = r.json.id;
r = await api(S1, "GET", `/api/forms/${slId}`);
check(r.json.form.data.weekNumber === currentWeek && r.json.form.data.topics.length === 3, `موضوعات اليوم من أسبوع الخطة ${currentWeek}`, r.json.form.data.topics);
check(sql(`select count(*) from "SkillsLog" sl join "TrainingPlanWeek" w on w.id=sl."planWeekId" where sl."formId"='${slId}'`) === "1", "ربط آلي بأسبوع الخطة");
const bullets = Array.from({ length: 10 }, (_, i) => `- مهارة ${i} اكتسبتها اليوم أثناء التدريب الميداني بالمستشفى`).join("\n");
await api(S1, "PATCH", `/api/forms/${slId}`, { data: { skillsNarrative: bullets, knowledgeNarrative: words(55) } });
r = await tr(S1, slId, { action: "SUBMIT" });
check(r.status === 422 && r.json.details.some((d) => d.message.includes("ليس نقاطاً")), "رفض كتابة المهارات نقاطاً");

// المرفقات
const pg = await as(S1);
const jpegB64 = await pg.evaluate(() => { const c = document.createElement("canvas"); c.width = 64; c.height = 48; const x = c.getContext("2d"); x.fillStyle = "#17afb2"; x.fillRect(0, 0, 64, 48); return c.toDataURL("image/jpeg").split(",")[1]; });
const jpeg = Buffer.from(jpegB64, "base64");
const exifPayload = Buffer.from("Exif\0\0GPSLatitude=26.3415;GPSLongitude=43.9632;Make=PhoneX", "latin1");
const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exifPayload.length + 2) >> 8, (exifPayload.length + 2) & 0xff]), exifPayload]);
const withExif = Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
r = await api(S1, "POST", `/api/forms/${slId}/attachments`, undefined, { file: { name: "شاهد.jpg", mimeType: "image/jpeg", buffer: withExif }, caption: "حضور لجنة الحالات" });
check(r.status === 201, "رفع صورة شاهد");
const attUrl = r.json.attachment.url;
const dl = await (await as(S1)).request.get(B + attUrl);
const got = Buffer.from(await dl.body());
check(!got.includes(Buffer.from("GPSLatitude")) && !got.includes(Buffer.from("Exif")), "أزيلت بيانات GPS/EXIF من الملف المخزَّن");
check(got.length === withExif.length - app1.length && dl.headers()["x-content-type-options"] === "nosniff", "بيانات الصورة سليمة ورؤوس أمان");
const decoded = await pg.evaluate(async (b64) => { const i = new Image(); i.src = "data:image/jpeg;base64," + b64; await i.decode(); return i.naturalWidth; }, got.toString("base64"));
check(decoded === 64, "الصورة المنظفة تُفتح بشكل سليم");
r = await api(S1, "POST", `/api/forms/${slId}/attachments`, undefined, { file: { name: "virus.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<script>alert(1)</script>") } });
check(r.status === 415, "رفض ملف متنكر بامتداد صورة");
r = await api(S1, "POST", `/api/forms/${slId}/attachments`, undefined, { file: { name: "big.jpg", mimeType: "image/jpeg", buffer: Buffer.concat([jpeg, Buffer.alloc(6 * 1024 * 1024)]) } });
check(r.status === 413, "رفض ملف أكبر من 5 ميجابايت");
r = await api("441100003@qu.edu.sa", "GET", attUrl);
check(r.status === 404, "طالب آخر لا يصل للمرفق");

// =====================================================================
section("هـ) الموقف السريع الطبي: الرقم كاملاً للطالب والمشرفَين المسؤولين فقط");
r = await api(S1, "POST", "/api/forms", { kind: "QUICK_SITUATION" });
check(r.status === 201, "المجال طبي تلقائياً (جهة التدريب مستشفى)");
const qsId = r.json.id;
await api(S1, "PATCH", `/api/forms/${qsId}`, { data: { situationDate: "2026-09-22", medicalFileNumber: "MRN-778812", medicalVisitType: "INPATIENT", hospitalDepartment: "الباطنية", referralSource: "الطبيب المعالج", summary: "…", actionsTaken: "…" } });
r = await tr(S1, qsId, { action: "SUBMIT" });
check(r.status === 200, "رفع الموقف السريع", r.json);
check((await api(F1, "GET", `/api/forms/${qsId}`)).json.form.data.medicalFileNumber === "MRN-778812", "المشرف المؤسسي يرى الرقم كاملاً");
check((await api(A1, "GET", `/api/forms/${qsId}`)).json.form.data.medicalFileNumber === "MRN-778812", "المشرف الأكاديمي المسؤول يرى الرقم كاملاً (قرار القسم)");
check((await api(TH, "GET", `/api/forms/${qsId}`)).json.form.data.medicalFileNumber === "•••••••812", "رئيس الوحدة يرى الرقم مخفياً");
check((await api("omar.alnamlah@qu.edu.sa", "GET", `/api/forms/${qsId}`)).json.form.data.medicalFileNumber === "•••••••812", "رئيس القسم يرى الرقم مخفياً");
check((await api(A1, "GET", `/api/forms/${qsId}`)).json.form.title === "تسجيل الموقف السريع بالمستشفى", "العنوان الرسمي حسب المجال");

// =====================================================================
section("هـ2) البرنامج الجماعي والمجتمعي: أجزاء مختلفة لكل نوع، ورقم متسلسل");
for (const [kind, parts] of [["GROUP_PROGRAM", { preparationPart: words(45), narrativePart: words(90), analyticalPart: words(65) }], ["COMMUNITY_PROGRAM", { planningPart: words(45), executionPart: words(70) }]]) {
  r = await api(S1, "POST", "/api/forms", { kind });
  const id = r.json.id;
  const stat = { programDate: "2026-09-20", startTime: "09:00", durationMinutes: 60, membersCount: 12, supervisorsCount: 2, advisorName: "أ. رائد", leaderName: "عضو", programType: "توعوي", programTitle: "لقاء", goals: "…", positives: ["تفاعل"], negatives: ["ضيق الوقت"] };
  r = await api(S1, "PATCH", `/api/forms/${id}`, { data: { ...stat, ...(kind === "GROUP_PROGRAM" ? { planningPart: "x" } : { narrativePart: "x" }) } });
  check(r.status === 422, `${kind}: رفض جزء لا يخص هذا النوع`);
  r = await api(S1, "PATCH", `/api/forms/${id}`, { data: { ...stat, ...parts } });
  r = await tr(S1, id, { action: "SUBMIT" });
  check(r.status === 200 && r.json.form.title.endsWith("رقم (1)"), `${kind}: رفع «${r.json?.form?.title}»`, r.json);
  check(!Object.keys(r.json.form.data).some((k) => ["planningPart", "narrativePart"].includes(k) && !(k in parts)), `${kind}: البيانات تخلو من أجزاء النوع الآخر`);
}

// =====================================================================
section("و) التقرير التعريفي: الاعتماد يحدّث إحصاءات الجهة");
r = await api(S1, "POST", "/api/forms", { kind: "ORGANIZATION_PROFILE" });
const opId = r.json.id;
r = await api(S1, "GET", `/api/forms/${opId}`);
check(r.json.form.data.organizationName?.includes("مستشفى") && r.json.form.data.supervisorName, "تعبئة مسبقة من دليل الجهات", r.json.form.data);
await api(S1, "PATCH", `/api/forms/${opId}`, { data: { directorName: "د. مدير المستشفى", goals: "تقديم الرعاية", socialWorkersCount: 7, beneficiariesCount: 15000, servicesOffered: "…", beneficiaryGroups: "المرضى وأسرهم", socialWorkerRoles: ["دراسة الحالات"], professionals: [{ specialty: "طبيب", count: 60 }] } });
await tr(S1, opId, { action: "SUBMIT" });
await tr(F1, opId, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR")] });
await tr(A1, opId, { action: "ACADEMIC_APPROVE" });
check(sql(`select "socialWorkersCount"||'/'||"beneficiariesCount" from "Organization" o join "Placement" p on p."organizationId"=o.id join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" where u.email='${S1}'`) === "7/15000", "إحصاءات الجهة محدّثة");

// =====================================================================
section("ح) التدريب بالمحاكاة: لا مباشرة ولا تعريفي ولا تحضير، والاعتماد أكاديمي مباشر");
const SIM = "441100025@qu.edu.sa";
r = await api(SIM, "POST", "/api/forms", { kind: "COMMENCEMENT" });
check(r.status === 422 && r.json.error.includes("المحاكاة"), "نموذج المباشرة غير متاح", r.json);
r = await api(SIM, "POST", "/api/forms", { kind: "ORGANIZATION_PROFILE" });
check(r.status === 422, "التقرير التعريفي بالمؤسسة غير متاح");
r = await api(SIM, "POST", "/api/attendance/check-in", { samples: [{ latitude: 26.3489, longitude: 43.7668, accuracy: 10, timestamp: Date.now() }] });
check(r.status === 422 && r.json.error.includes("المحاكاة"), "التحضير الجغرافي مرفوض", r.json);
r = await api(SIM, "GET", "/api/attendance/today");
check(r.json.simulation === true && r.json.placement === null, "شاشة التحضير تعرف أنه طالب محاكاة");
r = await api(SIM, "POST", "/api/forms", { kind: "READING" });
const simRd = r.json.id;
await api(SIM, "PATCH", `/api/forms/${simRd}`, { data: { sourceType: "JOURNAL_ARTICLE", readingDate: "2026-09-15", authors: ["Smith, J."], publicationYear: 2023, title: "T", containerTitle: "J", volume: "4", purpose: words(20), professionalBenefit: words(45) } });
r = await api(SIM, "POST", "/api/forms", { kind: "QUICK_SITUATION", domain: "SCHOOL" });
const simQs = r.json.id;
check(r.status === 201, "الموقف السريع متاح (المجال يُحدد يدوياً)");
await api(SIM, "PATCH", `/api/forms/${simQs}`, { data: { situationDate: "2026-09-16", schoolGrade: "الثاني المتوسط", referralSource: "المعلم", summary: "موقف تدريبي بالمحاكاة", actionsTaken: "…" } });
r = await tr(SIM, simQs, { action: "SUBMIT" });
check(r.status === 200 && r.json.form.mode === "SIMULATION" && !r.json.form.policy.fieldApproval, "رُفع بمسار المحاكاة (بلا مشرف مؤسسي)", r.json?.form?.policy);
r = await tr("academic1@qu.edu.sa", simQs, { action: "ACADEMIC_APPROVE" });
check(r.status === 200 && r.json.form.status === "REVIEWED", "اعتماد أكاديمي مباشر دون توقيع مؤسسي");
r = await api(TH, "GET", `/api/forms?placementId=${sql(`select p.id from "Placement" p join "StudentProfile" s on s.id=p."studentId" where s."universityId"='441100025'`)}`);
check(r.json.forms.length === 1 && r.json.forms[0].kind === "QUICK_SITUATION", "رئيس الوحدة يرى نماذج طالب المحاكاة المرفوعة فقط");

// =====================================================================
section("ز) القوائم والقفل بعد اعتماد النتيجة");
r = await api(S1, "GET", "/api/forms");
const order = r.json.forms.map((f) => f.kind);
check(order.indexOf("ORGANIZATION_PROFILE") < order.indexOf("TRAINING_PLAN") && order.indexOf("TRAINING_PLAN") < order.indexOf("READING"), "القائمة بترتيب السجل المهني", order);
r = await api(F1, "GET", "/api/forms");
check(!r.json.forms.some((f) => f.kind === "READING" || f.status === "DRAFT"), "قائمة المشرف المؤسسي: بلا قراءات ولا مسودات");
const plS1 = sql(`select p.id from "Placement" p join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" where u.email='${S1}'`);
r = await api(TH, "POST", "/api/grades/approve", { placementIds: [plS1], publish: true });
check(r.status === 200, "اعتماد النتيجة النهائية");
r = await api(S1, "PATCH", `/api/forms/${slId}`, { data: { difficulties: "x" } });
check(r.status === 403, "النموذج مقفل: لا تعديل");
r = await api(S1, "GET", `/api/forms/${slId}`);
check(r.json.form.locked === true && !r.json.form.allowedActions.includes("SUBMIT"), "المقفل لا يُرفع");

await b.close();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
