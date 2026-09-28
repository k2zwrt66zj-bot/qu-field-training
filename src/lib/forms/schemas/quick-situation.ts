// 7-8) تسجيل الموقف السريع — المدرسة / المستشفى
import { z } from "zod";
import { MAX, optDate, optEnum, optProse, optText, withSubmitRules } from "./helpers.ts";

const common = {
  situationDate: optDate(), // اليوم والتاريخ
  subjectName: optText(MAX.short), // اختياري في النموذج الرسمي (يُفضَّل اسم رمزي)
  referralSource: optText(MAX.short), // مصدر التحويل
  summary: optProse(), // ملخص الموقف
  actionsTaken: optProse(), // الإجراءات المتخذة
};

export const schoolSituationDraft = z.strictObject({ ...common, schoolGrade: optText(60) });
export const medicalSituationDraft = z.strictObject({
  ...common,
  medicalFileNumber: optText(40),
  medicalVisitType: optEnum(["FIRST_VISIT", "INPATIENT", "SURGERY", "FOLLOW_UP", "FAMILY_MEMBER"] as const),
  hospitalDepartment: optText(MAX.short), // القسم التابع له الحالة
});

const commonReq = [["situationDate", "التاريخ"], ["referralSource", "مصدر التحويل"], ["summary", "ملخص الموقف"], ["actionsTaken", "الإجراءات المتخذة"]] as const;

export const schoolSituationSubmit = withSubmitRules(schoolSituationDraft, (r) => r.requiredAll([...commonReq, ["schoolGrade", "الصف الدراسي"]]));
export const medicalSituationSubmit = withSubmitRules(medicalSituationDraft, (r) =>
  r.requiredAll([...commonReq, ["medicalVisitType", "نوع المراجع"], ["hospitalDepartment", "القسم التابع له الحالة"]])
);
