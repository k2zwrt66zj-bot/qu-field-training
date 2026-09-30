// =====================================================================
//  بيانات مؤسس المنصة ومطورها وحقوق الملكية الفكرية
//  مصدر واحد لصفحة «عن المنصة والمطور» وتذييل الصفحات والبيانات الوصفية (metadata)
// =====================================================================

export const DEVELOPER = {
  nameAr: "عبدالملك عواض العتيبي",
  shortNameAr: "عبدالملك العتيبي",
  nameEn: "Abdalmalik Awad Al-Otaibi",
  titleAr: "مؤسس ومطور المنصة",
  titleEn: "Founder & Lead Developer",
  year: 2026,
} as const;

/** نص حقوق الملكية الفكرية (بنصه المعتمد) */
export const IP_NOTICE =
  "هذا النظام مصنف ومحمي. جميع حقوق الملكية الفكرية، التصميم، والكود المصدري محفوظة للمطور عبدالملك عواض العتيبي © 2026";

/** سطر التذييل في أسفل الصفحات */
export const DEVELOPER_CREDIT = "تم التطوير بواسطة عبدالملك العتيبي © 2026";

export interface DeveloperContacts {
  email: string | null;
  linkedin: string | null;
}

/**
 * قنوات التواصل من متغيرات البيئة (على الخادم فقط):
 *   DEVELOPER_EMAIL="name@example.com"
 *   DEVELOPER_LINKEDIN_URL="https://www.linkedin.com/in/…"
 * غير المضبوط منها يظهر زراً معطلاً «يُضاف قريباً» بدل رابط غير صحيح.
 */
export function developerContacts(env: Record<string, string | undefined> = process.env): DeveloperContacts {
  const email = env.DEVELOPER_EMAIL?.trim() ?? "";
  const linkedin = env.DEVELOPER_LINKEDIN_URL?.trim() ?? "";
  return {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    linkedin: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(linkedin) ? linkedin : null,
  };
}
