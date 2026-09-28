// 1) مباشرة الطالب/ـة لمؤسسة التدريب الميداني
import { z } from "zod";
import { optBool, optDate, optEnum, optInt, withSubmitRules } from "./helpers.ts";

export const commencementDraft = z.strictObject({
  commencementDate: optDate(), // تاريخ المباشرة
  fixedTrainingDay: optInt(0, 4), // يوم التدريب الثابت: 0 الأحد … 4 الخميس
  shift: optEnum(["MORNING", "EVENING"] as const), // فترة صباحية / مسائية
  declarationAccepted: optBool(), // «أقر أنا الطالب/ـة المذكور أعلاه بأنني باشرت التدريب…»
});

export const commencementSubmit = withSubmitRules(commencementDraft, (r) =>
  r
    .requiredAll([["commencementDate", "تاريخ المباشرة"], ["fixedTrainingDay", "يوم التدريب الثابت"], ["shift", "فترة التدريب"]])
    .isTrue("declarationAccepted", "يجب الإقرار بمباشرة التدريب وفق خطاب القسم")
);
