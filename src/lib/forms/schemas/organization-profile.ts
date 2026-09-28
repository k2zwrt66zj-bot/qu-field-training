// 2) تقرير تعريفي بمؤسسة التدريب الميداني
import { z } from "zod";
import { MAX, optInt, optProse, optText, strList, withSubmitRules } from "./helpers.ts";

export const organizationProfileDraft = z.strictObject({
  // أولاً: البيانات الأولية
  organizationName: optText(MAX.short),
  location: optText(),
  contactNumbers: optText(MAX.short),
  workField: optText(MAX.short),
  officialHours: optText(MAX.short),
  trainingDays: optText(MAX.short),
  // ثانياً: الإشراف
  directorName: optText(MAX.short),
  supervisorName: optText(MAX.short),
  supervisorMobile: optText(20),
  // ثالثاً: الأهداف
  goals: optProse(),
  // رابعاً: الهيكل التنظيمي
  socialWorkersCount: optInt(0, 10_000),
  professionals: z
    .array(z.strictObject({ specialty: z.string().trim().max(MAX.short), count: z.number().int().min(0).max(10_000) }))
    .max(30)
    .optional(), // عدد المهنيين من التخصصات الأخرى وتصنيفهم
  beneficiariesCount: optInt(0, 10_000_000),
  policies: optProse(),
  // خامساً: الخدمات
  servicesOffered: optProse(),
  eligibilityConditions: optProse(),
  accessProcedures: optProse(),
  beneficiaryGroups: optProse(),
  // سادساً: العلاقات بالمجتمع الخارجي
  relatedOrganizations: optProse(),
  communityPrograms: optProse(),
  // سابعاً وثامناً
  socialWorkerRoles: strList(20),
  studentNotes: optProse(),
});

export const organizationProfileSubmit = withSubmitRules(organizationProfileDraft, (r) => {
  r.requiredAll([
    ["organizationName", "اسم المؤسسة"], ["location", "مكان المؤسسة"], ["workField", "مجال عمل المؤسسة"],
    ["directorName", "اسم مدير/ة المؤسسة"], ["supervisorName", "اسم مشرف/ة المؤسسة"], ["goals", "أهداف المؤسسة"],
    ["socialWorkersCount", "عدد الأخصائيين الاجتماعيين"], ["beneficiariesCount", "عدد المستفيدين"],
    ["servicesOffered", "الخدمات المقدمة"], ["beneficiaryGroups", "الفئات المستفيدة"],
    ["socialWorkerRoles", "أدوار الأخصائي الاجتماعي بالمؤسسة"],
  ]);
  (r.d.professionals ?? []).forEach((p, i) => r.check(!!p.specialty, ["professionals", i, "specialty"], `المهنيون (صف ${i + 1}): التخصص مطلوب`));
});
