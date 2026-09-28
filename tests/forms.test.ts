import { test } from "node:test";
import assert from "node:assert/strict";
import { FORM_POLICIES, formDisplayTitle } from "../src/lib/forms/catalog.ts";
import { nextState } from "../src/lib/forms/workflow.ts";
import { allowedActions, can, type Actor } from "../src/lib/forms/permissions.ts";
import { countWords, looksLikeBulletList, narrativeIssues } from "../src/lib/forms/narrative.ts";
import { formatApa, normalizeDoi } from "../src/lib/forms/apa.ts";
import { validateForm } from "../src/lib/forms/schemas/index.ts";
import { applyPrivacy, maskIdentifier } from "../src/lib/forms/privacy.ts";
import { canonicalJson } from "../src/lib/forms/canonical.ts";
import { sanitizeUpload, sniffMime, stripJpegMetadata, stripPngMetadata } from "../src/lib/files/sanitize.ts";

const P = FORM_POLICIES;
const words = (n: number) => Array.from({ length: n }, (_, i) => `كلمة${i}`).join(" ");

// ------------------------------------------------------------ سير العمل
test("workflow: المسار القياسي والإعادة", () => {
  const cs = P.CASE_STUDY;
  assert.deepEqual(nextState(cs, "DRAFT", "SUBMIT"), { ok: true, to: "SUBMITTED", requiredSlots: [], clearSignatures: false, requiresComment: false });
  assert.equal((nextState(cs, "SUBMITTED", "FIELD_SIGN") as { to: string }).to, "SIGNED");
  assert.equal(nextState(cs, "SUBMITTED", "ACADEMIC_APPROVE").ok, false, "لا اعتماد أكاديمي قبل التوقيع المؤسسي");
  assert.equal((nextState(cs, "SIGNED", "ACADEMIC_APPROVE") as { to: string }).to, "REVIEWED");
  const ret = nextState(cs, "SIGNED", "ACADEMIC_RETURN");
  assert.ok(ret.ok && ret.to === "RETURNED" && ret.clearSignatures && ret.requiresComment);
  assert.equal((nextState(cs, "RETURNED", "SUBMIT") as { to: string }).to, "SUBMITTED");
  assert.equal(nextState(cs, "REVIEWED", "SUBMIT").ok, false);
  assert.equal(nextState(cs, "DRAFT", "SUBMIT", { locked: true }).ok, false, "المقفل لا ينتقل");
});

test("workflow: المباشرة تتطلب توقيع الطالب ثم المشرف والمدير", () => {
  const s = nextState(P.COMMENCEMENT, "DRAFT", "SUBMIT");
  assert.ok(s.ok && s.requiredSlots.includes("STUDENT"));
  const f = nextState(P.COMMENCEMENT, "SUBMITTED", "FIELD_SIGN");
  assert.ok(f.ok && f.requiredSlots.includes("FIELD_SUPERVISOR") && f.requiredSlots.includes("ORG_DIRECTOR"));
});

test("workflow: القراءات تتجاوز المشرف المؤسسي", () => {
  assert.equal(nextState(P.READING, "SUBMITTED", "FIELD_SIGN").ok, false);
  assert.equal((nextState(P.READING, "SUBMITTED", "ACADEMIC_APPROVE") as { to: string }).to, "REVIEWED");
});

// ------------------------------------------------------------ الصلاحيات
const actor = (o: Partial<Actor>): Actor => ({ role: "STUDENT", isOwner: false, isFieldSupervisor: false, isAcademicSupervisor: false, ...o });
const owner = actor({ isOwner: true });
const field = actor({ role: "FIELD_SUPERVISOR", isFieldSupervisor: true });
const academic = actor({ role: "ACADEMIC_SUPERVISOR", isAcademicSupervisor: true });
const deptHead = actor({ role: "DEPARTMENT_HEAD" });
const strangerSupervisor = actor({ role: "FIELD_SUPERVISOR" });
const st = (status: "DRAFT" | "SUBMITTED" | "SIGNED" | "RETURNED" | "REVIEWED", o = {}) => ({ status, locked: false, everSubmitted: status !== "DRAFT", ...o });

test("permissions: المسودة لا يراها إلا الطالب", () => {
  assert.equal(can(owner, P.CASE_STUDY, st("DRAFT"), "VIEW"), true);
  for (const a of [field, academic, deptHead]) assert.equal(can(a, P.CASE_STUDY, st("DRAFT"), "VIEW"), false);
  assert.equal(can(strangerSupervisor, P.CASE_STUDY, st("SUBMITTED"), "VIEW"), false, "مشرف غير مسند");
});

test("permissions: مصفوفة الإجراءات لكل دور", () => {
  assert.deepEqual(allowedActions(owner, P.CASE_STUDY, st("DRAFT")), ["VIEW", "EDIT", "DELETE", "UPLOAD", "EXPORT", "SUBMIT"]);
  assert.deepEqual(allowedActions(field, P.CASE_STUDY, st("SUBMITTED")), ["VIEW", "COMMENT", "EXPORT", "FIELD_SIGN", "FIELD_RETURN"]);
  assert.deepEqual(allowedActions(academic, P.CASE_STUDY, st("SIGNED")), ["VIEW", "COMMENT", "EXPORT", "ACADEMIC_APPROVE", "ACADEMIC_RETURN"]);
  assert.deepEqual(allowedActions(deptHead, P.CASE_STUDY, st("SIGNED")), ["VIEW", "EXPORT"], "رئيس القسم قراءة فقط");
  assert.equal(can(owner, P.CASE_STUDY, st("SUBMITTED"), "EDIT"), false, "لا تعديل بعد الرفع");
  assert.equal(can(owner, P.CASE_STUDY, st("RETURNED"), "DELETE"), false, "لا حذف لنموذج سبق رفعه");
  assert.equal(can(owner, P.CASE_STUDY, st("RETURNED", { locked: true }), "EDIT"), false, "المقفل لا يُعدَّل");
});

test("permissions: الخطة يعدلها المشرف المؤسسي أثناء المراجعة، والقراءات لا يراها", () => {
  assert.equal(can(field, P.TRAINING_PLAN, st("SUBMITTED"), "EDIT"), true);
  assert.equal(can(field, P.CASE_STUDY, st("SUBMITTED"), "EDIT"), false);
  assert.equal(can(field, P.READING, st("SUBMITTED"), "VIEW"), false);
  assert.equal(can(academic, P.READING, st("SUBMITTED"), "ACADEMIC_APPROVE"), true);
});

// ------------------------------------------------------------ النص السردي
test("narrative: عدّ الكلمات وكشف النقاط", () => {
  assert.equal(countWords("  اكتسبت مهارة   المقابلة المهنية - 2 "), 5);
  assert.equal(looksLikeBulletList("- مهارة الإنصات\n- مهارة التعاطف\n- مهارة التلخيص"), true);
  assert.equal(looksLikeBulletList("1. الإنصات\n2. التعاطف\n٣) التلخيص\nوختاماً تعلمت الكثير"), true);
  assert.equal(looksLikeBulletList("اكتسبت خلال اليوم مهارة الإنصات الفعال.\nكما تعلمت التلخيص."), false);
  assert.deepEqual(narrativeIssues("المهارات", "- أ\n- ب\n- ج", { minWords: 2, noBullets: true }), ["المهارات: يُكتب بأسلوب سردي علمي متصل وليس نقاطاً"]);
});

// ------------------------------------------------------------ APA
test("apa: مقال مجلة إنجليزي بـ DOI", () => {
  const r = formatApa({ sourceType: "JOURNAL_ARTICLE", authors: ["Smith, J. A.", "Lee, K."], publicationYear: 2023, title: "Social work in hospitals", containerTitle: "Health & Social Work", volume: "48", issue: "2", pages: "101-110", doi: "doi:10.1093/hsw/hlad001" });
  assert.equal(r.text, "Smith, J. A., & Lee, K. (2023). Social work in hospitals. Health & Social Work, 48(2), 101–110. https://doi.org/10.1093/hsw/hlad001");
  assert.ok(r.html.includes("<i>48</i>(2)"));
});

test("apa: فصل في كتاب عربي بلا سنة", () => {
  const r = formatApa({ sourceType: "BOOK_CHAPTER", authors: ["العتيبي، خ.", "الحربي، س."], title: "الممارسة المهنية", editors: "ن. السبيعي", containerTitle: "الخدمة الاجتماعية الطبية", pages: "45-80", publisher: "دار الزهراء" });
  assert.equal(r.text, "العتيبي، خ.، والحربي، س. (د.ت.). الممارسة المهنية. في ن. السبيعي (محرر)، الخدمة الاجتماعية الطبية (ص ص. 45–80). دار الزهراء.");
});

test("apa: DOI وأكثر من 20 مؤلفاً", () => {
  assert.equal(normalizeDoi("https://dx.doi.org/10.1000/xyz123"), "https://doi.org/10.1000/xyz123");
  assert.equal(normalizeDoi("ليس doi"), null);
  const many = Array.from({ length: 22 }, (_, i) => `A${i}, B.`);
  const r = formatApa({ sourceType: "JOURNAL_ARTICLE", authors: many, publicationYear: 2020, title: "T", containerTitle: "J", volume: "1" });
  assert.ok(r.text.startsWith("A0, B., A1, B.") && r.text.includes(". . . A21, B."));
});

// ------------------------------------------------------------ المخططات
const FULL: Record<string, Record<string, unknown>> = {
  COMMENCEMENT: { commencementDate: "2026-09-06", fixedTrainingDay: 0, shift: "MORNING", declarationAccepted: true },
  ORGANIZATION_PROFILE: {
    organizationName: "مستشفى بريدة المركزي", location: "بريدة", workField: "خدمة طبية", directorName: "أ. مدير", supervisorName: "أ. مشرف",
    goals: "تقديم الرعاية", socialWorkersCount: 6, beneficiariesCount: 12000, servicesOffered: "…", beneficiaryGroups: "المرضى وأسرهم",
    socialWorkerRoles: ["دراسة الحالات", "التوعية"], professionals: [{ specialty: "طبيب", count: 40 }],
  },
  TRAINING_PLAN: { generalGoal: "إكساب مهارات الممارسة", weeks: [{ weekNumber: 1, tasks: "التعرف على المؤسسة", responsible: "الطالب" }] },
  SKILLS_LOG: { weekNumber: 2, logDate: "2026-09-13", topics: ["حضور مقابلة"], skillsNarrative: words(55), knowledgeNarrative: words(52) },
  GROUP_PROGRAM: {
    programDate: "2026-09-20", startTime: "09:00", durationMinutes: 60, membersCount: 12, programType: "ثقافي", programTitle: "لقاء توعوي", goals: "…",
    positives: ["تفاعل"], preparationPart: words(45), narrativePart: words(90), analyticalPart: words(65),
  },
  COMMUNITY_PROGRAM: {
    programDate: "2026-09-21", startTime: "10:00", durationMinutes: 120, membersCount: 80, programType: "توعوي", programTitle: "يوم صحي", goals: "…",
    positives: ["إقبال"], planningPart: words(45), executionPart: words(70),
  },
  INTERVIEW: { interviewDate: "2026-09-14", durationMinutes: 45, location: "مكتب الأخصائي", parties: "العميل", goals: "بناء العلاقة", content: words(70), skillsUsed: "الإنصات", positives: "تجاوب العميل" },
  READING: { sourceType: "JOURNAL_ARTICLE", readingDate: "2026-09-15", authors: ["Smith, J."], publicationYear: 2023, title: "T", containerTitle: "J", volume: "4", purpose: words(20), professionalBenefit: words(45) },
};

test("schemas: كل نموذج كامل يجتاز تحقق الرفع", () => {
  for (const [kind, data] of Object.entries(FULL)) {
    const r = validateForm(kind as never, data, "submit");
    assert.ok(r.ok, `${kind}: ${JSON.stringify(!r.ok && r.issues)}`);
  }
  assert.ok(validateForm("QUICK_SITUATION", { situationDate: "2026-09-22", referralSource: "الطبيب", summary: "…", actionsTaken: "…", medicalVisitType: "INPATIENT", hospitalDepartment: "الباطنية" }, "submit", "MEDICAL").ok);
});

test("schemas: المسودة تقبل الناقص وترفض الحقول الغريبة والأنواع الخاطئة", () => {
  assert.ok(validateForm("CASE_STUDY", { caseAlias: "الحالة (أ)" }, "draft").ok);
  assert.equal(validateForm("CASE_STUDY", { evil: 1 }, "draft").ok, false);
  assert.equal(validateForm("SKILLS_LOG", { topics: ["1", "2", "3", "4", "5", "6", "7"] }, "draft").ok, false, "حد 6 موضوعات");
  assert.equal(validateForm("COMMENCEMENT", { fixedTrainingDay: 5 }, "draft").ok, false, "الجمعة ليست يوم تدريب");
  assert.equal(validateForm("COMMUNITY_PROGRAM", { narrativePart: "x" }, "draft").ok, false, "المجتمعي لا يقبل الجزء القصصي");
  assert.equal(validateForm("SKILLS_LOG", { logDate: "2026-02-30x" }, "draft").ok, false);
});

test("schemas: قواعد الرفع الشرطية", () => {
  const bullets = { ...FULL.SKILLS_LOG, skillsNarrative: Array.from({ length: 12 }, (_, i) => `- مهارة رقم ${i} اكتسبتها اليوم في الميدان`).join("\n") };
  const r1 = validateForm("SKILLS_LOG", bullets, "submit");
  assert.ok(!r1.ok && r1.issues.some((i) => i.message.includes("ليس نقاطاً")));

  const r2 = validateForm("COMMENCEMENT", { ...FULL.COMMENCEMENT, declarationAccepted: false }, "submit");
  assert.ok(!r2.ok && r2.issues[0].path === "declarationAccepted");

  const r3 = validateForm("QUICK_SITUATION", { situationDate: "2026-09-22", referralSource: "x", summary: "x", actionsTaken: "x" }, "submit", "MEDICAL");
  assert.ok(!r3.ok && r3.issues.some((i) => i.path === "medicalVisitType"));

  const r4 = validateForm("READING", { ...FULL.READING, sourceType: "BOOK_CHAPTER", volume: null }, "submit");
  assert.ok(!r4.ok && r4.issues.some((i) => i.path === "publisher"));

  const r5 = validateForm("CASE_STUDY", { caseAlias: "(أ)", consentConfirmed: true, terminationType: "PLANNED", plannedGoalsAchieved: true }, "submit");
  assert.ok(!r5.ok);
  const paths = r5.issues.map((i) => i.path);
  assert.ok(paths.includes("plannedTimeAppropriate") && !paths.includes("plannedGoalsAchieved") && paths.includes("familyMembers"));
  assert.ok(!paths.includes("unplannedWorkerFactors"), "لا يطلب عوامل غير المخطط عند الإنهاء المخطط");

  const r6 = validateForm("TRAINING_PLAN", { generalGoal: "x", weeks: [{ weekNumber: 1, tasks: "a", responsible: "b" }, { weekNumber: 1, tasks: "c", responsible: "d" }] }, "submit");
  assert.ok(!r6.ok && r6.issues.some((i) => i.message.includes("مكرر")));
});

// ------------------------------------------------------------ الخصوصية والبصمة
test("privacy: إخفاء رقم الملف الطبي لغير الطالب والمشرف المؤسسي", () => {
  assert.equal(maskIdentifier("MRN-2026-8841"), "••••••••••841");
  const data = { medicalFileNumber: "778812", summary: "x" };
  assert.equal(applyPrivacy("QUICK_SITUATION", data, { isOwner: false, isFieldSupervisor: false, isAcademicSupervisor: false }).medicalFileNumber, "•••812");
  assert.equal(applyPrivacy("QUICK_SITUATION", data, { isOwner: false, isFieldSupervisor: true, isAcademicSupervisor: false }).medicalFileNumber, "778812");
});

test("canonicalJson: البصمة لا تتأثر بترتيب المفاتيح", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } }), canonicalJson({ a: { d: [2, { y: 2, z: 1 }] }, b: 1 }));
});

// ------------------------------------------------------------ الملفات
const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const bytes = (s: string) => [...s].map((c) => c.charCodeAt(0));

test("files: تحديد النوع من المحتوى لا من الاسم", () => {
  assert.equal(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffMime(new Uint8Array(bytes("%PDF-1.7"))), "application/pdf");
  assert.equal(sniffMime(new Uint8Array(bytes("<html>fake.jpg"))), null);
  assert.equal(sanitizeUpload(new Uint8Array(bytes("MZ\x90\x00 exe"))), null);
});

test("files: إزالة EXIF (بما فيه GPS) من JPEG مع إبقاء بيانات الصورة", () => {
  const app0 = seg(0xe0, bytes("JFIF\0\x01\x01"));
  const exif = seg(0xe1, bytes("Exif\0\0GPSLatitude=26.3415;GPSLongitude=43.9632"));
  const dqt = seg(0xdb, [0, 1, 2, 3]);
  const sos = [0xff, 0xda, 0, 4, 1, 2, 0x11, 0x22, 0x33, 0xff, 0xd9];
  const jpeg = new Uint8Array([0xff, 0xd8, ...app0, ...exif, ...dqt, ...sos]);
  const out = stripJpegMetadata(jpeg);
  const s = String.fromCharCode(...out);
  assert.ok(!s.includes("Exif") && !s.includes("GPS"), "أزيلت بيانات الموقع");
  assert.ok(s.includes("JFIF"), "بقي APP0");
  assert.equal(out.length, jpeg.length - exif.length);
  assert.deepEqual([...out.slice(-11)], sos, "بيانات الصورة سليمة");
});

test("files: إزالة النصوص الوصفية من PNG", () => {
  const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...bytes(type), ...data, 1, 2, 3, 4];
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk("IHDR", [1, 2]), ...chunk("tEXt", bytes("Author\0x")), ...chunk("eXIf", [9]), ...chunk("IDAT", [5]), ...chunk("IEND", [])]);
  const s = String.fromCharCode(...stripPngMetadata(png));
  assert.ok(s.includes("IHDR") && s.includes("IDAT") && s.includes("IEND"));
  assert.ok(!s.includes("tEXt") && !s.includes("eXIf"));
});

test("catalog: عناوين العرض الرسمية", () => {
  assert.equal(formDisplayTitle("GROUP_PROGRAM", 2), "تقرير البرنامج الجماعي رقم (2)");
  assert.equal(formDisplayTitle("QUICK_SITUATION", 1, "MEDICAL"), "تسجيل الموقف السريع بالمستشفى");
  assert.equal(formDisplayTitle("COMMENCEMENT", 1), "مباشرة الطالب/ـة لمؤسسة التدريب الميداني");
});

// ------------------------------------------------------------ قرارات القسم (المرحلة 3)
import { isKindApplicable, kindsForMode, policyFor } from "../src/lib/forms/catalog.ts";
import { calculateFinalGrade } from "../src/lib/grading/engine.ts";

test("privacy: المشرف الأكاديمي المسؤول يرى الرقم كاملاً، ويُحجب عن رئاسة القسم", () => {
  const data = { medicalFileNumber: "778812" };
  assert.equal(applyPrivacy("QUICK_SITUATION", data, { isOwner: false, isFieldSupervisor: false, isAcademicSupervisor: true }).medicalFileNumber, "778812");
  assert.equal(applyPrivacy("QUICK_SITUATION", data, { isOwner: false, isFieldSupervisor: false, isAcademicSupervisor: false }).medicalFileNumber, "•••812");
});

test("simulation: استثناء نماذج المقر، ومسار أكاديمي مباشر", () => {
  assert.equal(isKindApplicable("COMMENCEMENT", "SIMULATION"), false);
  assert.equal(isKindApplicable("ORGANIZATION_PROFILE", "SIMULATION"), false);
  assert.equal(isKindApplicable("CASE_STUDY", "SIMULATION"), true);
  assert.deepEqual(kindsForMode("SIMULATION"), ["TRAINING_PLAN", "SKILLS_LOG", "GROUP_PROGRAM", "COMMUNITY_PROGRAM", "QUICK_SITUATION", "CASE_STUDY", "INTERVIEW", "READING"]);
  const sim = policyFor("CASE_STUDY", "SIMULATION");
  assert.equal(sim.fieldApproval, false);
  assert.equal((nextState(sim, "SUBMITTED", "ACADEMIC_APPROVE") as { to: string }).to, "REVIEWED", "بلا توقيع مؤسسي");
  assert.equal(policyFor("CASE_STUDY", "FIELD").fieldApproval, true, "الميداني دون تغيير");
  assert.equal(can(academic, sim, st("SUBMITTED"), "ACADEMIC_APPROVE"), true);
});

test("grading: مكوّن التحضير للمحاكاة من السجلات الأسبوعية وحدها", () => {
  const base = { weights: { fieldWeight: 40, academicWeight: 40, attendanceWeight: 20 }, fieldPercentage: 90, academicPercentage: 90, approvedMinutes: 0, requiredHours: 180, expectedWeeklyLogbooks: 10, submittedWeeklyLogbooks: 9, unexcusedAbsences: 0 };
  assert.equal(calculateFinalGrade(base).attendanceComponent, 9, "الميداني: الساعات صفر تُخفّض المكوّن");
  assert.equal(calculateFinalGrade({ ...base, hoursApplicable: false }).attendanceComponent, 18, "المحاكاة: 0.9 × 20");
});

test("grading: المحاكاة تنقل وزن المشرف المؤسسي كاملاً إلى الأكاديمي", () => {
  const input = {
    weights: { fieldWeight: 40, academicWeight: 40, attendanceWeight: 20 },
    fieldPercentage: null, academicPercentage: 85, approvedMinutes: 0, requiredHours: 180,
    expectedWeeklyLogbooks: 10, submittedWeeklyLogbooks: 10, unexcusedAbsences: 0,
    hoursApplicable: false, fieldApplicable: false,
  };
  const sim = calculateFinalGrade(input);
  assert.equal(sim.fieldComponent, 0);
  assert.equal(sim.academicComponent, 68, "0.85 × 80");
  assert.equal(sim.total, 88);
  assert.deepEqual(sim.details.effectiveWeights, { fieldWeight: 0, academicWeight: 80, attendanceWeight: 20 });
  assert.ok(!sim.details.missing.includes("تقييم المشرف الميداني"), "لا يُطلب تقييم ميداني");
  assert.equal(sim.passed, true);
  // تقييم ميداني قديم (إن وُجد خطأً) لا يُحتسب
  assert.equal(calculateFinalGrade({ ...input, fieldPercentage: 100 }).total, 88);
});

// ------------------------------------------------------------ تغطية الواجهات للمخططات
import { specFor, specKeys } from "../src/lib/forms/ui/specs.ts";
import { schemasFor } from "../src/lib/forms/schemas/index.ts";
import { checkSubmit } from "../src/lib/forms/ui/requirements.ts";

const VARIANTS: [string, "SCHOOL" | "MEDICAL" | null][] = [
  ["COMMENCEMENT", null], ["ORGANIZATION_PROFILE", null], ["TRAINING_PLAN", null], ["SKILLS_LOG", null], ["GROUP_PROGRAM", null],
  ["COMMUNITY_PROGRAM", null], ["QUICK_SITUATION", "SCHOOL"], ["QUICK_SITUATION", "MEDICAL"], ["CASE_STUDY", null], ["INTERVIEW", null], ["READING", null],
];

test("ui specs: كل حقل في المخطط له عنصر في الواجهة والعكس", () => {
  for (const [kind, domain] of VARIANTS) {
    const spec = specFor(kind as never, domain);
    const editable = spec.sections.flatMap((s) => s.fields).filter((f) => f.widget.type !== "readonly").map((f) => f.key);
    const shape = Object.keys((schemasFor(kind as never, domain).draft as unknown as { shape: Record<string, unknown> }).shape);
    const label = `${kind}${domain ? `:${domain}` : ""}`;
    assert.deepEqual(editable.filter((k) => !shape.includes(k)), [], `${label}: حقول في الواجهة غير موجودة في المخطط`);
    assert.deepEqual(shape.filter((k) => !editable.includes(k)), [], `${label}: حقول في المخطط بلا واجهة`);
    assert.equal(new Set(specKeys(spec)).size, specKeys(spec).length, `${label}: مفتاح مكرر`);
  }
});

test("ui specs: كل حقل مطلوب عند الرفع ظاهر في الواجهة", () => {
  for (const [kind, domain] of VARIANTS) {
    const keys = specKeys(specFor(kind as never, domain));
    const missing = Object.keys(checkSubmit(kind as never, {}, domain).byField).filter((k) => k !== "_" && !keys.includes(k));
    assert.deepEqual(missing, [], `${kind}: حقول مطلوبة لا تظهر في الواجهة`);
  }
});

test("checkSubmit: رسائل مجمعة حسب الحقل", () => {
  const r = checkSubmit("COMMENCEMENT", { commencementDate: "2026-09-06", fixedTrainingDay: 1, shift: "MORNING" });
  assert.equal(r.ready, false);
  assert.deepEqual(Object.keys(r.byField), ["declarationAccepted"]);
  assert.equal(checkSubmit("COMMENCEMENT", { commencementDate: "2026-09-06", fixedTrainingDay: 1, shift: "MORNING", declarationAccepted: true }).ready, true);
});

import { customSpec, CUSTOM_CREATABLE } from "../src/lib/forms/ui/custom.ts";
import { REPORT_TEMPLATES as TEMPLATES } from "../src/lib/report-templates.ts";

test("custom specs: القوالب الإضافية والسجلات القديمة تُعرض كاملة", () => {
  for (const [key, t] of Object.entries(TEMPLATES)) {
    const keys = specKeys(customSpec(key));
    assert.deepEqual(keys, t.sections.flatMap((s) => s.fields.map((f) => f.key)), key);
  }
  assert.ok(specKeys(customSpec("LEGACY_LOGBOOK_WEEKLY")).includes("activities"));
  assert.deepEqual([...CUSTOM_CREATABLE], ["FIELD_RESEARCH", "SOCIAL_SURVEY", "FINAL_REPORT"]);
});
