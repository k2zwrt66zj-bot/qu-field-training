import { z } from "zod";

export const ORG_CATEGORIES = [
  "MEDICAL", "ORPHAN_CARE", "ELDERLY_CARE", "DISABILITY_CARE", "SCHOOL", "CHARITY", "FAMILY_COUNSELING",
  "JUVENILE_CARE", "PRISON_CARE", "ADDICTION_RECOVERY", "RESEARCH_CENTER", "GOVERNMENT", "OTHER",
] as const;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "صيغة الوقت HH:mm");
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

/** مخطط بيانات جهة التدريب — مشترك بين الواجهة والخادم */
export const organizationSchema = z
  .object({
    name: z.string().trim().min(3, "اسم الجهة قصير جداً").max(200),
    category: z.enum(ORG_CATEGORIES),
    city: z.string().trim().min(2, "المدينة مطلوبة").max(60),
    address: optionalText(300),
    // نطاق المملكة العربية السعودية تقريباً لمنع الأخطاء الشائعة (مثل تبديل خط الطول بالعرض)
    latitude: z.number().min(16, "خط العرض خارج نطاق المملكة").max(33, "خط العرض خارج نطاق المملكة"),
    longitude: z.number().min(34, "خط الطول خارج نطاق المملكة").max(56, "خط الطول خارج نطاق المملكة"),
    geofenceRadius: z.number().int().min(30, "أقل نطاق 30 م").max(1000, "أكبر نطاق 1000 م"),
    genderScope: z.enum(["MALE_ONLY", "FEMALE_ONLY", "BOTH"]),
    acceptedMajors: z.array(z.enum(["SOCIOLOGY", "SOCIAL_WORK"])).max(2),
    capacityMale: z.number().int().min(0).max(200),
    capacityFemale: z.number().int().min(0).max(200),
    contactName: optionalText(120),
    contactTitle: optionalText(60),
    contactPhone: optionalText(20),
    contactEmail: z
      .string()
      .trim()
      .email("بريد غير صحيح")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    workStartTime: hhmm,
    workEndTime: hhmm,
    isApproved: z.boolean(),
    notes: optionalText(2000),
  })
  .refine((o) => o.workStartTime < o.workEndTime, { message: "وقت نهاية الدوام يجب أن يكون بعد بدايته", path: ["workEndTime"] })
  .refine((o) => o.genderScope !== "MALE_ONLY" || o.capacityFemale === 0, { message: "الجهة للطلاب فقط: اجعل طاقة الطالبات صفراً", path: ["capacityFemale"] })
  .refine((o) => o.genderScope !== "FEMALE_ONLY" || o.capacityMale === 0, { message: "الجهة للطالبات فقط: اجعل طاقة الطلاب صفراً", path: ["capacityMale"] });

export type OrganizationInput = z.input<typeof organizationSchema>;
