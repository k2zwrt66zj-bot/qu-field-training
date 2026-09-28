// إخفاء البيانات الحساسة حسب المشاهد (نظام حماية البيانات الشخصية)
// قرار القسم: رقم الملف الطبي يظهر كاملاً للطالب، والمشرف المؤسسي، والمشرف الأكاديمي المسؤول عن الطالب فقط؛
// ويُحجب عن غيرهم (رئيس الوحدة، رئيس القسم، مدير النظام).

export function maskIdentifier(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const v = value.trim();
  if (v.length <= 3) return "•".repeat(v.length);
  return `${"•".repeat(Math.max(3, v.length - 3))}${v.slice(-3)}`;
}

export interface PrivacyViewer {
  isOwner: boolean;
  isFieldSupervisor: boolean;
  isAcademicSupervisor: boolean;
}

/** المخوَّلون برؤية البيانات الصحية التعريفية كاملة */
export const mayViewHealthIdentifiers = (v: PrivacyViewer) => v.isOwner || v.isFieldSupervisor || v.isAcademicSupervisor;

/** يطبق الإخفاء على بيانات النموذج المُسلسلة قبل إرسالها */
export function applyPrivacy<T extends Record<string, unknown>>(kind: string, data: T, viewer: PrivacyViewer): T {
  if (kind === "QUICK_SITUATION" && "medicalFileNumber" in data && !mayViewHealthIdentifiers(viewer)) {
    return { ...data, medicalFileNumber: maskIdentifier(data.medicalFileNumber as string | null) };
  }
  return data;
}
