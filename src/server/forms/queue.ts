// =====================================================================
//  قوائم الاعتماد: ما ينتظر المشرف المؤسسي (التوقيع) والمشرف الأكاديمي (الاعتماد)،
//  ونظرة الاختناقات لرئيس الوحدة ورئيس القسم
// =====================================================================
import type { DocumentStatus, FormKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/api";
import { placementScope } from "@/server/access";
import { FORM_KINDS, FORM_POLICIES, formDisplayTitle, policyFor } from "@/lib/forms/catalog";
import { can } from "@/lib/forms/permissions";
import { customTitle } from "@/lib/forms/ui/custom";
import { modeOf } from "./service";

/** مهلة المراجعة المتوقعة؛ ما تجاوزها يظهر متأخراً */
export const QUEUE_SLA_DAYS = 7;
const DAY = 86_400_000;
const PENDING: DocumentStatus[] = ["SUBMITTED", "SIGNED"];

/**
 * مجموعة التصفية: نوع النموذج الرسمي، أو «LEGACY» للسجلات المرحَّلة من النظام السابق
 * (تبقى قابلة للاستكمال: ما كان قيد المراجعة عند التحول يُعتمد من هنا)
 */
export type QueueGroup = FormKind | "LEGACY";
const GROUP_ORDER = (g: QueueGroup) => (g === "LEGACY" ? 100 : FORM_POLICIES[g].portfolioOrder);
const GROUP_TITLE = (g: QueueGroup) => (g === "LEGACY" ? "سجلات مرحّلة من النظام السابق" : g === "CUSTOM" ? "نماذج إضافية" : FORM_POLICIES[g].title);
const parseGroup = (g?: string | null): QueueGroup | null => (g === "LEGACY" || (g && (FORM_KINDS as readonly string[]).includes(g)) ? (g as QueueGroup) : null);

const SELECT = {
  id: true, kind: true, sequence: true, status: true, title: true, templateKey: true, submittedAt: true, fieldApprovedAt: true, lockedAt: true,
  quickSituation: { select: { domain: true } },
  placement: {
    select: {
      id: true,
      student: { select: { userId: true, universityId: true, user: { select: { fullName: true } } } },
      organization: { select: { name: true } },
      section: { select: { mode: true, sectionNumber: true } },
      fieldSupervisor: { select: { userId: true, user: { select: { fullName: true } } } },
      academicSupervisor: { select: { userId: true, user: { select: { fullName: true } } } },
    },
  },
} satisfies Prisma.FieldFormSelect;

type Row = Prisma.FieldFormGetPayload<{ select: typeof SELECT }>;

export interface QueueItem {
  id: string;
  kind: FormKind;
  group: QueueGroup;
  legacy: boolean;
  title: string;
  stage: "FIELD" | "ACADEMIC";
  since: Date;
  ageDays: number;
  overdue: boolean;
  fieldApproval: boolean;
  status: DocumentStatus;
  placementId: string;
  student: string;
  universityId: string;
  organization: string;
  simulation: boolean;
  /** المسؤول عن الخطوة الحالية (لنظرة الاختناقات) */
  owner: string | null;
}

/** معرّفات النماذج المرحَّلة (data._legacy) — استعلام خفيف بدل تحميل محتوى JSON */
async function legacyIds(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`select id from "FieldForm" where kind = 'CUSTOM' and (data -> '_legacy') is not null`;
  return new Set(rows.map((r) => r.id));
}

const titleOf = (f: Row) => (f.kind === "CUSTOM" ? f.title ?? customTitle(f.templateKey) : formDisplayTitle(f.kind, f.sequence, f.quickSituation?.domain));

function toItem(f: Row, now: number, legacy: Set<string>): QueueItem {
  const mode = modeOf(f.placement);
  const policy = policyFor(f.kind, mode);
  const stage = f.status === "SUBMITTED" && policy.fieldApproval ? "FIELD" : "ACADEMIC";
  const since = (stage === "ACADEMIC" && f.status === "SIGNED" ? f.fieldApprovedAt : f.submittedAt) ?? f.submittedAt ?? new Date(now);
  const ageDays = Math.max(0, Math.floor((now - since.getTime()) / DAY));
  const p = f.placement;
  const isLegacy = legacy.has(f.id);
  return {
    id: f.id, kind: f.kind, group: isLegacy ? "LEGACY" : f.kind, legacy: isLegacy, title: titleOf(f),
    stage, since, ageDays, overdue: ageDays > QUEUE_SLA_DAYS, fieldApproval: policy.fieldApproval, status: f.status,
    placementId: p.id, student: p.student.user.fullName, universityId: p.student.universityId, organization: p.organization.name, simulation: mode === "SIMULATION",
    owner: (stage === "FIELD" ? p.fieldSupervisor?.user.fullName : p.academicSupervisor?.user.fullName) ?? null,
  };
}

const oldestFirst = (a: QueueItem, b: QueueItem) => b.ageDays - a.ageDays || a.since.getTime() - b.since.getTime();

/** شرائح التصفية: عدد المعلّق في كل مجموعة (من القائمة كاملة) */
function countGroups(items: { group: QueueGroup }[]) {
  const m = new Map<QueueGroup, number>();
  for (const it of items) m.set(it.group, (m.get(it.group) ?? 0) + 1);
  return [...m.entries()].map(([group, count]) => ({ group, count, title: GROUP_TITLE(group) })).sort((a, b) => GROUP_ORDER(a.group) - GROUP_ORDER(b.group));
}

// ------------------------------------------------------------------ قائمة المشرف

/** ما ينتظر إجراء المشرف فعلاً — بالصلاحية نفسها التي تحكم أزرار صفحة النموذج */
async function pendingFor(user: SessionUser): Promise<QueueItem[]> {
  const now = Date.now();
  const [rows, legacy] = await Promise.all([
    prisma.fieldForm.findMany({ where: { placement: placementScope(user), status: { in: PENDING }, lockedAt: null }, select: SELECT }),
    legacyIds(),
  ]);
  const mine = rows.filter((f) => {
    const actor = {
      role: user.role,
      isOwner: false,
      isFieldSupervisor: f.placement.fieldSupervisor?.userId === user.id,
      isAcademicSupervisor: f.placement.academicSupervisor?.userId === user.id,
    };
    const state = { status: f.status, locked: !!f.lockedAt, everSubmitted: true };
    const policy = policyFor(f.kind, modeOf(f.placement));
    return can(actor, policy, state, "FIELD_SIGN") || can(actor, policy, state, "ACADEMIC_APPROVE");
  });
  return mine.map((f) => toItem(f, now, legacy)).sort(oldestFirst);
}

export async function loadSupervisorQueue(user: SessionUser, filter?: string | null) {
  const group = parseGroup(filter);
  const all = await pendingFor(user);
  const items = group ? all.filter((i) => i.group === group) : all;

  // تجميع حسب الطالب — الأقدم انتظاراً أولاً
  const byStudent = new Map<string, { placementId: string; student: string; universityId: string; organization: string; simulation: boolean; items: QueueItem[] }>();
  for (const it of items) {
    const g = byStudent.get(it.placementId) ?? { placementId: it.placementId, student: it.student, universityId: it.universityId, organization: it.organization, simulation: it.simulation, items: [] };
    g.items.push(it);
    byStudent.set(it.placementId, g);
  }

  // طلابي: كل الإسنادات في النطاق مع عدد المعلّق والمعاد
  const placements = await prisma.placement.findMany({
    where: { ...placementScope(user), status: { in: ["ASSIGNED", "ACTIVE", "COMPLETED"] } },
    select: {
      id: true,
      student: { select: { universityId: true, user: { select: { fullName: true } } } },
      organization: { select: { name: true } },
      section: { select: { mode: true } },
      _count: { select: { forms: { where: { status: "RETURNED" } } } },
    },
    orderBy: { student: { user: { fullName: "asc" } } },
  });
  const pendingBy = new Map<string, number>();
  for (const it of all) pendingBy.set(it.placementId, (pendingBy.get(it.placementId) ?? 0) + 1);

  return {
    group,
    items,
    groups: [...byStudent.values()],
    groupCounts: countGroups(all),
    stats: {
      pending: items.length,
      overdue: items.filter((i) => i.overdue).length,
      oldestDays: items[0]?.ageDays ?? 0,
      students: byStudent.size,
    },
    students: placements.map((p) => ({
      placementId: p.id,
      name: p.student.user.fullName,
      universityId: p.student.universityId,
      organization: p.organization.name,
      simulation: p.section?.mode === "SIMULATION",
      pending: pendingBy.get(p.id) ?? 0,
      returned: p._count.forms,
    })),
  };
}

// ------------------------------------------------------------------ نظرة الاختناقات (رئيس الوحدة / القسم)

export async function loadQueueOverview(filter?: string | null) {
  const group = parseGroup(filter);
  const now = Date.now();
  const [rows, waitingOnStudents, legacy] = await Promise.all([
    prisma.fieldForm.findMany({ where: { status: { in: PENDING }, lockedAt: null }, select: SELECT }),
    prisma.fieldForm.findMany({ where: { status: { in: ["RETURNED", "DRAFT"] }, lockedAt: null }, select: { id: true, kind: true, status: true } }),
    legacyIds(),
  ]);
  const all = rows.map((f) => toItem(f, now, legacy)).sort(oldestFirst);
  const items = group ? all.filter((i) => i.group === group) : all;
  const others = waitingOnStudents
    .map((f) => ({ ...f, group: (legacy.has(f.id) ? "LEGACY" : f.kind) as QueueGroup }))
    .filter((f) => !group || f.group === group);

  const bySup = new Map<string, { name: string; stage: QueueItem["stage"]; pending: number; overdue: number; oldestDays: number }>();
  for (const it of items) {
    const key = `${it.stage}:${it.owner ?? "—"}`;
    const s = bySup.get(key) ?? { name: it.owner ?? (it.stage === "FIELD" ? "بلا مشرف مؤسسي مسند" : "بلا مشرف أكاديمي مسند"), stage: it.stage, pending: 0, overdue: 0, oldestDays: 0 };
    s.pending++;
    if (it.overdue) s.overdue++;
    s.oldestDays = Math.max(s.oldestDays, it.ageDays);
    bySup.set(key, s);
  }

  const byGroup = new Map<QueueGroup, { field: number; academic: number }>();
  for (const it of items) {
    const k = byGroup.get(it.group) ?? { field: 0, academic: 0 };
    if (it.stage === "FIELD") k.field++;
    else k.academic++;
    byGroup.set(it.group, k);
  }

  // توزيع الأعمار: حتى 3 أيام، 4–7، 8–14، أكثر من 14
  const buckets = [
    { label: "حتى 3 أيام", test: (d: number) => d <= 3 },
    { label: "4 – 7 أيام", test: (d: number) => d > 3 && d <= 7 },
    { label: "8 – 14 يوماً", test: (d: number) => d > 7 && d <= 14 },
    { label: "أكثر من 14 يوماً", test: (d: number) => d > 14 },
  ].map((b) => ({ label: b.label, count: items.filter((i) => b.test(i.ageDays)).length }));

  return {
    group,
    stats: {
      awaitingField: items.filter((i) => i.stage === "FIELD").length,
      awaitingAcademic: items.filter((i) => i.stage === "ACADEMIC").length,
      overdue: items.filter((i) => i.overdue).length,
      unassigned: items.filter((i) => !i.owner).length,
      returned: others.filter((f) => f.status === "RETURNED").length,
      drafts: others.filter((f) => f.status === "DRAFT").length,
    },
    supervisors: [...bySup.values()].sort((a, b) => b.oldestDays - a.oldestDays || b.pending - a.pending),
    byGroup: [...byGroup.entries()].map(([g, v]) => ({ group: g, title: GROUP_TITLE(g), ...v })).sort((a, b) => GROUP_ORDER(a.group) - GROUP_ORDER(b.group)),
    buckets,
    oldest: items.slice(0, 15),
    groupCounts: countGroups(all),
  };
}
