// =====================================================================
//  «السجل المهني» للطالب: النماذج بترتيب الدليل الرسمي، وحالة كل نموذج،
//  وإمكانية الإنشاء، والخطوة التالية المقترحة
// =====================================================================
import type { DocumentStatus, FormKind, SituationDomain } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/api";
import { placementScope } from "@/server/access";
import { FORM_POLICIES, TRAINING_MODE_LABELS, formDisplayTitle, kindsForMode, policyFor } from "@/lib/forms/catalog";
import { can } from "@/lib/forms/permissions";
import { CUSTOM_CREATABLE, customTitle, isLegacyTemplate } from "@/lib/forms/ui/custom";
import { REPORT_TEMPLATES } from "@/lib/report-templates";
import { riyadhDateOnly } from "@/lib/time";
import { actorFor, modeOf } from "./service";
import { defaultDomain, weekNumberFor } from "./prefill";

export interface PortfolioFormItem {
  id: string;
  kind: FormKind;
  sequence: number;
  title: string;
  status: DocumentStatus;
  locked: boolean;
  updatedAt: Date;
  submittedAt: Date | null;
  academicScore: number | null;
  /** يمرّ على المشرف المؤسسي (لتحديد نص الحالة: بانتظار توقيع مؤسسي أو اعتماد أكاديمي) */
  fieldApproval: boolean;
  /** بانتظار إجراء من المستخدم الحالي (توقيع مؤسسي أو اعتماد أكاديمي) */
  awaitingMe: boolean;
}

export interface PortfolioGroup {
  kind: FormKind;
  order: number;
  title: string;
  singleton: boolean;
  forms: PortfolioFormItem[];
  /** للطالب فقط: هل يستطيع إنشاء نموذج جديد من هذا النوع، ولماذا لا */
  create: { allowed: boolean; reason?: string; domains?: SituationDomain[] } | null;
}

export interface NextStep {
  text: string;
  href?: string;
  tone: "info" | "warning" | "danger" | "success";
}

const TERMINAL: DocumentStatus[] = ["REVIEWED"];

export async function loadPortfolio(user: SessionUser, placementId: string | null) {
  const placement = await prisma.placement.findFirst({
    where: { ...placementScope(user), ...(placementId ? { id: placementId } : {}) },
    orderBy: { startDate: "desc" },
    include: {
      student: { include: { user: { select: { id: true, fullName: true } } } },
      organization: true,
      term: true,
      section: true,
      fieldSupervisor: { include: { user: { select: { id: true, fullName: true } } } },
      academicSupervisor: { include: { user: { select: { id: true, fullName: true } } } },
      forms: {
        select: {
          id: true, kind: true, sequence: true, status: true, title: true, templateKey: true, data: true, lockedAt: true, submittedAt: true, updatedAt: true, academicScore: true,
          quickSituation: { select: { domain: true } },
          skillsLog: { select: { weekNumber: true } },
        },
        orderBy: [{ kind: "asc" }, { sequence: "asc" }],
      },
    },
  });
  if (!placement) return null;

  const mode = modeOf(placement);
  const actor = actorFor(user, { placement } as never);
  const isStudent = actor.isOwner;
  const active = ["ASSIGNED", "ACTIVE"].includes(placement.status);

  const visible = placement.forms.filter((f) =>
    can(actor, policyFor(f.kind, mode), { status: f.status, locked: !!f.lockedAt, everSubmitted: !!f.submittedAt }, "VIEW")
  );
  const toItem = (f: (typeof visible)[number]): PortfolioFormItem => {
    const policy = policyFor(f.kind, mode);
    const state = { status: f.status, locked: !!f.lockedAt, everSubmitted: !!f.submittedAt };
    return {
      id: f.id,
      kind: f.kind,
      sequence: f.sequence,
      title: f.kind === "CUSTOM" ? f.title ?? customTitle(f.templateKey) : formDisplayTitle(f.kind, f.sequence, f.quickSituation?.domain),
      status: f.status,
      locked: !!f.lockedAt,
      updatedAt: f.updatedAt,
      submittedAt: f.submittedAt,
      academicScore: f.academicScore == null ? null : Number(f.academicScore),
      fieldApproval: policy.fieldApproval,
      awaitingMe: can(actor, policy, state, "FIELD_SIGN") || can(actor, policy, state, "ACADEMIC_APPROVE"),
    };
  };

  // الميداني: لا نماذج قبل اعتماد المباشرة
  const commencement = placement.forms.find((f) => f.kind === "COMMENCEMENT");
  const commenced = mode === "SIMULATION" || placement.status !== "ASSIGNED" || (!!commencement && ["SIGNED", "REVIEWED"].includes(commencement.status));
  const orgDomain = defaultDomain(placement.organization.category);

  // المشرف المؤسسي لا يرى النماذج التي لا تمرّ عليه (القراءات)
  const fieldOnly = actor.isFieldSupervisor && !actor.isAcademicSupervisor && !["TRAINING_HEAD", "DEPARTMENT_HEAD", "ADMIN"].includes(user.role);
  const kinds = kindsForMode(mode).filter((k) => !fieldOnly || policyFor(k, mode).fieldApproval);

  const groups: PortfolioGroup[] = kinds.map((kind) => {
    const policy = FORM_POLICIES[kind];
    const forms = visible.filter((f) => f.kind === kind).map(toItem);
    let create: PortfolioGroup["create"] = null;
    if (isStudent) {
      const exists = placement.forms.some((f) => f.kind === kind);
      if (!active) create = { allowed: false, reason: "التدريب غير فعّال" };
      else if (policy.singleton && exists) create = { allowed: false };
      else if (kind !== "COMMENCEMENT" && !commenced) create = { allowed: false, reason: "بعد اعتماد نموذج المباشرة" };
      else create = { allowed: true, ...(kind === "QUICK_SITUATION" ? { domains: orgDomain ? [orgDomain] : (["SCHOOL", "MEDICAL"] as SituationDomain[]) } : {}) };
    }
    return { kind, order: policy.portfolioOrder, title: policy.title, singleton: policy.singleton, forms, create };
  });

  // النماذج الإضافية (البحث الميداني، المسح الاجتماعي، التقرير الختامي) والأرشيف المرحَّل
  const customs = visible.filter((f) => f.kind === "CUSTOM");
  const isLegacy = (f: (typeof customs)[number]) => isLegacyTemplate(f.templateKey) || !!(f.data as Record<string, unknown> | null)?._legacy;
  const additional = customs.filter((f) => !isLegacy(f)).map(toItem);
  const archive = customs.filter(isLegacy).map((f) => ({ ...toItem(f), templateTitle: customTitle(f.templateKey) }));
  const hasFinal = placement.forms.some((f) => f.kind === "CUSTOM" && f.templateKey === "FINAL_REPORT" && !isLegacy(f));
  const templates = isStudent
    ? CUSTOM_CREATABLE.filter((k) => REPORT_TEMPLATES[k].majors.includes(placement.student.major)).map((k) => ({
        key: k,
        title: REPORT_TEMPLATES[k].title,
        description: REPORT_TEMPLATES[k].description,
        disabled: !active ? "التدريب غير فعّال" : !commenced ? "بعد اعتماد نموذج المباشرة" : k === "FINAL_REPORT" && hasFinal ? "لديك تقرير ختامي مسبقاً" : undefined,
      }))
    : [];

  // ------------------------------------------------------------ الملخص
  const all = [...groups.flatMap((g) => g.forms), ...additional];
  const count = (s: DocumentStatus[]) => all.filter((f) => s.includes(f.status)).length;
  const summary = {
    total: all.length,
    approved: count(TERMINAL),
    inReview: count(["SUBMITTED", "SIGNED"]),
    returned: count(["RETURNED"]),
    drafts: count(["DRAFT"]),
    // المرحَّلة التي كانت قيد المراجعة عند التحول تُستكمل من السجل نفسه
    awaitingMe: [...all, ...archive].filter((f) => f.awaitingMe).length,
  };

  // ------------------------------------------------------------ الخطوة التالية
  const steps: NextStep[] = [];
  const first = (kind: FormKind) => groups.find((g) => g.kind === kind)?.forms[0];
  if (isStudent && active) {
    const returned = [...all, ...archive].filter((f) => f.status === "RETURNED");
    for (const f of returned.slice(0, 2)) steps.push({ text: `أُعيد إليك «${f.title}» للتعديل — راجع الملاحظات ثم أعد رفعه`, href: `/forms/${f.id}`, tone: "danger" });

    if (mode === "FIELD") {
      const c = first("COMMENCEMENT");
      if (!c) steps.push({ text: "ابدأ بنموذج مباشرة التدريب — لا تُتاح بقية النماذج قبل توقيعه من المشرف المؤسسي ومدير المؤسسة", tone: "warning" });
      else if (c.status === "DRAFT") steps.push({ text: "أكمل نموذج المباشرة ووقّعه ثم ارفعه", href: `/forms/${c.id}`, tone: "warning" });
      else if (c.status === "SUBMITTED") steps.push({ text: "نموذج المباشرة بانتظار توقيع المشرف المؤسسي وختم المؤسسة", href: `/forms/${c.id}`, tone: "info" });
    }
    if (commenced) {
      if (mode === "FIELD" && !first("ORGANIZATION_PROFILE")) steps.push({ text: "أعدّ التقرير التعريفي بمؤسسة التدريب", tone: "info" });
      const plan = first("TRAINING_PLAN");
      if (!plan) steps.push({ text: mode === "FIELD" ? "أعدّ خطة التدريب بالتشارك مع المشرف المؤسسي" : "أعدّ خطة التدريب بالتشارك مع المشرف الأكاديمي", tone: "info" });
      const week = weekNumberFor(placement.startDate, riyadhDateOnly());
      const today = riyadhDateOnly();
      if (today >= placement.startDate && today <= placement.endDate && !placement.forms.some((f) => f.kind === "SKILLS_LOG" && f.skillsLog?.weekNumber === week)) {
        steps.push({ text: `سجّل المهارات والمعارف للأسبوع ${week}`, tone: "info" });
      }
    }
    const drafts = all.filter((f) => f.status === "DRAFT" && !steps.some((s) => s.href === `/forms/${f.id}`));
    if (drafts.length) steps.push({ text: drafts.length === 1 ? `لديك مسودة لم تُرفع: «${drafts[0].title}»` : `لديك ${drafts.length} مسودات لم تُرفع بعد`, href: drafts.length === 1 ? `/forms/${drafts[0].id}` : undefined, tone: "info" });
    if (!steps.length) steps.push({ text: "لا إجراءات معلّقة عليك — واصل تسجيل عملك الميداني أولاً بأول", tone: "success" });
  } else if (!isStudent && summary.awaitingMe) {
    steps.push({ text: `${summary.awaitingMe} نموذج بانتظار إجرائك`, href: "/queue", tone: "warning" });
  }

  // ------------------------------------------------------------ الحضور (الميداني فقط)
  const attendance =
    mode === "FIELD"
      ? await prisma.attendanceRecord.groupBy({ by: ["status"], where: { placementId: placement.id }, _count: true }).then((rows) => {
          const c = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
          return { present: c("PRESENT") + c("LATE"), late: c("LATE"), absent: c("ABSENT"), excused: c("EXCUSED"), hours: Math.round((placement.approvedMinutes / 60) * 10) / 10, requiredHours: placement.requiredHours };
        })
      : null;

  const s = placement.section;
  return {
    isStudent,
    mode,
    coverTitle: mode === "FIELD" ? "السجل المهني للتدريب الميداني" : "السجل المهني للتدريب الميداني بالمحاكاة",
    modeLabel: TRAINING_MODE_LABELS[mode],
    trainee: {
      placementId: placement.id,
      name: placement.student.user.fullName,
      universityId: placement.student.universityId,
      major: placement.student.major,
      courseName: s?.courseName ?? null,
      courseCode: s?.courseCode ?? null,
      sectionNumber: s?.sectionNumber ?? null,
      trainingNumber: s?.trainingNumber ?? null,
      track: s?.track ?? null,
      term: placement.term.name,
      organization: placement.organization.name,
      fieldSupervisor: placement.fieldSupervisor?.user.fullName ?? null,
      academicSupervisor: placement.academicSupervisor?.user.fullName ?? null,
      startDate: placement.startDate,
      endDate: placement.endDate,
      commencedAt: placement.commencedAt,
      status: placement.status,
    },
    groups,
    additional,
    archive,
    templates,
    summary,
    steps: steps.slice(0, 4),
    attendance,
  };
}

export type Portfolio = NonNullable<Awaited<ReturnType<typeof loadPortfolio>>>;
