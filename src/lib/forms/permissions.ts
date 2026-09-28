// =====================================================================
//  صلاحيات النماذج (نقية): من يحق له ماذا، حسب الدور والعلاقة بالإسناد وحالة النموذج
// =====================================================================
import type { DocumentStatus, Role } from "@prisma/client";
import type { FormPolicy } from "./catalog.ts";
import { isEditableStatus, nextState, type FormAction } from "./workflow.ts";

export type FormPermission = "VIEW" | "EDIT" | "DELETE" | "COMMENT" | "UPLOAD" | "EXPORT" | FormAction;

export interface Actor {
  role: Role;
  /** الطالب صاحب الإسناد */
  isOwner: boolean;
  /** المشرف المؤسسي المسند لهذا الإسناد */
  isFieldSupervisor: boolean;
  /** المشرف الأكاديمي المسند لهذا الإسناد */
  isAcademicSupervisor: boolean;
}

export interface FormState {
  status: DocumentStatus;
  locked: boolean;
  everSubmitted: boolean;
}

const HEADS: Role[] = ["TRAINING_HEAD", "DEPARTMENT_HEAD", "ADMIN"];

export function can(actor: Actor, policy: FormPolicy, form: FormState, perm: FormPermission): boolean {
  const isDraft = form.status === "DRAFT";
  const fieldInvolved = actor.isFieldSupervisor && policy.fieldApproval;
  const viewer =
    actor.isOwner ||
    (!isDraft && (fieldInvolved || actor.isAcademicSupervisor || HEADS.includes(actor.role)));

  switch (perm) {
    case "VIEW":
    case "EXPORT":
      return viewer;
    case "EDIT":
      if (form.locked) return false;
      if (actor.isOwner) return isEditableStatus(form.status);
      return fieldInvolved && policy.fieldCanEditWhileSubmitted && form.status === "SUBMITTED";
    case "UPLOAD":
      return !form.locked && actor.isOwner && isEditableStatus(form.status);
    case "DELETE":
      return actor.isOwner && isDraft && !form.everSubmitted;
    case "COMMENT":
      // رئيس القسم قراءة فقط
      return viewer && !isDraft && actor.role !== "DEPARTMENT_HEAD";
    case "SUBMIT":
      return actor.isOwner && nextState(policy, form.status, perm, form).ok;
    case "FIELD_SIGN":
    case "FIELD_RETURN":
      return fieldInvolved && nextState(policy, form.status, perm, form).ok;
    case "ACADEMIC_APPROVE":
    case "ACADEMIC_RETURN":
      return actor.isAcademicSupervisor && nextState(policy, form.status, perm, form).ok;
  }
}

export const ALL_PERMISSIONS: FormPermission[] = [
  "VIEW", "EDIT", "DELETE", "COMMENT", "UPLOAD", "EXPORT", "SUBMIT", "FIELD_SIGN", "FIELD_RETURN", "ACADEMIC_APPROVE", "ACADEMIC_RETURN",
];

/** قائمة ما يُسمح للمستخدم به — تُرسل للواجهة لإظهار الأزرار المناسبة فقط */
export const allowedActions = (actor: Actor, policy: FormPolicy, form: FormState) => ALL_PERMISSIONS.filter((p) => can(actor, policy, form, p));
