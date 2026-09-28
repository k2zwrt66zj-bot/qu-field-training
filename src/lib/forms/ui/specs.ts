// =====================================================================
//  الوصف التصريحي لواجهات النماذج الرسمية — العناوين والنصوص الإرشادية منقولة من الدليل الرسمي
//  «نماذج التدريب الميداني لمرحلة البكالوريوس ١٤٤٧هـ». المفاتيح تطابق مخططات Zod (يتحقق منها اختبار التغطية).
// =====================================================================
import type { FormKind, SituationDomain } from "@prisma/client";
import { NARRATIVE_RULES } from "../schemas/helpers.ts";
import type { FieldSpec, FormSpec, Option } from "./types.ts";

const opts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));
const prose = (key: string, label: string, extra: Partial<FieldSpec> = {}, rule?: keyof typeof NARRATIVE_RULES): FieldSpec => ({
  key, label, wide: true, widget: { type: "prose", ...(rule ? { rule: NARRATIVE_RULES[rule] } : {}) }, ...extra,
});
const text = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, widget: { type: "text" }, ...extra });

// ------------------------------------------------------------------ 1) المباشرة
const COMMENCEMENT: FormSpec = {
  sections: [
    {
      id: "commencement",
      title: "مباشرة الطالب/ـة لمؤسسة التدريب الميداني",
      description: "تُعرض بيانات الطالب والمشرفين والمؤسسة أعلاه من الإسناد، ويسجل جوال المشرف وبريد المؤسسة واسم المدير لحظة التوقيع.",
      fields: [
        { key: "commencementDate", label: "تاريخ المباشرة", widget: { type: "date" } },
        { key: "fixedTrainingDay", label: "يوم التدريب الثابت", widget: { type: "weekday" }, wide: true },
        { key: "shift", label: "فترة التدريب", widget: { type: "choice", layout: "inline", options: opts([["MORNING", "فترة صباحية"], ["EVENING", "فترة مسائية"]]) } },
        { key: "supervisorMobile", label: "جوال المشرف المؤسسي", widget: { type: "readonly" } },
        { key: "organizationEmail", label: "البريد الإلكتروني للمؤسسة", widget: { type: "readonly" } },
        { key: "directorName", label: "اسم مدير المؤسسة", widget: { type: "readonly" } },
        {
          key: "declarationAccepted", label: "الإقرار", wide: true,
          widget: { type: "consent", text: "أقر أنا الطالب/ـة المذكور أعلاه بأنني باشرت التدريب الميداني في المؤسسة ابتداءً من التاريخ المذكور أعلاه، وذلك وفق الخطاب الموجه من قسم الاجتماع والخدمة الاجتماعية للمؤسسة." },
        },
      ],
    },
  ],
};

// ------------------------------------------------------------------ 2) التقرير التعريفي
const ORGANIZATION_PROFILE: FormSpec = {
  sections: [
    {
      id: "basic", title: "أولاً: البيانات الأولية عن المؤسسة",
      fields: [
        text("organizationName", "اسم المؤسسة"), text("location", "مكان المؤسسة"), text("contactNumbers", "أرقام التواصل"),
        text("workField", "مجال عمل المؤسسة"), text("officialHours", "أوقات الدوام الرسمي"), text("trainingDays", "أيام التدريب الميداني بالمؤسسة"),
      ],
    },
    { id: "supervision", title: "ثانياً: بيانات عن الإشراف بالمؤسسة", fields: [text("directorName", "اسم مدير/ة المؤسسة"), text("supervisorName", "اسم مشرف/ة المؤسسة"), { ...text("supervisorMobile", "جوال مشرف/ة المؤسسة"), widget: { type: "text", dir: "ltr" } }] },
    { id: "goals", title: "ثالثاً: أهداف المؤسسة", fields: [prose("goals", "أهداف المؤسسة")] },
    {
      id: "structure", title: "رابعاً: الهيكل التنظيمي للمؤسسة",
      fields: [
        { key: "socialWorkersCount", label: "عدد الأخصائيين الاجتماعيين", widget: { type: "number", min: 0 } },
        { key: "beneficiariesCount", label: "عدد المستفيدين من خدمات المؤسسة", widget: { type: "number", min: 0 } },
        {
          key: "professionals", label: "عدد المهنيين من التخصصات الأخرى وتصنيفهم", wide: true,
          widget: { type: "rows", max: 30, addLabel: "إضافة تخصص", columns: [{ key: "specialty", label: "التخصص", type: "text" }, { key: "count", label: "العدد", type: "number", width: "110px" }] },
        },
        prose("policies", "السياسات واللوائح المنظمة للعمل بالمؤسسة"),
      ],
    },
    {
      id: "services", title: "خامساً: بيانات عن الخدمات التي تقدمها المؤسسة",
      fields: [prose("servicesOffered", "الخدمات المقدمة في المؤسسة"), prose("eligibilityConditions", "شروط الحصول على الخدمات"), prose("accessProcedures", "إجراءات الحصول على الخدمات"), prose("beneficiaryGroups", "الفئات المستفيدة من الخدمات")],
    },
    { id: "relations", title: "سادساً: بيانات عن علاقات المؤسسة بالمجتمع الخارجي", fields: [prose("relatedOrganizations", "المؤسسات ذات العلاقة بالمؤسسة"), prose("communityPrograms", "البرامج التي تقدمها المؤسسة للمجتمع المحلي")] },
    { id: "roles", title: "سابعاً: أدوار الأخصائي الاجتماعي بالمؤسسة", fields: [{ key: "socialWorkerRoles", label: "الأدوار", wide: true, widget: { type: "list", max: 20, addLabel: "إضافة دور" } }] },
    { id: "notes", title: "ثامناً: ملاحظات الطالب/ـة عن المؤسسة", fields: [prose("studentNotes", "الملاحظات")] },
  ],
};

// ------------------------------------------------------------------ 3) خطة التدريب
const TRAINING_PLAN: FormSpec = {
  sections: [
    {
      id: "plan", title: "نموذج خطة التدريب الميداني",
      fields: [
        prose("generalGoal", "الهدف العام"),
        {
          key: "weeks", label: "خطة الأسابيع", wide: true,
          widget: {
            type: "rows", max: 30, fixedRows: true,
            columns: [{ key: "weekNumber", label: "الأسبوع", type: "number", width: "80px", readOnly: true }, { key: "tasks", label: "المهام", type: "prose" }, { key: "responsible", label: "المسؤول عن أداء المهمة", type: "text", width: "200px" }],
          },
        },
      ],
    },
  ],
};

// ------------------------------------------------------------------ 4) المهارات والمعارف
const SKILLS_LOG: FormSpec = {
  evidenceTitle: "الصور والشواهد والأدلة",
  sections: [
    {
      id: "day", title: "عناصر خطة الأسبوع",
      fields: [
        { key: "weekNumber", label: "الأسبوع", widget: { type: "number", min: 1, max: 30 } },
        { key: "logDate", label: "اليوم والتاريخ", widget: { type: "date" } },
        { key: "topics", label: "الموضوعات", wide: true, hint: "تُعبأ آلياً من أسبوع الخطة المعتمدة ويمكن تعديلها (حتى 6)", widget: { type: "list", max: 6, addLabel: "إضافة موضوع" } },
      ],
    },
    {
      id: "skills", title: "تسجيل المهارات المكتسبة بطريقة مهنية",
      description: "(تكتب المهارات بطريقة سردية علمية وليس نقاط).",
      fields: [prose("skillsNarrative", "المهارات المكتسبة", {}, "skills")],
    },
    {
      id: "knowledge", title: "تسجيل المعارف المكتسبة بطريقة مهنية",
      description: "(تكتب المعارف بطريقة سردية علمية وليس نقاط).",
      fields: [prose("knowledgeNarrative", "المعارف المكتسبة", {}, "knowledge")],
    },
    { id: "difficulties", title: "الصعوبات التي واجهتك في يومك التدريبي وكيفية التغلب عليها", fields: [prose("difficulties", "الصعوبات وكيفية التغلب عليها")] },
  ],
};

// ------------------------------------------------------------------ 5-6) البرامج
const statistical: FieldSpec[] = [
  { key: "programDate", label: "تاريخ إقامة البرنامج", hint: "يُحسب يوم الأسبوع آلياً", widget: { type: "date" } },
  { key: "startTime", label: "وقت البرنامج", widget: { type: "time" } },
  { key: "durationMinutes", label: "مدة البرنامج", widget: { type: "number", min: 1, suffix: "دقيقة" } },
  { key: "membersCount", label: "عدد أعضاء البرنامج", widget: { type: "number", min: 0 } },
  { key: "supervisorsCount", label: "عدد المشرفين على البرنامج", widget: { type: "number", min: 0 } },
  text("advisorName", "رائد البرنامج"),
  text("leaderName", "قائد البرنامج"),
  text("programType", "نوع البرنامج"),
  text("programTitle", "عنوان البرنامج"),
];
const evaluation = (n: string): FormSpec["sections"][number] => ({
  id: "evaluation", title: `${n}: تقييم البرنامج`,
  fields: [
    { key: "positives", label: "الإيجابيات", widget: { type: "list", max: 10, addLabel: "إضافة إيجابية" } },
    { key: "negatives", label: "السلبيات", widget: { type: "list", max: 10, addLabel: "إضافة سلبية" } },
  ],
});

const GROUP_PROGRAM: FormSpec = {
  sections: [
    { id: "stats", title: "أولاً: الجزء الإحصائي", fields: statistical },
    { id: "goals", title: "ثانياً: أهداف البرنامج", fields: [prose("goals", "أهداف البرنامج")] },
    {
      id: "preparation", title: "ثالثاً: الجزء الإعدادي",
      description: "يتضمن كل ما قام به الأخصائي الاجتماعي وطلاب التدريب من إعداد للبرنامج الجماعي، ويشمل تحديد أهداف البرنامج الجماعي ومكانه وجدول أعماله الذي يتضمن فقرات النشاط والإعلان عنه للأعضاء، وتجهيز الخامات والأدوات التي يحتاجها هذا النشاط. كما يشمل هذا الجزء أيضاً الإعداد المعنوي للأعضاء وسبل تشجيعهم وحثهم على المشاركة.",
      fields: [prose("preparationPart", "الجزء الإعدادي", {}, "preparationPart")],
    },
    {
      id: "narrative", title: "رابعاً: الجزء القصصي",
      description: "جزء وصفي لما تم خلال أوجه النشاط الجماعي من أحداث ومواقف حسب التسلسل الزمني للنشاط وبأسلوب قصصي، ويتضمن العلاقات والتفاعلات وكل ما يحدث أثناء تطبيق النشاط، ودور الأخصائي الاجتماعي وطلاب التدريب الميداني ومدى تدخلهم في تلك المواقف. ينبغي أن يكون تصويراً حقيقياً لما حدث — مقبولاً كان أو غير مقبول — بتدوين الحقائق حسب ترتيب حدوثها وبنفس الطريقة التي حدثت بها.",
      fields: [prose("narrativePart", "الجزء القصصي", {}, "storyPart")],
    },
    {
      id: "analysis", title: "خامساً: الجزء التحليلي",
      description: "تحليل طالب التدريب الميداني لبعض المواقف التي حدثت أثناء النشاط الجماعي: تحديد العوامل والأسباب التي أدت إليها من وجهة نظره وفي ضوء ما لدى الأخصائي الاجتماعي من معلومات وحقائق، مع وضع مقترحات لتحسين المواقف السلوكية وتلبية احتياجات الأعضاء مستقبلاً.",
      fields: [prose("analyticalPart", "الجزء التحليلي", {}, "analyticalPart")],
    },
    evaluation("سادساً"),
  ],
};

const COMMUNITY_PROGRAM: FormSpec = {
  sections: [
    { id: "stats", title: "أولاً: الجزء الإحصائي", fields: statistical },
    { id: "goals", title: "ثانياً: أهداف البرنامج", fields: [prose("goals", "أهداف البرنامج")] },
    {
      id: "planning", title: "ثالثاً: الجزء التخطيطي",
      description: "طريقة تخطيط الأخصائي الاجتماعي وطلاب التدريب الميداني للبرنامج المجتمعي: اختيار مكان إقامة البرنامج وسببه، وسبب اختيار هذه الفئة من المستفيدين، وسبب اختيار أهداف البرنامج لتخدم هذه الفئة، وطريقة الإعلان عنه وأخذ الموافقات من المختصين، ومدة البرنامج وعلاقتها بالأهداف.",
      fields: [prose("planningPart", "الجزء التخطيطي", {}, "planningPart")],
    },
    {
      id: "execution", title: "رابعاً: الجزء التنفيذي",
      description: "طريقة التنفيذ بالتفصيل، ووصف الأحداث وتحليلها، ونوع العمل المطلوب من الأخصائي الاجتماعي وطلاب التدريب الميداني.",
      fields: [prose("executionPart", "الجزء التنفيذي", {}, "executionPart")],
    },
    evaluation("خامساً"),
  ],
};

// ------------------------------------------------------------------ 7-8) المواقف السريعة
const situationCommon: FieldSpec[] = [
  { key: "referralSource", label: "مصدر التحويل", widget: { type: "text" }, wide: true },
  prose("summary", "ملخص الموقف"),
  prose("actionsTaken", "الإجراءات المتخذة"),
];
const SCHOOL_SITUATION: FormSpec = {
  sections: [
    {
      id: "school", title: "تسجيل الموقف السريع بالمدرسة",
      fields: [
        text("subjectName", "اسم الطالب (اختياري)", { hint: "يُفضَّل الاسم الرمزي" }), text("schoolGrade", "الصف الدراسي"),
        { key: "situationDate", label: "اليوم والتاريخ", widget: { type: "date" } }, ...situationCommon,
      ],
    },
  ],
};
const MEDICAL_SITUATION: FormSpec = {
  sections: [
    {
      id: "medical", title: "تسجيل الموقف السريع بالمستشفى",
      fields: [
        text("subjectName", "اسم الحالة (اختياري)", { hint: "يُفضَّل الاسم الرمزي" }),
        { key: "medicalFileNumber", label: "رقم الملف", hint: "يظهر كاملاً لك وللمشرفَين المسؤولين فقط", widget: { type: "text", dir: "ltr" } },
        {
          key: "medicalVisitType", label: "نوع المراجع", wide: true,
          widget: { type: "choice", layout: "inline", options: opts([["FIRST_VISIT", "مراجع لأول مرة"], ["INPATIENT", "منوّم بالمستشفى"], ["SURGERY", "عمليات"], ["FOLLOW_UP", "مراجع كمتابعة"], ["FAMILY_MEMBER", "أحد أفراد أسرة المريض"]]) },
        },
        { key: "situationDate", label: "اليوم والتاريخ", widget: { type: "date" } },
        text("hospitalDepartment", "القسم التابع له الحالة"),
        ...situationCommon,
      ],
    },
  ],
};

// ------------------------------------------------------------------ 9) دراسة الحالة
const isPlanned = (d: Record<string, unknown>) => d.terminationType === "PLANNED";
const isUnplanned = (d: Record<string, unknown>) => d.terminationType === "UNPLANNED";
const aspect = (key: string, label: string, hint: string) => prose(key, label, { hint }, "caseAspect");

const CASE_STUDY: FormSpec = {
  sections: [
    {
      id: "privacy", title: "بيانات الحالة",
      description: "التزاماً بأخلاقيات المهنة وسرية المعلومات: لا تكتب الاسم الحقيقي للعميل أو أي بيانات تدل عليه.",
      fields: [
        text("caseAlias", "الاسم الرمزي للحالة", { hint: "مثال: الحالة (س)" }),
        { key: "consentConfirmed", label: "الإقرار", wide: true, widget: { type: "consent", text: "أقر بالحصول على موافقة العميل على دراسة حالته، وبإخفاء جميع البيانات الدالة على هويته." } },
      ],
    },
    {
      id: "assessment-personal", title: "أولاً: التقدير — الجوانب الشخصية",
      description: "البيانات الواجب جمعها عن النسق (العميل) في جوانب الشخصية الأربعة.",
      fields: [
        aspect("physicalAspect", "الجانب الجسمي", "الخصائص الشخصية للعميل، المظهر الخارجي، الحالة الصحية"),
        aspect("psychologicalAspect", "الجانب النفسي", "المشاعر المرتبطة بعناصر عملية المساعدة وبخاصة الأخصائي الاجتماعي كشخص مهني، والمشاعر المرتبطة بالمشكلة أو الموقف"),
        aspect("mentalAspect", "الجانب العقلي", "القدرات الإدراكية، الذكاء الاجتماعي، سلامة التفكير، التذكر والنسيان"),
        aspect("behavioralAspect", "الجانب السلوكي", "سلوكيات العميل، ومدى تأثرها بالتفاعلات مع الأشخاص المحيطين"),
      ],
    },
    {
      id: "assessment-environment", title: "أولاً: التقدير — الجوانب البيئية",
      fields: [
        {
          key: "familyMembers", label: "بناء الأسرة: جدول التكوين الأسري", wide: true, hint: "يتم تعبئة الجدول وفقاً لترتيب أفراد الأسرة من الأكبر إلى الأصغر",
          widget: {
            type: "rows", max: 25, addLabel: "إضافة فرد",
            columns: [
              { key: "name", label: "الاسم", type: "text" }, { key: "age", label: "السن", type: "number", width: "70px" }, { key: "relation", label: "الصلة بالعميل", type: "text" },
              { key: "education", label: "المستوى التعليمي", type: "text" }, { key: "occupation", label: "المهنة", type: "text" }, { key: "healthStatus", label: "الحالة الصحية", type: "text" },
              { key: "maritalStatus", label: "الحالة الاجتماعية", type: "text" }, { key: "notes", label: "ملاحظات", type: "text" },
            ],
          },
        },
        prose("familyDynamics", "ديناميكية الأسرة", { hint: "وصف علاقة العميل بأفراد أسرته" }),
        prose("otherSystemsRelations", "علاقة العميل بالأنساق الأخرى", { hint: "الزملاء، الأصدقاء، والبيئة المادية المحيطة من خدمات صحية وترويحية وتعليمية، وجود مسكن صحي، مؤسسات اجتماعية" }),
        prose("mainProblem", "المشكلة الرئيسية"),
        { key: "subProblems", label: "المشكلات الفرعية", wide: true, widget: { type: "list", max: 15, addLabel: "إضافة مشكلة فرعية" } },
        prose("strengths", "جوانب القوى لدى العميل أو الأنساق المحيطة به", { hint: "في جوانب شخصية العميل، أنساق الأسرة والأصدقاء، مهارات حل المشكلة واتخاذ القرارات، الآراء والاتجاهات الإيجابية، الموارد المادية والمالية" }),
      ],
    },
    {
      id: "planning", title: "ثانياً: التخطيط",
      fields: [
        prose("participatingSystems", "تحديد الأنساق المشاركة للعميل"),
        prose("mainGoal", "الهدف الرئيسي للتدخل المهني"),
        { key: "subGoals", label: "الأهداف الفرعية", wide: true, widget: { type: "list", max: 15, addLabel: "إضافة هدف فرعي" } },
        prose("professionalContract", "التعاقد المهني", { hint: "الاتفاق على الأهداف العامة والفرعية، وتحديد مسئوليات كل نسق، والوقت اللازم، ومواعيد المقابلات" }),
      ],
    },
    {
      id: "intervention", title: "ثالثاً: التدخل المهني",
      description: "تحديد النموذج أو النماذج والأساليب العلاجية المستخدمة.",
      fields: [
        { key: "therapeuticModels", label: "النموذج العلاجي المستخدم", widget: { type: "list", max: 10, addLabel: "إضافة نموذج" } },
        { key: "techniques", label: "الأساليب العلاجية المستخدمة", widget: { type: "list", max: 20, addLabel: "إضافة أسلوب" } },
      ],
    },
    {
      id: "evaluation-initial", title: "رابعاً: التقييم — التقييم المبدئي",
      description: "تقييم خطة التدخل المهني قبل تطبيقها. ضع/ي علامة (√) عند كل جانب بما هو مناسب.",
      fields: [
        { key: "initProblemsWellFormulated", label: "صياغة المشكلات الرئيسية والفرعية", widget: { type: "yesNo", yes: "تم صياغتها بدقة", no: "لم تتم صياغتها بدقة" } },
        { key: "initGoalsMeasurable", label: "صياغة الأهداف بشكل قابل للقياس", widget: { type: "yesNo", yes: "قابلة للقياس", no: "غير قابلة للقياس" } },
        { key: "initGoalsAchievable", label: "صياغة أهداف واقعية وقابلة للتحقيق", widget: { type: "yesNo", yes: "قابلة للتحقيق", no: "غير قابلة للتحقيق" } },
        { key: "initTechniquesAppropriate", label: "تحديد الأساليب العلاجية", widget: { type: "yesNo", yes: "مناسبة", no: "غير مناسبة" } },
        { key: "initResponsibilitiesClear", label: "تحديد مسئوليات كل نسق", widget: { type: "yesNo", yes: "واضحة للأنساق", no: "غير واضحة للأنساق" } },
      ],
    },
    {
      id: "evaluation-phase", title: "رابعاً: التقييم — التقييم المرحلي",
      description: "بعد انتهاء كل خطوة من خطوات التدخل المهني.",
      fields: [
        prose("assessmentPositives", "أثناء خطوة التقدير — الإيجابيات", { wide: false }), prose("assessmentNegatives", "أثناء خطوة التقدير — السلبيات", { wide: false }),
        prose("planningPositives", "أثناء خطوة التخطيط — الإيجابيات", { wide: false }), prose("planningNegatives", "أثناء خطوة التخطيط — السلبيات", { wide: false }),
        prose("interventionPositives", "أثناء خطوة التدخل المهني — الإيجابيات", { wide: false }), prose("interventionNegatives", "أثناء خطوة التدخل المهني — السلبيات", { wide: false }),
      ],
    },
    {
      id: "evaluation-final", title: "رابعاً: التقييم — التقييم النهائي",
      description: "بعد انتهاء التدخل المهني.",
      fields: [
        {
          key: "finalOutcome", label: "نتيجة التدخل المهني", wide: true,
          widget: { type: "choice", layout: "cards", options: opts([["POSITIVE_CHANGE", "النجاح في إحداث التغيير وحل المشكلة بشكل إيجابي"], ["NO_CHANGE", "عدم إحداث تغيير سواء بشكل إيجابي أو سلبي وعدم استفادة العميل"], ["DETERIORATED", "تدهور الموقف الإشكالي بعد حدوث التدخل المهني"]]) },
        },
      ],
    },
    {
      id: "termination", title: "خامساً: الإنهاء",
      description: "تحديد هل كان الإنهاء مخططاً أم غير مخطط.",
      fields: [
        { key: "terminationType", label: "نوع الإنهاء", wide: true, widget: { type: "choice", layout: "inline", options: opts([["PLANNED", "إنهاء مخطط"], ["UNPLANNED", "إنهاء غير مخطط"]]) } },
        { key: "plannedGoalsAchieved", label: "هل تم تحقيق أهداف التدخل المهني؟", when: isPlanned, widget: { type: "yesNo", yes: "نعم", no: "لا" } },
        { key: "plannedTimeAppropriate", label: "هل الوقت المتفق عليه كان مناسباً؟", when: isPlanned, widget: { type: "yesNo", yes: "نعم", no: "لا" } },
        { key: "plannedProblemHandled", label: "هل تم التعامل مع المشكلة أو الموقف بمستوى مناسب؟", when: isPlanned, widget: { type: "yesNo", yes: "نعم", no: "لا" } },
        { key: "plannedResourcesUsed", label: "هل استثمر الأخصائي الاجتماعي والمؤسسة الموارد المتاحة بشكل مناسب؟", when: isPlanned, widget: { type: "yesNo", yes: "نعم", no: "لا" } },
        { key: "plannedNeedsReferral", label: "هل يرى الأخصائي الاجتماعي أن العميل يحتاج إلى التحويل لمؤسسة أخرى؟", when: isPlanned, widget: { type: "yesNo", yes: "نعم", no: "لا" } },
        prose("unplannedWorkerFactors", "عوامل ترجع إلى الأخصائي الاجتماعي", { when: isUnplanned }),
        prose("unplannedClientFactors", "عوامل ترجع إلى العميل", { when: isUnplanned }),
        prose("unplannedSharedFactors", "عوامل ترجع إلى الأخصائي الاجتماعي والعميل معاً", { when: isUnplanned }),
      ],
    },
    {
      id: "follow-up", title: "سادساً: المتابعة",
      description: "حدد/ي كيف كانت نتيجة عملية المتابعة.",
      fields: [
        { key: "followUpInterval", label: "أسس المتابعة من حيث الفترة الزمنية", wide: true, widget: { type: "choice", layout: "inline", options: opts([["CLOSE", "المتابعة على فترات زمنية متقاربة"], ["SPACED", "المتابعة على فترات زمنية متباعدة"]]) } },
        {
          key: "followUpPurposes", label: "من حيث الهدف من المتابعة", wide: true,
          widget: { type: "multiChoice", options: opts([["SERVICE_EVALUATION", "تقييم مستوى الخدمات التي تقدمها المؤسسة (للاستفادة في تعديل النماذج والأساليب العلاجية المستخدمة)"], ["COMMUNITY_ACCOUNTABILITY", "إثبات للمجتمع عن مدى نجاح المؤسسة في تحقيق أهدافها (للحصول على تمويل أو التوسع في تقديم خدمات أخرى)"], ["CLIENT_ATTACHMENT", "أسلوب لربط العميل بالمؤسسة وإشعاره بأنه جزء مهم منها"]]) },
        },
        {
          key: "followUpMethods", label: "من حيث منهج المتابعة (الأسلوب الذي تتبعه المؤسسة)", wide: true,
          widget: { type: "multiChoice", options: opts([["PHONE_CALLS", "المكالمات الهاتفية القصيرة"], ["HOME_VISITS", "الزيارات المنزلية للعملاء"], ["MAILED_SURVEYS", "إرسال الاستبيانات المكتوبة للعملاء"]]) },
        },
        { key: "resultPerformsSocialRole", label: "نتيجة المتابعة", widget: { type: "check", text: "اتضح أن العميل يقوم بأداء وظائفه الاجتماعية" } },
        { key: "resultUsesLearnedSkills", label: "نتيجة المتابعة", widget: { type: "check", text: "اتضح أن العميل يقوم باستخدام المهارات التي تعلمها خلال فترة التدخل المهني" } },
        { key: "resultNeedsOtherServices", label: "نتيجة المتابعة", widget: { type: "check", text: "اتضح حاجة العميل للحصول على خدمات أخرى" } },
      ],
    },
  ],
};

// ------------------------------------------------------------------ 10) المقابلة المهنية
const INTERVIEW: FormSpec = {
  sections: [
    {
      id: "basic", title: "أولاً: البيانات الأولية للمقابلة",
      fields: [
        { key: "interviewDate", label: "يوم وتاريخ المقابلة", widget: { type: "date" } },
        { key: "durationMinutes", label: "مدة المقابلة", widget: { type: "number", min: 1, suffix: "دقيقة" } },
        text("location", "مكان المقابلة"),
        text("parties", "طرف أو أطراف المقابلة"),
        { key: "caseStudyFormId", label: "ضمن دراسة الحالة", hint: "اختياري: اربط المقابلة بإحدى دراسات الحالة", widget: { type: "caseStudyRef" }, wide: true },
      ],
    },
    { id: "goals", title: "ثانياً: أهداف المقابلة", fields: [prose("goals", "أهداف المقابلة")] },
    { id: "content", title: "ثالثاً: محتوى المقابلة", fields: [prose("content", "محتوى المقابلة", {}, "interviewContent")] },
    { id: "skills", title: "رابعاً: المهارات التي تم استخدامها أثناء المقابلة", fields: [prose("skillsUsed", "المهارات المستخدمة")] },
    { id: "next", title: "خامساً: التخطيط للمقابلة القادمة", description: "تسجيل ما تم الاتفاق عليه مع العميل/ة للمقابلة القادمة.", fields: [prose("nextPlan", "التخطيط للمقابلة القادمة")] },
    {
      id: "evaluation", title: "سادساً: تقييم المقابلة",
      description: "تسجيل الجوانب الإيجابية والصعوبات التي تم ملاحظتها أثناء المقابلة، وكيفية مواجهتها في المقابلات القادمة.",
      fields: [
        prose("positives", "الجوانب الإيجابية أثناء المقابلة"),
        {
          key: "difficulties", label: "الصعوبات وكيفية مواجهتها", wide: true,
          widget: { type: "rows", max: 15, addLabel: "إضافة صعوبة", columns: [{ key: "difficulty", label: "الصعوبات", type: "prose" }, { key: "coping", label: "كيفية مواجهة الصعوبات", type: "prose" }] },
        },
      ],
    },
  ],
};

// ------------------------------------------------------------------ 11) القراءات
const isJournal = (d: Record<string, unknown>) => d.sourceType === "JOURNAL_ARTICLE";
const isEdited = (d: Record<string, unknown>) => d.sourceType === "BOOK_CHAPTER" || d.sourceType === "CONFERENCE_PAPER";

const READING: FormSpec = {
  sections: [
    {
      id: "source", title: "بيانات القراءة",
      fields: [
        { key: "sourceType", label: "حدد ما تم قراءته", wide: true, widget: { type: "choice", layout: "inline", options: opts([["BOOK_CHAPTER", "فصل في كتاب"], ["JOURNAL_ARTICLE", "بحث في مجلة علمية"], ["CONFERENCE_PAPER", "بحث في مؤتمر علمي"]]) } },
        { key: "readingDate", label: "يوم وتاريخ القراءة", widget: { type: "date" } },
      ],
    },
    {
      id: "apa", title: "التوثيق (وفق أسلوب APA)",
      description: "أدخل عناصر المرجع ويُولَّد التوثيق آلياً. اكتب المؤلف بصيغة «العتيبي، خ.» أو «Smith, J. A.».",
      fields: [
        { key: "authors", label: "المؤلفون", wide: true, widget: { type: "list", max: 25, addLabel: "إضافة مؤلف", itemPlaceholder: "العتيبي، خ." } },
        { key: "publicationYear", label: "سنة النشر", widget: { type: "number", min: 1900, max: 2100 } },
        text("title", "عنوان البحث / الفصل", { wide: true }),
        text("containerTitle", "المجلة / الكتاب / وقائع المؤتمر", { wide: true }),
        text("editors", "المحررون", { when: isEdited, hint: "مثال: س. الحربي" }),
        text("volume", "المجلد", { when: isJournal }),
        text("issue", "العدد", { when: isJournal }),
        text("pages", "الصفحات", { hint: "مثال: 101-110" }),
        text("publisher", "الناشر", { when: isEdited }),
        { key: "doi", label: "DOI", widget: { type: "text", dir: "ltr" } },
        { key: "url", label: "الرابط", widget: { type: "text", dir: "ltr" } },
        { key: "apaCitation", label: "التوثيق النهائي", wide: true, hint: "اتركه فارغاً ليُولَّد آلياً، أو اكتب توثيقاً يدوياً", widget: { type: "prose", rows: 2 } },
      ],
    },
    { id: "purpose", title: "الهدف من القراءة", fields: [prose("purpose", "الهدف من القراءة", {}, "readingPurpose")] },
    { id: "benefit", title: "الفوائد المهنية المستخلصة بعد القراءة", fields: [prose("professionalBenefit", "الفوائد المهنية", {}, "readingBenefit")] },
  ],
};

const SPECS: Record<Exclude<FormKind, "CUSTOM" | "QUICK_SITUATION">, FormSpec> = {
  COMMENCEMENT, ORGANIZATION_PROFILE, TRAINING_PLAN, SKILLS_LOG, GROUP_PROGRAM, COMMUNITY_PROGRAM, CASE_STUDY, INTERVIEW, READING,
};

export function specFor(kind: Exclude<FormKind, "CUSTOM">, domain?: SituationDomain | null): FormSpec {
  if (kind === "QUICK_SITUATION") return domain === "SCHOOL" ? SCHOOL_SITUATION : MEDICAL_SITUATION;
  return SPECS[kind];
}

/** كل مفاتيح الحقول في الوصف (لاختبار التغطية) */
export const specKeys = (spec: FormSpec) => spec.sections.flatMap((s) => s.fields.map((f) => f.key));
