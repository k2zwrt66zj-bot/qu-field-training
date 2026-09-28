// 11) نموذج القراءات — توثيق APA
import { z } from "zod";
import { MAX, NARRATIVE_RULES, optDate, optEnum, optInt, optProse, optText, withSubmitRules } from "./helpers.ts";

export const readingDraft = z.strictObject({
  sourceType: optEnum(["BOOK_CHAPTER", "JOURNAL_ARTICLE", "CONFERENCE_PAPER"] as const),
  readingDate: optDate(),
  authors: z.array(z.string().trim().max(MAX.short)).max(25).transform((a) => a.filter(Boolean)).optional(),
  publicationYear: optInt(1900, 2100),
  title: optText(MAX.line),
  containerTitle: optText(MAX.line),
  editors: optText(MAX.line),
  volume: optText(20),
  issue: optText(20),
  pages: optText(30),
  publisher: optText(MAX.short),
  doi: optText(MAX.short),
  url: z.string().trim().url("رابط غير صحيح").max(MAX.line).optional().nullable().or(z.literal("")),
  apaCitation: optText(2000), // اختياري: يُولَّد آلياً إن تُرك فارغاً
  purpose: optProse(),
  professionalBenefit: optProse(),
});

export const readingSubmit = withSubmitRules(readingDraft, (r) => {
  const d = r.d;
  r.requiredAll([
    ["sourceType", "نوع المصدر"], ["readingDate", "تاريخ القراءة"], ["authors", "المؤلفون"], ["publicationYear", "سنة النشر"],
    ["title", "العنوان"], ["containerTitle", "المجلة / الكتاب / المؤتمر"],
  ])
    .narrative("purpose", "الهدف من القراءة", NARRATIVE_RULES.readingPurpose)
    .narrative("professionalBenefit", "الفوائد المهنية المستخلصة", NARRATIVE_RULES.readingBenefit);
  if (d.sourceType === "JOURNAL_ARTICLE") r.required("volume", "رقم المجلد");
  if (d.sourceType === "BOOK_CHAPTER") r.requiredAll([["pages", "صفحات الفصل"], ["publisher", "الناشر"]]);
  if (d.doi) r.check(/10\.\d{4,9}\/\S+/.test(d.doi), ["doi"], "صيغة DOI غير صحيحة (مثال: 10.1093/hsw/hlad001)");
});
