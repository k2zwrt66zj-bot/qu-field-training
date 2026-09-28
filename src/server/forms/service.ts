// =====================================================================
//  خدمة النماذج الرسمية: الإنشاء، التحميل بالصلاحيات، الحفظ، الانتقالات، الملاحظات
// =====================================================================
import { createHash } from "node:crypto";
import { Prisma, type FormKind, type SignatureSlot, type SituationDomain } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, audit, type SessionUser } from "@/lib/api";
import { FORM_POLICIES, SLOT_LABELS, formDisplayTitle } from "@/lib/forms/catalog";
import { nextState, type FormAction } from "@/lib/forms/workflow";
import { allowedActions, can, type Actor, type FormPermission } from "@/lib/forms/permissions";
import { validateForm } from "@/lib/forms/schemas";
import { canonicalJson } from "@/lib/forms/canonical";
import { applyPrivacy } from "@/lib/forms/privacy";
import { formatApa, type ApaSourceType } from "@/lib/forms/apa";
import { FORM_INCLUDE, DETAIL_RELATION, type LoadedForm, type OfficialKind } from "./include";
import { editableData, serializeForm } from "./serialize";
import { persistFormData } from "./persist";
import { defaultDomain, prefillDetail } from "./prefill";

const OFFICIAL = Object.keys(DETAIL_RELATION) as OfficialKind[];
const isOfficial = (k: FormKind): k is OfficialKind => (OFFICIAL as string[]).includes(k);
const domainOf = (f: LoadedForm) => f.quickSituation?.domain ?? null;

// ------------------------------------------------------------------ التحميل والصلاحيات

export function actorFor(user: SessionUser, form: Pick<LoadedForm, "placement">): Actor {
  const p = form.placement;
  return {
    role: user.role,
    isOwner: p.student.userId === user.id,
    isFieldSupervisor: p.fieldSupervisor?.userId === user.id,
    isAcademicSupervisor: p.academicSupervisor?.userId === user.id,
  };
}

const stateOf = (f: LoadedForm) => ({ status: f.status, locked: !!f.lockedAt, everSubmitted: !!f.submittedAt });

/** يحمّل النموذج ويتحقق من الصلاحية؛ من لا يحق له العرض يتلقى 404 (لا نكشف وجود النموذج) */
export async function loadFormFor(user: SessionUser, id: string, perm: FormPermission = "VIEW") {
  const form = await prisma.fieldForm.findUnique({ where: { id }, include: FORM_INCLUDE });
  if (!form) throw new ApiError(404, "النموذج غير موجود");
  const actor = actorFor(user, form);
  const policy = FORM_POLICIES[form.kind];
  if (!can(actor, policy, stateOf(form), "VIEW")) throw new ApiError(404, "النموذج غير موجود");
  if (perm !== "VIEW" && !can(actor, policy, stateOf(form), perm)) {
    throw new ApiError(403, perm === "EDIT" ? "لا يمكن تعديل النموذج في حالته الحالية" : "ليست لديك صلاحية لهذا الإجراء");
  }
  return { form, actor, policy };
}

/** العرض الكامل للواجهة: البيانات (بعد الإخفاء) + التواقيع + المرفقات + الملاحظات + الإجراءات المسموحة */
export function presentForm(form: LoadedForm, actor: Actor) {
  const policy = FORM_POLICIES[form.kind];
  const data = applyPrivacy(form.kind, serializeForm(form), actor);
  const r = form.reading;
  return {
    id: form.id,
    kind: form.kind,
    sequence: form.sequence,
    domain: domainOf(form),
    title: formDisplayTitle(form.kind, form.sequence, domainOf(form)),
    status: form.status,
    locked: !!form.lockedAt,
    submittedAt: form.submittedAt,
    fieldApprovedAt: form.fieldApprovedAt,
    academicApprovedAt: form.academicApprovedAt,
    academicScore: form.academicScore == null ? null : Number(form.academicScore),
    placement: {
      id: form.placementId,
      student: form.placement.student.user.fullName,
      universityId: form.placement.student.universityId,
      organization: form.placement.organization.name,
    },
    policy: { slotsOnSubmit: policy.slotsOnSubmit, slotsOnFieldSign: policy.slotsOnFieldSign, fieldApproval: policy.fieldApproval, academicScore: policy.academicScore },
    data,
    apaHtml: r && r.title ? formatApa({ ...r, sourceType: r.sourceType as ApaSourceType }).html : undefined,
    linkedInterviewFormIds: form.caseStudy?.interviews.map((i) => i.formId),
    signatures: form.signatures.map((s) => ({ slot: s.slot, signerName: s.signerName, signerTitle: s.signerTitle, withStamp: s.withStamp, signedAt: s.signature.signedAt, imageData: s.signature.imageData })),
    attachments: form.attachments.map((a) => ({ id: a.id, kind: a.kind, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, caption: a.caption, createdAt: a.createdAt, url: `/api/attachments/${a.id}` })),
    comments: form.comments.map((c) => ({ id: c.id, author: c.author.fullName, role: c.author.role, body: c.body, createdAt: c.createdAt })),
    allowedActions: allowedActions(actor, policy, stateOf(form)),
  };
}

// ------------------------------------------------------------------ الإنشاء

export async function createForm(user: SessionUser, input: { kind: FormKind; domain?: SituationDomain | null }) {
  if (!isOfficial(input.kind)) throw new ApiError(422, "نوع نموذج غير مدعوم");
  const kind = input.kind;
  const placement = await prisma.placement.findFirst({
    where: { student: { userId: user.id }, status: { in: ["ASSIGNED", "ACTIVE"] } },
    include: { organization: true, fieldSupervisor: { include: { user: true } } },
    orderBy: { startDate: "desc" },
  });
  if (!placement) throw new ApiError(404, "لا يوجد تدريب ميداني فعّال");

  const policy = FORM_POLICIES[kind];
  const domain = kind === "QUICK_SITUATION" ? input.domain ?? defaultDomain(placement.organization.category) : null;
  if (kind === "QUICK_SITUATION" && !domain) throw new ApiError(422, "حدد مجال الموقف السريع: مدرسي أو طبي");
  if (kind !== "COMMENCEMENT" && placement.status === "ASSIGNED") {
    const commenced = await prisma.fieldForm.count({ where: { placementId: placement.id, kind: "COMMENCEMENT", status: { in: ["SIGNED", "REVIEWED"] } } });
    if (!commenced) throw new ApiError(409, "ابدأ بنموذج المباشرة واعتماده من المشرف المؤسسي أولاً");
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const last = await tx.fieldForm.findFirst({ where: { placementId: placement.id, kind }, orderBy: { sequence: "desc" }, select: { id: true, sequence: true } });
        if (policy.singleton && last) throw new ApiError(409, "هذا النموذج موجود مسبقاً", { existingId: last.id });
        const detail = await prefillDetail(tx, kind, placement, domain);
        const form = await tx.fieldForm.create({
          data: {
            kind,
            placementId: placement.id,
            sequence: (last?.sequence ?? 0) + 1,
            createdById: user.id,
            [DETAIL_RELATION[kind]]: { create: detail },
          } as Prisma.FieldFormUncheckedCreateInput,
        });
        return form;
      });
    } catch (e) {
      // تزامن: رقم تسلسلي محجوز للتو — نعيد المحاولة
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
  throw new ApiError(500, "تعذر إنشاء النموذج");
}

// ------------------------------------------------------------------ الحفظ

export async function saveDraft(user: SessionUser, id: string, payload: unknown) {
  const { form } = await loadFormFor(user, id, "EDIT");
  if (!isOfficial(form.kind)) throw new ApiError(422, "نوع نموذج غير مدعوم");
  const v = validateForm(form.kind, payload, "draft", domainOf(form));
  if (!v.ok) throw new ApiError(422, "بيانات غير صالحة", v.issues);
  await prisma.$transaction((tx) => persistFormData(tx, form, v.data));
  return loadFormFor(user, id);
}

export async function deleteForm(user: SessionUser, id: string) {
  const { form } = await loadFormFor(user, id, "DELETE");
  await prisma.fieldForm.delete({ where: { id: form.id } });
}

// ------------------------------------------------------------------ الانتقالات والتواقيع

export interface SignatureInput {
  slot: SignatureSlot;
  imageData: string;
  signerName?: string;
  signerTitle?: string;
  withStamp?: boolean;
}

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

/** بصمة المحتوى الموقَّع: تتغير بأي تعديل على بيانات النموذج */
export const formContentHash = (form: LoadedForm) =>
  createHash("sha256").update(canonicalJson({ id: form.id, kind: form.kind, sequence: form.sequence, placementId: form.placementId, data: serializeForm(form) })).digest("hex");

export async function transitionForm(
  user: SessionUser,
  id: string,
  input: { action: FormAction; comment?: string; signatures?: SignatureInput[]; score?: number },
  ip?: string | null
) {
  const { form, policy } = await loadFormFor(user, id, input.action);
  const t = nextState(policy, form.status, input.action, { locked: !!form.lockedAt });
  if (!t.ok) throw new ApiError(409, t.error);
  const comment = input.comment?.trim();
  if (t.requiresComment && !comment) throw new ApiError(422, "اكتب سبب الإعادة للطالب");

  // التحقق من المحتوى عند الرفع
  if (input.action === "SUBMIT" && isOfficial(form.kind)) {
    const v = validateForm(form.kind, editableData(form), "submit", domainOf(form));
    if (!v.ok) throw new ApiError(422, "أكمل الحقول المطلوبة قبل الرفع", v.issues);
  }

  // خانات التوقيع المطلوبة
  const sigs = input.signatures ?? [];
  for (const slot of t.requiredSlots) {
    const s = sigs.find((x) => x.slot === slot);
    if (!s) throw new ApiError(422, `التوقيع مطلوب: ${SLOT_LABELS[slot]}`);
    if (!PNG_DATA_URL.test(s.imageData) || s.imageData.length > 300_000) throw new ApiError(422, "صورة التوقيع غير صالحة");
    if (slot === "ORG_DIRECTOR" && !(s.signerName ?? form.placement.organization.directorName)) throw new ApiError(422, "اكتب اسم مدير المؤسسة");
  }
  const extra = sigs.filter((s) => !t.requiredSlots.includes(s.slot));
  if (extra.length) throw new ApiError(422, "خانة توقيع غير متوقعة في هذه المرحلة");

  const stampWanted = sigs.some((s) => s.withStamp);
  if (stampWanted) {
    const stamp = await prisma.attachment.count({ where: { organizationId: form.placement.organizationId, kind: "STAMP" } });
    if (!stamp) throw new ApiError(422, "لا يوجد ختم رسمي مرفوع لهذه المؤسسة");
  }

  const now = new Date();
  const hash = formContentHash(form);
  const org = form.placement.organization;

  await prisma.$transaction(async (tx) => {
    if (t.clearSignatures) await tx.formSignature.deleteMany({ where: { formId: form.id } });

    for (const slot of t.requiredSlots) {
      const s = sigs.find((x) => x.slot === slot)!;
      const signerName =
        slot === "ORG_DIRECTOR" ? (s.signerName ?? org.directorName)! : slot === "STUDENT" ? form.placement.student.user.fullName : user.name ?? "";
      await tx.formSignature.deleteMany({ where: { formId: form.id, slot } });
      const signature = await tx.signature.create({ data: { signerId: user.id, imageData: s.imageData, contentHash: hash, ipAddress: ip ?? undefined } });
      await tx.formSignature.create({
        data: {
          formId: form.id, slot, signatureId: signature.id, signerName, signerTitle: s.signerTitle,
          // المدير يوقّع على جهاز المشرف: لا نربطه بحساب المشرف
          signerUserId: slot === "ORG_DIRECTOR" ? null : user.id,
          withStamp: slot === "ORG_DIRECTOR" && !!s.withStamp,
        },
      });
    }

    const data: Prisma.FieldFormUncheckedUpdateInput = { status: t.to };
    switch (input.action) {
      case "SUBMIT":
        data.submittedAt = now;
        break;
      case "FIELD_SIGN":
        data.fieldApprovedAt = now;
        data.fieldApprovedById = user.id;
        break;
      case "ACADEMIC_APPROVE":
        data.academicApprovedAt = now;
        data.academicApprovedById = user.id;
        if (policy.academicScore && input.score != null) data.academicScore = input.score;
        break;
      default: // الإعادة: تُلغى الاعتمادات السابقة
        Object.assign(data, { fieldApprovedAt: null, fieldApprovedById: null, academicApprovedAt: null, academicApprovedById: null, academicScore: null });
    }
    await tx.fieldForm.update({ where: { id: form.id }, data });
    if (comment) await tx.formComment.create({ data: { formId: form.id, authorId: user.id, body: comment } });

    // ----- الآثار الجانبية -----
    if (form.kind === "COMMENCEMENT" && input.action === "FIELD_SIGN") {
      const c = form.commencement!;
      const director = sigs.find((s) => s.slot === "ORG_DIRECTOR");
      await tx.commencementForm.update({
        where: { formId: form.id },
        data: {
          supervisorMobile: form.placement.fieldSupervisor?.user.phone ?? null,
          organizationEmail: org.contactEmail,
          directorName: director?.signerName ?? org.directorName,
        },
      });
      await tx.placement.update({
        where: { id: form.placementId },
        data: { status: form.placement.status === "ASSIGNED" ? "ACTIVE" : undefined, commencedAt: c.commencementDate, workDays: [c.fixedTrainingDay], shift: c.shift },
      });
      if (!org.directorName && director?.signerName) await tx.organization.update({ where: { id: org.id }, data: { directorName: director.signerName } });
    }
    if (form.kind === "ORGANIZATION_PROFILE" && input.action === "ACADEMIC_APPROVE") {
      const o = form.organizationProfile!;
      await tx.organization.update({
        where: { id: org.id },
        data: {
          socialWorkersCount: o.socialWorkersCount ?? undefined,
          beneficiariesCount: o.beneficiariesCount ?? undefined,
          directorName: o.directorName ?? undefined,
        },
      });
    }
  });

  await audit(user.id, `form.${input.action.toLowerCase()}`, "FieldForm", form.id, { kind: form.kind, from: form.status, to: t.to, hash }, ip);
  return loadFormFor(user, id);
}

export async function addComment(user: SessionUser, id: string, body: string) {
  const { form } = await loadFormFor(user, id, "COMMENT");
  return prisma.formComment.create({ data: { formId: form.id, authorId: user.id, body } });
}
