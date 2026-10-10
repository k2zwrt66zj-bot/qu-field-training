// =====================================================================
//  إعادة توزيع الطالب ونقل مقر التدريب (Placement Transfer)
// ---------------------------------------------------------------------
//  الحوكمة: لا نعدّل الإسناد القديم بل نؤرشفه بحالة TRANSFERRED وننشئ إسناداً
//  جديداً للمقر الجديد. فتبقى سجلات الحضور والإنذارات والنماذج القديمة مربوطة
//  بالإسناد القديم (تاريخية غير قابلة للتعديل)، ويبدأ المقر الجديد بإحداثياته
//  وساعاته وتقييماته من تاريخ النقل، وتُضبط صلاحيات المشرفين تلقائياً.
// =====================================================================
import { ApiError, type SessionUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { riyadhDateOnly } from "@/lib/time";

export interface TransferInput {
  placementId: string;
  toOrganizationId: string;
  toFieldSupervisorId: string | null;
  reason: string;
  effectiveDate: string; // YYYY-MM-DD
  carryOverHours: boolean;
}

export interface TransferResult {
  fromPlacementId: string;
  toPlacementId: string;
  transferId: string;
}

export async function transferPlacement(user: SessionUser, input: TransferInput): Promise<TransferResult> {
  const old = await prisma.placement.findUnique({
    where: { id: input.placementId },
    include: { section: true },
  });
  if (!old) throw new ApiError(404, "الإسناد غير موجود");
  if ((old.section?.mode ?? "FIELD") !== "FIELD") throw new ApiError(422, "النقل يخص التدريب الميداني فقط (لا المحاكاة)");
  if (old.status !== "ASSIGNED" && old.status !== "ACTIVE") throw new ApiError(409, "لا يمكن نقل إسناد غير فعّال");

  const toOrg = await prisma.organization.findUnique({ where: { id: input.toOrganizationId } });
  if (!toOrg) throw new ApiError(404, "جهة التدريب الجديدة غير موجودة");
  if (!toOrg.isApproved) throw new ApiError(422, "جهة التدريب الجديدة غير معتمدة");

  const sameOrg = toOrg.id === old.organizationId;
  const sameFs = (input.toFieldSupervisorId ?? null) === (old.fieldSupervisorId ?? null);
  if (sameOrg && sameFs) throw new ApiError(422, "لا تغيير: اختر مقراً جديداً أو مشرفاً مؤسسياً مختلفاً");

  if (input.toFieldSupervisorId) {
    const toFs = await prisma.fieldSupervisorProfile.findUnique({ where: { id: input.toFieldSupervisorId }, select: { organizationId: true } });
    if (!toFs) throw new ApiError(404, "المشرف المؤسسي الجديد غير موجود");
    if (toFs.organizationId !== toOrg.id) throw new ApiError(422, "المشرف المؤسسي الجديد لا يتبع جهة التدريب المختارة");
  }

  // تاريخ النقل: يوم صالح ضمن نافذة التدريب، وليس في المستقبل البعيد
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) throw new ApiError(422, "تاريخ النقل غير صحيح");
  const effective = new Date(`${input.effectiveDate}T00:00:00.000Z`);
  if (Number.isNaN(effective.getTime())) throw new ApiError(422, "تاريخ النقل غير صحيح");
  if (effective < old.startDate) throw new ApiError(422, "تاريخ النقل قبل بداية التدريب");
  if (effective > old.endDate) throw new ApiError(422, "تاريخ النقل بعد نهاية مدة التدريب");
  const today = riyadhDateOnly();
  const maxFuture = new Date(today.getTime() + 7 * 86_400_000);
  if (effective > maxFuture) throw new ApiError(422, "تاريخ النقل أبعد من أسبوع في المستقبل");

  const completedMinutes = old.approvedMinutes;
  const carriedMinutes = input.carryOverHours ? completedMinutes : 0;
  const completedHours = Math.round(completedMinutes / 60);
  const newRequiredHours = input.carryOverHours ? Math.max(1, old.requiredHours - completedHours) : old.requiredHours;

  return prisma.$transaction(async (tx) => {
    // (1) أرشفة الإسناد القديم: حالة «منقول» وإغلاق نافذته — يصبح تاريخياً غير قابل للتعديل
    await tx.placement.update({ where: { id: old.id }, data: { status: "TRANSFERRED", endDate: effective } });
    // إنذارات الإسناد القديم المفتوحة تُغلق (انتهى المقر) مع بقائها كأرشيف
    await tx.alert.updateMany({ where: { placementId: old.id, isResolved: false }, data: { isResolved: true, resolvedAt: new Date() } });

    // (2) الإسناد الجديد: «مسند» فيتطلب نموذج مباشرة جديداً قبل التحضير، بإعدادات المقر الجديد
    const created = await tx.placement.create({
      data: {
        studentId: old.studentId,
        termId: old.termId,
        organizationId: toOrg.id,
        fieldSupervisorId: input.toFieldSupervisorId,
        academicSupervisorId: old.academicSupervisorId,
        sectionId: old.sectionId,
        status: "ASSIGNED",
        startDate: effective,
        endDate: old.endDate,
        workDays: old.workDays,
        requiredHours: newRequiredHours,
        shift: old.shift,
      },
    });

    // (3) سجل النقل (Transfer Audit History)
    const transfer = await tx.placementTransfer.create({
      data: {
        studentId: old.studentId,
        fromPlacementId: old.id,
        toPlacementId: created.id,
        fromOrganizationId: old.organizationId,
        toOrganizationId: toOrg.id,
        fromFieldSupervisorId: old.fieldSupervisorId,
        toFieldSupervisorId: input.toFieldSupervisorId,
        reason: input.reason,
        carryOverHours: input.carryOverHours,
        carriedMinutes,
        effectiveDate: effective,
        transferredById: user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "placement.transfer",
        entity: "Placement",
        entityId: old.id,
        meta: { toPlacementId: created.id, fromOrganizationId: old.organizationId, toOrganizationId: toOrg.id, reason: input.reason, carryOverHours: input.carryOverHours, carriedMinutes },
      },
    });

    return { fromPlacementId: old.id, toPlacementId: created.id, transferId: transfer.id };
  });
}

/** سجل عمليات النقل في الفصل الحالي (لعرض «تاريخ النقل» في لوحة رئيسة الوحدة) */
export async function listTransfers(termId: string, limit = 50) {
  const rows = await prisma.placementTransfer.findMany({
    where: { toPlacement: { termId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, reason: true, carryOverHours: true, carriedMinutes: true, effectiveDate: true, createdAt: true,
      student: { select: { universityId: true, user: { select: { fullName: true } } } },
      transferredBy: { select: { fullName: true } },
      fromPlacement: { select: { organization: { select: { name: true } }, fieldSupervisor: { select: { user: { select: { fullName: true } } } } } },
      toPlacement: { select: { id: true, organization: { select: { name: true } }, fieldSupervisor: { select: { user: { select: { fullName: true } } } } } },
    },
  });
  return rows;
}
