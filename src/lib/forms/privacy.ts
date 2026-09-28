// إخفاء البيانات الحساسة حسب المشاهد (نظام حماية البيانات الشخصية)
// القرار الافتراضي: رقم الملف الطبي كاملاً للطالب والمشرف المؤسسي (من موظفي المنشأة الصحية) فقط.

export function maskIdentifier(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const v = value.trim();
  if (v.length <= 3) return "•".repeat(v.length);
  return `${"•".repeat(Math.max(3, v.length - 3))}${v.slice(-3)}`;
}

export interface PrivacyViewer {
  isOwner: boolean;
  isFieldSupervisor: boolean;
}

/** يطبق الإخفاء على بيانات النموذج المُسلسلة قبل إرسالها */
export function applyPrivacy<T extends Record<string, unknown>>(kind: string, data: T, viewer: PrivacyViewer): T {
  if (kind === "QUICK_SITUATION" && "medicalFileNumber" in data && !(viewer.isOwner || viewer.isFieldSupervisor)) {
    return { ...data, medicalFileNumber: maskIdentifier(data.medicalFileNumber as string | null) };
  }
  return data;
}
