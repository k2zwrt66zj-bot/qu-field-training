// =====================================================================
//  خدمة «سجل الاجتماعات الإشرافية الجماعية»
//  المجموعة الإشرافية = (الفصل، مؤسسة التدريب، المشرف الأكاديمي)، والاجتماعات مرقّمة داخلها
// =====================================================================
import { createHash } from "node:crypto";
import type { z } from "zod";
import { Prisma, type DocumentStatus, type SignatureSlot } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, audit, type SessionUser } from "@/lib/api";
import { canonicalJson } from "@/lib/forms/canonical";
import { ORG_CATEGORY_LABELS } from "@/lib/labels";
import {
  chairPatchSchema, checkMeetingSubmit, meetingCounts, printedAgenda, secretaryPatchSchema,
  type MeetingAction, type MeetingAttendanceRow,
} from "@/lib/meetings";
import { getActiveTerm } from "@/server/stats";

const HEADS = ["TRAINING_HEAD", "DEPARTMENT_HEAD", "ADMIN"];
const MEMBER_STATUSES = ["ASSIGNED", "ACTIVE", "COMPLETED"] as const;
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

const MEETING_INCLUDE = {
  organization: true,
  term: { select: { id: true, name: true } },
  academicSupervisor: { include: { user: { select: { id: true, fullName: true } } } },
  secretary: { select: { id: true, student: { select: { userId: true, user: { select: { fullName: true } } } } } },
  attendance: {
    include: { placement: { select: { id: true, student: { select: { userId: true, universityId: true, user: { select: { fullName: true } } } } } } },
  },
  signatures: { include: { signature: { select: { imageData: true, signedAt: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.SupervisionMeetingInclude;

type LoadedMeeting = Prisma.SupervisionMeetingGetPayload<{ include: typeof MEETING_INCLUDE }>;

/** أعضاء المجموعة الإشرافية: متدربو المؤسسة المسندون للمشرف الأكاديمي في الفصل */
function groupMembers(termId: string, organizationId: string, academicSupervisorId: string) {
  return prisma.placement.findMany({
    where: { termId, organizationId, academicSupervisorId, status: { in: [...MEMBER_STATUSES] } },
    select: { id: true, sectionId: true, student: { select: { universityId: true, user: { select: { fullName: true } } } } },
    orderBy: { student: { user: { fullName: "asc" } } },
  });
}

// ------------------------------------------------------------------ الصلاحيات

export interface MeetingAccess {
  chair: boolean;
  secretary: boolean;
  member: boolean;
  head: boolean;
}

function accessFor(user: SessionUser, m: LoadedMeeting): MeetingAccess {
  return {
    chair: m.academicSupervisor.user.id === user.id,
    secretary: m.secretary?.student.userId === user.id,
    member: m.attendance.some((a) => a.placement.student.userId === user.id),
    head: HEADS.includes(user.role),
  };
}

function canView(a: MeetingAccess, status: DocumentStatus) {
  // المسودة لرئيس الاجتماع وأمينه فقط، وبقية الأعضاء يرونه بعد الرفع
  return a.chair || a.head || a.secretary || (a.member && status !== "DRAFT");
}

export function meetingActions(a: MeetingAccess, m: { status: DocumentStatus; submittedAt: Date | null }) {
  const draft = m.status === "DRAFT";
  return {
    editAll: a.chair && draft,
    editMinutes: (a.chair || a.secretary) && draft,
    submit: a.secretary && draft,
    approve: a.chair && m.status === "SUBMITTED",
    return: a.chair && m.status === "SUBMITTED",
    delete: a.chair && draft && !m.submittedAt,
  };
}

/** يحمّل الاجتماع بالصلاحية، ويضيف للمسودة من انضم للمجموعة بعد إنشائها */
export async function loadMeetingFor(user: SessionUser, id: string) {
  let m = await prisma.supervisionMeeting.findUnique({ where: { id }, include: MEETING_INCLUDE });
  if (!m) throw new ApiError(404, "الاجتماع غير موجود");
  const access = accessFor(user, m);
  if (!canView(access, m.status)) throw new ApiError(404, "الاجتماع غير موجود");
  if (m.status === "DRAFT") {
    const members = await groupMembers(m.termId, m.organizationId, m.academicSupervisorId);
    const missing = members.filter((p) => !m!.attendance.some((a) => a.placementId === p.id));
    if (missing.length) {
      await prisma.meetingAttendance.createMany({ data: missing.map((p) => ({ meetingId: m!.id, placementId: p.id })), skipDuplicates: true });
      m = await prisma.supervisionMeeting.findUniqueOrThrow({ where: { id }, include: MEETING_INCLUDE });
    }
  }
  return { meeting: m, access };
}

// ------------------------------------------------------------------ العرض

const attendanceRows = (m: LoadedMeeting): (MeetingAttendanceRow & { universityId: string })[] =>
  m.attendance
    .map((a) => ({ placementId: a.placementId, name: a.placement.student.user.fullName, universityId: a.placement.student.universityId, status: a.status, excuse: a.excuse }))
    .sort((x, y) => x.name.localeCompare(y.name, "ar"));

const checkInput = (m: LoadedMeeting) => ({
  number: m.number,
  meetingDate: iso(m.meetingDate),
  startTime: m.startTime,
  durationMinutes: m.durationMinutes,
  location: m.location,
  agendaItems: m.agendaItems,
  minutes: m.minutes,
  decisions: m.decisions,
  secretaryPlacementId: m.secretaryPlacementId,
  attendance: attendanceRows(m),
});

export async function presentMeeting(m: LoadedMeeting, access: MeetingAccess) {
  const attendance = attendanceRows(m);
  const total = await prisma.supervisionMeeting.count({ where: { termId: m.termId, organizationId: m.organizationId, academicSupervisorId: m.academicSupervisorId } });
  return {
    id: m.id,
    number: m.number,
    status: m.status,
    term: m.term.name,
    header: {
      organization: m.organization.name,
      field: ORG_CATEGORY_LABELS[m.organization.category],
      academicSupervisor: m.academicSupervisor.user.fullName,
      trainees: attendance.length,
      meetingsCount: total,
    },
    meetingDate: iso(m.meetingDate),
    startTime: m.startTime,
    durationMinutes: m.durationMinutes,
    location: m.location,
    agendaItems: m.agendaItems,
    printedAgenda: printedAgenda(m.number, m.agendaItems),
    minutes: m.minutes,
    decisions: m.decisions,
    secretaryPlacementId: m.secretaryPlacementId,
    secretaryName: m.secretary?.student.user.fullName ?? null,
    attendance,
    counts: meetingCounts(attendance),
    returnNote: m.status === "DRAFT" ? m.returnNote : null,
    submittedAt: m.submittedAt,
    approvedAt: m.approvedAt,
    signatures: m.signatures.map((s) => ({ slot: s.slot, signerName: s.signerName, signedAt: s.signature.signedAt, imageData: s.signature.imageData })),
    issues: m.status === "DRAFT" ? checkMeetingSubmit(checkInput(m)) : [],
    actions: meetingActions(access, m),
    viewer: access,
  };
}

export type PresentedMeeting = Awaited<ReturnType<typeof presentMeeting>>;

// ------------------------------------------------------------------ القوائم

/** المجموعات الإشرافية واجتماعاتها ضمن نطاق المستخدم في الفصل الحالي */
export async function listMeetingGroups(user: SessionUser) {
  const term = await getActiveTerm();
  if (!term) return { term: null, groups: [] };
  const scope: Prisma.PlacementWhereInput =
    user.role === "ACADEMIC_SUPERVISOR" ? { academicSupervisor: { userId: user.id } }
    : user.role === "STUDENT" ? { student: { userId: user.id } }
    : HEADS.includes(user.role) ? {}
    : { id: "__none__" }; // المشرف المؤسسي: الاجتماعات الإشرافية شأن أكاديمي
  const placements = await prisma.placement.findMany({
    where: { termId: term.id, status: { in: [...MEMBER_STATUSES] }, academicSupervisorId: { not: null }, ...scope },
    select: {
      organizationId: true, academicSupervisorId: true,
      organization: { select: { name: true, category: true } },
      academicSupervisor: { select: { user: { select: { fullName: true } } } },
    },
  });
  const keyed = new Map<string, { organizationId: string; academicSupervisorId: string; organization: string; field: string; academicSupervisor: string }>();
  for (const p of placements) {
    const key = `${p.organizationId}:${p.academicSupervisorId}`;
    if (!keyed.has(key)) keyed.set(key, { organizationId: p.organizationId, academicSupervisorId: p.academicSupervisorId!, organization: p.organization.name, field: ORG_CATEGORY_LABELS[p.organization.category], academicSupervisor: p.academicSupervisor!.user.fullName });
  }
  const groups = await Promise.all(
    [...keyed.values()].map(async (g) => {
      const [members, meetings] = await Promise.all([
        prisma.placement.count({ where: { termId: term.id, organizationId: g.organizationId, academicSupervisorId: g.academicSupervisorId, status: { in: [...MEMBER_STATUSES] } } }),
        prisma.supervisionMeeting.findMany({
          where: { termId: term.id, organizationId: g.organizationId, academicSupervisorId: g.academicSupervisorId },
          include: { attendance: { select: { status: true, placement: { select: { student: { select: { userId: true } } } } } }, secretary: { select: { student: { select: { userId: true } } } } },
          orderBy: { number: "asc" },
        }),
      ]);
      const visible = meetings.filter((m) =>
        user.role === "STUDENT" ? m.status !== "DRAFT" || m.secretary?.student.userId === user.id : true
      );
      return {
        ...g,
        members,
        canCreate: user.role === "ACADEMIC_SUPERVISOR",
        meetings: visible.map((m) => {
          const mine = user.role === "STUDENT" ? m.attendance.find((a) => a.placement.student.userId === user.id)?.status ?? null : null;
          return {
            id: m.id, number: m.number, status: m.status, meetingDate: iso(m.meetingDate),
            present: m.attendance.filter((a) => a.status === "PRESENT").length, absent: m.attendance.filter((a) => a.status !== "PRESENT").length,
            myAttendance: mine, iAmSecretary: m.secretary?.student.userId === user.id,
          };
        }),
      };
    })
  );
  groups.sort((a, b) => a.organization.localeCompare(b.organization, "ar"));
  return { term, groups };
}

// ------------------------------------------------------------------ الإنشاء والتعديل

export async function createMeeting(user: SessionUser, organizationId: string) {
  const sup = await prisma.academicSupervisorProfile.findUnique({ where: { userId: user.id } });
  if (!sup) throw new ApiError(403, "إنشاء الاجتماعات للمشرف الأكاديمي");
  const term = await getActiveTerm();
  if (!term) throw new ApiError(409, "لا يوجد فصل دراسي فعّال");
  const members = await groupMembers(term.id, organizationId, sup.id);
  if (!members.length) throw new ApiError(422, "لا يوجد متدربون مسندون إليك في هذه المؤسسة");
  const sections = [...new Set(members.map((m) => m.sectionId).filter(Boolean))];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const last = await tx.supervisionMeeting.findFirst({ where: { termId: term.id, organizationId, academicSupervisorId: sup.id }, orderBy: { number: "desc" }, select: { number: true } });
        return tx.supervisionMeeting.create({
          data: {
            termId: term.id, organizationId, academicSupervisorId: sup.id, sectionId: sections.length === 1 ? sections[0] : null,
            number: (last?.number ?? 0) + 1,
            meetingDate: new Date(new Date().toISOString().slice(0, 10)),
            approvePreviousMinutes: !!last,
            attendance: { create: members.map((m) => ({ placementId: m.id })) },
          },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
  throw new ApiError(500, "تعذر إنشاء الاجتماع");
}

export async function updateMeeting(user: SessionUser, id: string, payload: unknown) {
  const { meeting: m, access } = await loadMeetingFor(user, id);
  const can = meetingActions(access, m);
  if (!can.editMinutes) throw new ApiError(403, m.status === "DRAFT" ? "ليست لديك صلاحية تعديل هذا الاجتماع" : "لا يمكن تعديل المحضر بعد رفعه");
  const parsed = (can.editAll ? chairPatchSchema : secretaryPatchSchema).safeParse(payload);
  if (!parsed.success) throw new ApiError(422, "بيانات غير صالحة", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  const body = parsed.data as z.infer<typeof chairPatchSchema>;

  const memberIds = new Set(m.attendance.map((a) => a.placementId));
  if (body.secretaryPlacementId && !memberIds.has(body.secretaryPlacementId)) throw new ApiError(422, "أمين الاجتماع يجب أن يكون من متدربي المجموعة");
  if (body.attendance?.some((a) => !memberIds.has(a.placementId))) throw new ApiError(422, "متدرب ليس من أعضاء المجموعة");

  await prisma.$transaction(async (tx) => {
    const { attendance, meetingDate, ...rest } = body;
    await tx.supervisionMeeting.update({
      where: { id: m.id },
      data: {
        ...rest,
        ...(meetingDate ? { meetingDate: new Date(`${meetingDate}T00:00:00Z`) } : {}),
        ...(rest.agendaItems ? { agendaItems: rest.agendaItems.filter((x) => x.trim()) } : {}),
        ...(rest.decisions ? { decisions: rest.decisions.filter((x) => x.trim()) } : {}),
      },
    });
    for (const a of attendance ?? []) {
      await tx.meetingAttendance.update({
        where: { meetingId_placementId: { meetingId: m.id, placementId: a.placementId } },
        data: { status: a.status, excuse: a.status === "PRESENT" ? null : a.excuse ?? null },
      });
    }
  });
  return loadMeetingFor(user, id);
}

export async function deleteMeeting(user: SessionUser, id: string) {
  const { meeting: m, access } = await loadMeetingFor(user, id);
  if (!meetingActions(access, m).delete) throw new ApiError(403, "لا يمكن حذف هذا الاجتماع");
  const later = await prisma.supervisionMeeting.count({ where: { termId: m.termId, organizationId: m.organizationId, academicSupervisorId: m.academicSupervisorId, number: { gt: m.number } } });
  if (later) throw new ApiError(409, "لا يمكن حذف اجتماع تلته اجتماعات أخرى (يختل الترقيم)");
  await prisma.supervisionMeeting.delete({ where: { id: m.id } });
}

// ------------------------------------------------------------------ الرفع والاعتماد والإعادة

/** بصمة محتوى المحضر وقت التوقيع */
export const meetingContentHash = (m: LoadedMeeting) =>
  createHash("sha256").update(canonicalJson({ id: m.id, organizationId: m.organizationId, ...checkInput(m) })).digest("hex");

export async function transitionMeeting(user: SessionUser, id: string, input: { action: MeetingAction; imageData?: string; comment?: string }, ip?: string | null) {
  const { meeting: m, access } = await loadMeetingFor(user, id);
  const can = meetingActions(access, m);
  const allowed = input.action === "SUBMIT" ? can.submit : input.action === "APPROVE" ? can.approve : can.return;
  if (!allowed) {
    throw new ApiError(403, input.action === "SUBMIT" ? "يرفع المحضر أمين الاجتماع المحدد" : "الاعتماد والإعادة لرئيس الاجتماع (المشرف الأكاديمي)");
  }

  if (input.action === "RETURN") {
    const note = input.comment?.trim();
    if (!note || note.length < 3) throw new ApiError(422, "اكتب سبب الإعادة للأمين");
    await prisma.$transaction([
      prisma.formSignature.deleteMany({ where: { meetingId: m.id } }),
      prisma.supervisionMeeting.update({ where: { id: m.id }, data: { status: "DRAFT", returnNote: note } }),
    ]);
    await audit(user.id, "meeting.return", "SupervisionMeeting", m.id, { number: m.number }, ip);
    return loadMeetingFor(user, id);
  }

  const issues = checkMeetingSubmit(checkInput(m));
  if (issues.length) throw new ApiError(422, "أكمل المحضر قبل التوقيع", issues.map((message) => ({ path: "meeting", message })));
  if (!input.imageData || !PNG_DATA_URL.test(input.imageData) || input.imageData.length > 300_000) throw new ApiError(422, "التوقيع مطلوب");

  const slot: SignatureSlot = input.action === "SUBMIT" ? "MEETING_SECRETARY" : "MEETING_CHAIR";
  const signerName = input.action === "SUBMIT" ? m.secretary!.student.user.fullName : m.academicSupervisor.user.fullName;
  const hash = meetingContentHash(m);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.formSignature.deleteMany({ where: { meetingId: m.id, slot } });
    const sig = await tx.signature.create({ data: { signerId: user.id, imageData: input.imageData!, contentHash: hash, ipAddress: ip ?? undefined } });
    await tx.formSignature.create({ data: { slot, signatureId: sig.id, signerUserId: user.id, signerName, meetingId: m.id } });
    await tx.supervisionMeeting.update({
      where: { id: m.id },
      data: input.action === "SUBMIT" ? { status: "SUBMITTED", submittedAt: now, returnNote: null } : { status: "REVIEWED", approvedAt: now },
    });
  });
  await audit(user.id, `meeting.${input.action.toLowerCase()}`, "SupervisionMeeting", m.id, { number: m.number, hash }, ip);
  return loadMeetingFor(user, id);
}

