// =====================================================================
//  بيانات العرض التوضيحي: رحلة طالب ميداني كاملة بمحتوى واقعي عبر واجهات المنصة نفسها
//  (التحقق والتواقيع والبصمات كما في الاستخدام الفعلي) + اجتماع إشرافي + كشوف موقّعة + طالب محاكاة
//  التشغيل (والخادم يعمل): npm run demo:data     — بعد: npm run db:seed && npm run db:migrate-legacy -- --apply
// =====================================================================
import { readFileSync } from "node:fs";

const B = process.env.BASE_URL ?? "http://localhost:3000";
const SIG = readFileSync("prisma/fixtures/sample-signature.txt", "utf8").trim();
const STAMP = readFileSync("public/brand/emblem-512.png");
const sessions = {};

/** جلسة HTTP بسيطة بملفات تعريف الارتباط (دون متصفح) */
function jar() {
  const cookies = new Map();
  return {
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    store: (res) => {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1));
      }
    },
  };
}

async function as(email) {
  if (sessions[email]) return sessions[email];
  const j = jar();
  const r1 = await fetch(`${B}/api/auth/csrf`);
  j.store(r1);
  const { csrfToken } = await r1.json();
  const r2 = await fetch(`${B}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: j.header() },
    body: new URLSearchParams({ csrfToken, email, password: "Qu@12345", json: "true" }),
  });
  j.store(r2);
  if (!j.header().includes("session-token")) throw new Error(`تعذر دخول ${email}`);
  return (sessions[email] = j);
}
async function call(email, method, url, data, multipart) {
  const j = await as(email);
  let body, headers = { Cookie: j.header() };
  if (multipart) {
    body = new FormData();
    for (const [k, f] of Object.entries(multipart)) body.append(k, new Blob([f.buffer], { type: f.mimeType }), f.name);
  } else if (data !== undefined) {
    body = JSON.stringify(data);
    headers["Content-Type"] = "application/json";
  }
  const r = await fetch(B + url, { method, headers, body });
  const json = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${url} (${email}) → ${r.status}: ${JSON.stringify(json).slice(0, 600)}`);
  return json;
}
const sig = (slot, extra = {}) => ({ slot, imageData: SIG, ...extra });
const tr = (email, id, body) => call(email, "POST", `/api/forms/${id}/transition`, body);
const log = (s) => console.log(`  ✓ ${s}`);
const daysAgo = (n) => new Date(Date.now() + 3 * 3600_000 - n * 86_400_000).toISOString().slice(0, 10);

const S = "441100001@qu.edu.sa", F = "field1@example.sa", A = "academic1@qu.edu.sa", SIM = "441100025@qu.edu.sa";

/** ينشئ نموذجاً ويحفظ بياناته ويسير به في مسار الاعتماد حتى المرحلة المطلوبة */
async function flow(kind, data, { until = "REVIEWED", score, domain, studentSig = false, email = S, field = true } = {}) {
  const { id } = await call(email, "POST", "/api/forms", { kind, ...(domain ? { domain } : {}) });
  await call(email, "PATCH", `/api/forms/${id}`, { data });
  await tr(email, id, { action: "SUBMIT", ...(studentSig ? { signatures: [sig("STUDENT")] } : {}) });
  if (until === "SUBMITTED") return id;
  if (field) {
    await tr(F, id, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR"), ...(kind === "COMMENCEMENT" ? [sig("ORG_DIRECTOR", { signerName: "د. سليمان الحربي", withStamp: true })] : [])] });
    if (until === "SIGNED") return id;
  }
  await tr(A, id, { action: "ACADEMIC_APPROVE", ...(score ? { score } : {}) });
  return id;
}

console.log("بيانات العرض التوضيحي");
// ------------------------------------------------------------------ الختم الرسمي للمؤسسة
const orgId = (await call(F, "GET", "/api/attendance-sheets")).organization.id;
await call(F, "POST", `/api/organizations/${orgId}/stamp`, undefined, { file: { name: "stamp.png", mimeType: "image/png", buffer: STAMP } });
log("رفع ختم المؤسسة الرسمي");

// ------------------------------------------------------------------ 1) المباشرة
await flow("COMMENCEMENT", { fixedTrainingDay: 0, shift: "MORNING", declarationAccepted: true }, { studentSig: true });
log("مباشرة التدريب: توقيع الطالب والمشرف المؤسسي ومدير المؤسسة بالختم، واعتماد أكاديمي");

// ------------------------------------------------------------------ 2) التقرير التعريفي
await flow("ORGANIZATION_PROFILE", {
  directorName: "د. سليمان الحربي",
  goals: "تقديم رعاية صحية متكاملة لسكان منطقة القصيم، وتعزيز جودة الحياة للمرضى وأسرهم من خلال خدمات طبية ونفسية واجتماعية تراعي احتياجات المريض الشاملة، وتفعيل الشراكة المجتمعية في التوعية الصحية.",
  socialWorkersCount: 9, beneficiariesCount: 42000,
  servicesOffered: "العيادات الخارجية، والتنويم، والطوارئ، والعناية المركزة، وخدمات الرعاية المنزلية، وخدمات الخدمة الاجتماعية الطبية التي تشمل دراسة الحالات الاجتماعية للمرضى، والتدخل في الأزمات، والتنسيق مع الجمعيات الخيرية، وتنظيم برامج التوعية.",
  beneficiaryGroups: "المرضى المنومون ومرضى العيادات الخارجية وأسرهم، وكبار السن، ومرضى الأمراض المزمنة، والحالات المحوّلة من الطوارئ.",
  socialWorkerRoles: ["دراسة الحالات الاجتماعية للمرضى وأسرهم", "التدخل المهني في الأزمات والصدمات", "التنسيق مع الجهات الخيرية لتأمين الاحتياجات", "المشاركة في الفريق العلاجي", "إعداد برامج التثقيف الصحي والاجتماعي"],
  professionals: [{ specialty: "أطباء", count: 180 }, { specialty: "تمريض", count: 420 }, { specialty: "أخصائيون نفسيون", count: 6 }],
  studentNotes: "تتميز المؤسسة بوجود قسم خدمة اجتماعية نشط يعمل ضمن الفريق العلاجي، مع حاجة إلى زيادة عدد الأخصائيين مقارنة بعدد المستفيدين.",
});
log("التقرير التعريفي بالمؤسسة (يحدّث إحصاءات الجهة في الدليل)");

// ------------------------------------------------------------------ 3) خطة التدريب
{
  const { id } = await call(S, "POST", "/api/forms", { kind: "TRAINING_PLAN" });
  const { form } = await call(S, "GET", `/api/forms/${id}`);
  const tasks = [
    "جولة تعريفية بأقسام المستشفى، والتعرف على لوائح قسم الخدمة الاجتماعية",
    "حضور مقابلات الأخصائي مع المرضى الجدد، والتدرب على فتح الملف الاجتماعي",
    "دراسة حالة فردية تحت إشراف الأخصائي، وتسجيل المقابلة الأولى",
    "المشاركة في اجتماع الفريق العلاجي، وإعداد التقرير الاجتماعي",
    "تخطيط برنامج جماعي توعوي لمرضى السكري وأسرهم",
    "تنفيذ البرنامج الجماعي وتقييمه",
  ];
  const weeks = form.data.weeks.map((w, i) => ({ ...w, tasks: tasks[i] ?? `متابعة الحالات وتسجيل المهارات الأسبوعية — الأسبوع ${w.weekNumber}`, responsible: i < 2 ? "المشرف المؤسسي والطالب" : "الطالب بإشراف المشرف المؤسسي" }));
  await call(S, "PATCH", `/api/forms/${id}`, { data: { generalGoal: "إكساب الطالب مهارات الممارسة المهنية للخدمة الاجتماعية في المجال الطبي عبر مستويات الفرد والجماعة والمجتمع", weeks } });
  await tr(S, id, { action: "SUBMIT" });
  await tr(F, id, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR")] });
  await tr(A, id, { action: "ACADEMIC_APPROVE" });
  log("خطة التدريب (بالتشارك مع المشرف المؤسسي)");
}

// ------------------------------------------------------------------ 4) سجل المهارات والمعارف
const skills = "اكتسبت اليوم مهارة الإصغاء الواعي أثناء مقابلة مريض منوّم حديثاً، إذ حرصت على ترك مساحة كافية له ليعبّر عن مخاوفه من طول فترة العلاج، ولاحظت كيف ساعد التقبل غير المشروط على تخفيف توتره. كما تدربت على صياغة الأسئلة المفتوحة بدل المغلقة، وعلى تلخيص ما يقوله المريض للتأكد من فهمي لموقفه، ثم تعلمت من الأخصائي كيفية توثيق المقابلة توثيقاً مهنياً مختصراً يخدم الفريق العلاجي.";
const knowledge = "تعرفت على دور الأخصائي الاجتماعي الطبي ضمن الفريق العلاجي، وعلى الإجراءات المتبعة في تحويل الحالات إلى الجمعيات الخيرية لتأمين الأجهزة الطبية المنزلية، كما اطلعت على نظام حفظ السجلات الاجتماعية وسريتها. وأدركت أهمية الربط بين نظرية الأنساق والممارسة، إذ إن مشكلة المريض لا تنفصل عن أسرته وبيئة عمله وقدرته على الالتزام بالخطة العلاجية بعد الخروج.";
for (const [i, until] of [[0, "REVIEWED"], [1, "SUBMITTED"]]) {
  const { id } = await call(S, "POST", "/api/forms", { kind: "SKILLS_LOG" });
  await call(S, "PATCH", `/api/forms/${id}`, { data: { logDate: daysAgo(i === 0 ? 8 : 1), topics: i === 0 ? ["مقابلة مريض منوّم", "توثيق الملف الاجتماعي", "اجتماع الفريق العلاجي"] : ["متابعة حالة مزمنة", "التنسيق مع جمعية خيرية"], skillsNarrative: skills, knowledgeNarrative: knowledge, difficulties: "واجهت صعوبة في إدارة وقت المقابلة مع كثرة المقاطعات في القسم، وتغلبت عليها بالاتفاق مع الممرضة على وقت مناسب." } });
  await tr(S, id, { action: "SUBMIT" });
  if (until === "REVIEWED") {
    await tr(F, id, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR")] });
    await tr(A, id, { action: "ACADEMIC_APPROVE" });
  }
}
log("سجلا مهارات أسبوعيان (أحدهما بانتظار توقيع المشرف المؤسسي)");

// ------------------------------------------------------------------ 5) دراسة الحالة + مقابلة مرتبطة
const aspect = (t) => `${t} ويظهر ذلك في ملاحظات الفريق الطبي وحديث العميل خلال المقابلات الأولى.`;
const caseId = await flow("CASE_STUDY", {
  caseAlias: "الحالة (س)", consentConfirmed: true,
  familyMembers: [{ name: "(س)", age: 58, relation: "العميل", education: "ثانوي", occupation: "متقاعد" }, { name: "(ز)", age: 51, relation: "الزوجة", education: "جامعي", occupation: "معلمة" }, { name: "(ع)", age: 24, relation: "الابن", education: "جامعي", occupation: "موظف" }],
  physicalAspect: aspect("يعاني العميل من داء السكري من النوع الثاني ومضاعفات في القدم تستلزم تنويماً متكرراً، مع تعب عام وضعف في الحركة."),
  psychologicalAspect: aspect("تظهر على العميل مشاعر إحباط وقلق من فقدان الاستقلالية، وانسحاب من الحديث عن المستقبل."),
  mentalAspect: aspect("قدراته الإدراكية سليمة، ويفهم تعليمات العلاج، لكنه يقلل من خطورة عدم الالتزام بالحمية."),
  behavioralAspect: aspect("يميل إلى العزلة داخل الغرفة ويرفض زيارات الأصدقاء، ويتأخر في تناول الأدوية."),
  familyDynamics: "تربط العميل علاقة داعمة بزوجته، بينما يضعف التواصل مع الأبناء المقيمين خارج المدينة، ويشعر بأنه أصبح عبئاً على الأسرة.",
  mainProblem: "ضعف التكيف مع المرض المزمن وما ترتب عليه من انسحاب اجتماعي وعدم التزام بالخطة العلاجية",
  subProblems: ["القلق من فقدان العمل التطوعي", "ضعف التواصل الأسري", "عدم الالتزام بالحمية"], strengths: "دعم الزوجة، ومستوى تعليمي جيد، ورغبة معلنة في التحسن",
  participatingSystems: "الأسرة، والفريق الطبي، وأخصائي التغذية، وجمعية مرضى السكري", mainGoal: "تحسين تكيف العميل مع المرض والتزامه بالخطة العلاجية",
  subGoals: ["خفض مشاعر القلق", "تعزيز التواصل الأسري", "الالتزام بالحمية والأدوية"], professionalContract: "لقاء أسبوعي لمدة ستة أسابيع بحضور الزوجة في لقاءين",
  therapeuticModels: ["المعرفي السلوكي"], techniques: ["إعادة البناء المعرفي", "التعزيز"],
  initProblemsWellFormulated: true, initGoalsMeasurable: true, initGoalsAchievable: true, initTechniquesAppropriate: true, initResponsibilitiesClear: true,
  assessmentPositives: "تعاون العميل وتوفر معلومات كافية من الفريق الطبي", planningPositives: "أهداف واقعية قابلة للقياس بمشاركة العميل", interventionPositives: "تحسن ملحوظ في الالتزام بالأدوية وانخفاض العزلة",
  finalOutcome: "POSITIVE_CHANGE", terminationType: "PLANNED", plannedGoalsAchieved: true, plannedTimeAppropriate: true, plannedProblemHandled: true, plannedResourcesUsed: true, plannedNeedsReferral: false,
  followUpInterval: "CLOSE", followUpPurposes: ["SERVICE_EVALUATION"], followUpMethods: ["PHONE_CALLS"], resultPerformsSocialRole: true,
}, { score: 90 });
{
  const { id } = await call(S, "POST", "/api/forms", { kind: "INTERVIEW" });
  await call(S, "PATCH", `/api/forms/${id}`, { data: {
    caseStudyFormId: caseId, interviewDate: daysAgo(12), durationMinutes: 40, location: "مكتب الخدمة الاجتماعية بقسم الباطنية", parties: "العميل والطالب المتدرب بحضور الأخصائي",
    goals: "بناء العلاقة المهنية، واستكشاف مشاعر العميل تجاه المرض، والاتفاق على موعد اللقاء القادم",
    content: "بدأت المقابلة بالترحيب بالعميل وتوضيح دوري بوصفي متدرباً في قسم الخدمة الاجتماعية، وطمأنته بشأن سرية ما يدور في اللقاء. تحدث العميل في البداية بتحفظ عن حالته الصحية، ثم عبّر تدريجياً عن خوفه من أن يفقد قدرته على المشي، وعن شعوره بأنه أصبح عبئاً على زوجته. استخدمت الأسئلة المفتوحة وعكس المشاعر، ولاحظت ارتياحه حين لخصت ما قاله. واختتمت المقابلة بالاتفاق على لقاء أسبوعي، وعلى دعوة الزوجة إلى اللقاء الثاني بعد موافقته.",
    skillsUsed: "الإنصات، والأسئلة المفتوحة، وعكس المشاعر، والتلخيص", positives: "تجاوب العميل التدريجي وتعبيره عن مشاعره",
    difficulties: [{ difficulty: "تحفظ العميل في بداية اللقاء", coping: "التقبل وعدم الاستعجال في طرح الأسئلة الشخصية" }], nextPlan: "استكشاف علاقة العميل بأبنائه، ومناقشة الحمية الغذائية بحضور أخصائي التغذية",
  } });
  await tr(S, id, { action: "SUBMIT" });
  await tr(F, id, { action: "FIELD_SIGN", signatures: [sig("FIELD_SUPERVISOR")] });
}
log("دراسة حالة معتمدة بدرجة 90، ومقابلة مرتبطة بها بانتظار الاعتماد الأكاديمي");

// ------------------------------------------------------------------ 6) موقف سريع + برنامج جماعي + قراءة
await flow("QUICK_SITUATION", { situationDate: daysAgo(3), medicalFileNumber: "MRN-778812", medicalVisitType: "INPATIENT", hospitalDepartment: "الباطنية", referralSource: "الطبيب المعالج", summary: "طلب مريض مسن الخروج قبل استكمال العلاج بسبب قلقه على زوجته المريضة في المنزل.", actionsTaken: "تم التواصل مع الابن لترتيب رعاية مؤقتة للزوجة، وطمأنة المريض، فوافق على استكمال العلاج." }, { until: "SUBMITTED" });
const narrative = "بدأ البرنامج في قاعة التثقيف الصحي بحضور اثني عشر مريضاً من مرضى السكري ومرافقيهم، فرحبت الأخصائية بالحضور وعرّفت بأهداف اللقاء، ثم قدّمتُ فقرة تعريفية بالمرض ومضاعفاته بلغة مبسطة. تفاعل الحضور بطرح أسئلة عن الحمية، وروى أحد المرضى تجربته مع بتر إصبع القدم بسبب الإهمال، فكان لحديثه أثر واضح في المجموعة. بعد ذلك نفذنا نشاطاً جماعياً لتصنيف الأطعمة، وتنافست المجموعتان بروح إيجابية، ولاحظت أن بعض الأعضاء المنسحبين في البداية بدأوا بالمشاركة. واختُتم اللقاء بتوزيع مطويات والاتفاق على لقاء متابعة بعد أسبوعين.";
await flow("GROUP_PROGRAM", {
  programDate: daysAgo(6), startTime: "10:00", durationMinutes: 75, membersCount: 12, supervisorsCount: 2, advisorName: "أ. فهد المطيري", leaderName: "العميل (م)", programType: "توعوي تثقيفي", programTitle: "معاً نتعايش مع السكري",
  goals: "رفع وعي المرضى وأسرهم بمضاعفات السكري، وتعزيز الدعم المتبادل بين الأعضاء، وتشجيع الالتزام بالحمية",
  preparationPart: "أعددنا للبرنامج بتحديد الأهداف بالتنسيق مع أخصائي التغذية، وحجز قاعة التثقيف الصحي، وإعداد جدول يتضمن فقرة تعريفية ونشاطاً جماعياً وحواراً مفتوحاً. ووجهنا الدعوات للمرضى عبر الممرضات، وجهزنا المطويات والبطاقات المصورة، وشجعنا الأعضاء على الحضور مع أحد أفراد أسرهم، وأعددنا استمارة قصيرة لتقييم رضا الأعضاء عن البرنامج في نهايته.",
  narrativePart: narrative,
  analyticalPart: "يمكن تفسير تفاعل الأعضاء بعد حديث المريض عن تجربته في ضوء مفهوم التعلم بالنمذجة، إذ كان للخبرة الواقعية أثر أقوى من المعلومات النظرية. كما أن انسحاب بعض الأعضاء في البداية يعود إلى الشعور بالحرج من الحديث عن المرض أمام الآخرين، وقد ساعد النشاط التنافسي على كسر هذا الحاجز. وأقترح في اللقاءات القادمة تقسيم الأعضاء إلى مجموعات صغيرة، وإشراك الأسر في فقرة مستقلة لتعزيز دورها في المتابعة المنزلية.",
  positives: ["تفاعل الأعضاء", "مشاركة الأسر", "وضوح المحتوى"], negatives: ["ضيق القاعة", "تأخر بعض الأعضاء"],
}, { score: 92 });
await flow("READING", {
  sourceType: "JOURNAL_ARTICLE", readingDate: daysAgo(10), authors: ["Craig, S. L.", "Muskat, B."], publicationYear: 2013, title: "Bouncers, brokers, and glue: The self-described roles of social workers in urban hospitals", containerTitle: "Health & Social Work", volume: "38", issue: "1", pages: "7-16", doi: "10.1093/hsw/hls064",
  purpose: "التعرف على الأدوار التي يصف بها الأخصائيون الاجتماعيون عملهم في المستشفيات، ومقارنتها بما أشاهده في مؤسسة التدريب.",
  professionalBenefit: "استفدت من الدراسة في فهم دور الأخصائي بوصفه وسيطاً بين المريض والفريق الطبي والموارد المجتمعية، وهو ما يتطابق مع ما لاحظته في التنسيق مع الجمعيات الخيرية. كما نبهتني إلى أهمية توثيق هذه الأدوار لإبراز قيمة الخدمة الاجتماعية داخل المستشفى، وإلى ضرورة التخطيط المبكر للخروج.",
}, { field: false });
log("موقف سريع طبي (بانتظار المشرف المؤسسي)، وبرنامج جماعي معتمد بدرجة 92، وقراءة موثقة وفق APA");

// ------------------------------------------------------------------ 7) الاجتماع الإشرافي الجماعي
{
  const { id } = await call(A, "POST", "/api/meetings", { organizationId: orgId });
  const { meeting } = await call(A, "GET", `/api/meetings/${id}`);
  const me = meeting.attendance.find((a) => a.universityId === "441100001");
  const absent = meeting.attendance.find((a) => a.universityId !== "441100001");
  await call(A, "PATCH", `/api/meetings/${id}`, {
    meetingDate: daysAgo(5), startTime: "11:00", durationMinutes: 60, location: "قاعة الاجتماعات بقسم الخدمة الاجتماعية",
    agendaItems: ["مراجعة خطط التدريب الأسبوعية", "مناقشة دراسات الحالة الجارية", "الاستعداد للبرنامج الجماعي"],
    secretaryPlacementId: me.placementId,
    attendance: meeting.attendance.map((a) => ({ placementId: a.placementId, status: a.placementId === absent?.placementId ? "ABSENT_EXCUSED" : "PRESENT", excuse: a.placementId === absent?.placementId ? "مراجعة طبية" : null })),
  });
  await call(S, "PATCH", `/api/meetings/${id}`, {
    minutes: "افتتح المشرف الأكاديمي الاجتماع بالترحيب بالمتدربين، ثم استعرض كل متدرب خطته الأسبوعية وما أنجزه منها، ونوقشت أسباب التأخر في بعض المهام وسبل تداركها. وفي البند الثاني عرض المتدربون دراسات الحالة الجارية، وأكد المشرف أهمية الربط بين التقدير والخطة العلاجية وتوثيق المقابلات أولاً بأول، مع الالتزام بالأسماء الرمزية حفاظاً على السرية. وفي البند الثالث وُزعت مهام الإعداد للبرنامج الجماعي بين المتدربين بالتنسيق مع المشرف المؤسسي.",
    decisions: ["رفع خطة التدخل لكل حالة قبل الاجتماع القادم", "تسليم مسودة البرنامج الجماعي خلال أسبوع", "الالتزام بتسجيل المهارات الأسبوعية يوم الخميس"],
  });
  await call(S, "POST", `/api/meetings/${id}/transition`, { action: "SUBMIT", imageData: SIG });
  await call(A, "POST", `/api/meetings/${id}/transition`, { action: "APPROVE", imageData: SIG });
  log("اجتماع إشرافي جماعي رقم (1): محضر بتوقيع الأمين واعتماد رئيس الاجتماع");
}

// ------------------------------------------------------------------ 8) كشوف الحضور الموقّعة
{
  const { days } = await call(F, "GET", `/api/attendance-sheets?organizationId=${orgId}`);
  const today = daysAgo(0);
  let n = 0;
  for (const d of days.filter((x) => !x.signed && x.date < today).slice(0, 4)) {
    await call(F, "POST", `/api/attendance-sheets/${orgId}/${d.date}`, { imageData: SIG });
    n++;
  }
  log(`${n} كشوف حضور يومية موقّعة من المشرف المؤسسي`);
}

// ------------------------------------------------------------------ 9) طالب المحاكاة
await flow("READING", {
  sourceType: "BOOK_CHAPTER", readingDate: daysAgo(4), authors: ["السدحان، ع."], publicationYear: 2019, title: "الممارسة المهنية للخدمة الاجتماعية في المجال المدرسي", containerTitle: "مقدمة في الخدمة الاجتماعية", editors: "ع. السدحان", pages: "145-172", publisher: "مكتبة الرشد",
  purpose: "التعرف على أدوار الأخصائي الاجتماعي المدرسي ومهاراته الأساسية استعداداً لأداء مواقف المحاكاة المدرسية في مختبر القسم.",
  professionalBenefit: "ساعدني الفصل على فهم أدوار الأخصائي المدرسي في الوقاية والعلاج والتنمية، وعلى التمييز بين المشكلات السلوكية والتعليمية، كما قدّم نماذج عملية لإدارة المقابلة مع ولي الأمر استفدت منها في أداء مواقف المحاكاة، ونبهني إلى أهمية التعاون مع المعلمين والإدارة المدرسية في خطة التدخل.",
}, { email: SIM, field: false });
await flow("QUICK_SITUATION", { situationDate: daysAgo(2), schoolGrade: "الثاني المتوسط", referralSource: "رائد الفصل", summary: "موقف محاكاة: طالب يرفض دخول الحصة بعد مشادة مع زميله في الفسحة.", actionsTaken: "مقابلة الطالب على انفراد وتهدئته، ثم جلسة صلح مع زميله بحضور رائد الفصل، والاتفاق على متابعة أسبوعية." }, { email: SIM, field: false, domain: "SCHOOL" });
log("طالب المحاكاة: قراءة وموقف مدرسي معتمدان أكاديمياً مباشرة");

console.log("\n✅ اكتملت بيانات العرض — ادخل بحساب 441100001@qu.edu.sa (كلمة المرور Qu@12345) وافتح «السجل المهني»");
