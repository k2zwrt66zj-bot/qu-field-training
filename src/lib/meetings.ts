// =====================================================================
//  «سجل الاجتماعات الإشرافية الجماعية» — منطق نقي (بلا قاعدة بيانات)
//  المسار: مسودة (رئيس الاجتماع يُعدّها ويسجّل الحضور، والأمين يكتب المحضر)
//        ← مرفوع بتوقيع أمين الاجتماع ← معتمد بتوقيع رئيس الاجتماع (المشرف الأكاديمي)
// =====================================================================
import { z } from "zod";
import type { DocumentStatus, MeetingAttendanceStatus } from "@prisma/client";
import { countWords } from "./forms/narrative.ts";

export const MEETING_ATTENDANCE_LABELS: Record<MeetingAttendanceStatus, string> = {
  PRESENT: "حاضر",
  ABSENT_EXCUSED: "غياب بعذر",
  ABSENT_UNEXCUSED: "غياب بدون عذر",
};

/** بند ثابت في جدول الأعمال يُطبع آلياً (الدليل الرسمي) */
export const STANDING_AGENDA_ITEM = "ما يستجد من الأعمال.";
export const PREVIOUS_MINUTES_ITEM = "التصديق على محضر الاجتماع السابق.";
/** الحد الأدنى لمحضر الاجتماع: «يتم تسجيل ما تم مناقشته في كل جزئية من جدول الأعمال» */
export const MINUTES_MIN_WORDS = 60;

export type MeetingAction = "SUBMIT" | "APPROVE" | "RETURN";
export const MEETING_ACTION_LABELS: Record<MeetingAction, string> = {
  SUBMIT: "رفع المحضر بتوقيع أمين الاجتماع",
  APPROVE: "اعتماد المحضر بتوقيع رئيس الاجتماع",
  RETURN: "إعادة المحضر للأمين",
};

export const MEETING_STATUS_LABELS: Partial<Record<DocumentStatus, string>> = {
  DRAFT: "قيد الإعداد",
  SUBMITTED: "بانتظار اعتماد رئيس الاجتماع",
  REVIEWED: "معتمد",
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة التاريخ غير صحيحة");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "صيغة الوقت غير صحيحة");
const shortList = z.array(z.string().trim().max(400)).max(20);

/** ما يعدّله رئيس الاجتماع (المشرف الأكاديمي) في المسودة */
export const chairPatchSchema = z
  .object({
    meetingDate: date,
    startTime: time.nullable(),
    durationMinutes: z.number().int().min(10, "المدة 10 دقائق على الأقل").max(480).nullable(),
    location: z.string().trim().max(200).nullable(),
    agendaItems: shortList,
    minutes: z.string().max(30000).nullable(),
    decisions: shortList,
    secretaryPlacementId: z.string().nullable(),
    attendance: z
      .array(z.object({ placementId: z.string(), status: z.enum(["PRESENT", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED"]), excuse: z.string().trim().max(300).nullable().optional() }))
      .max(100),
  })
  .partial()
  .strict();

/** ما يعدّله أمين الاجتماع (أحد المتدربين): المحضر والقرارات فقط */
export const secretaryPatchSchema = chairPatchSchema.pick({ minutes: true, decisions: true }).strict();

export type ChairPatch = z.infer<typeof chairPatchSchema>;

export interface MeetingAttendanceRow {
  placementId: string;
  name: string;
  status: MeetingAttendanceStatus;
  excuse?: string | null;
}

/** «عدد الحضور / عدد الغياب / أسماء الغياب بعذر وبدون عذر» — محسوبة لا مُدخلة */
export function meetingCounts(rows: MeetingAttendanceRow[]) {
  const by = (s: MeetingAttendanceStatus) => rows.filter((r) => r.status === s);
  return {
    present: by("PRESENT").length,
    absent: rows.length - by("PRESENT").length,
    excusedNames: by("ABSENT_EXCUSED").map((r) => (r.excuse ? `${r.name} (${r.excuse})` : r.name)),
    unexcusedNames: by("ABSENT_UNEXCUSED").map((r) => r.name),
  };
}

export interface MeetingForCheck {
  number: number;
  meetingDate: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  location: string | null;
  agendaItems: string[];
  minutes: string | null;
  decisions: string[];
  secretaryPlacementId: string | null;
  attendance: MeetingAttendanceRow[];
}

/** شروط رفع المحضر (تُطبَّق في الخادم وتُعرض في الواجهة كقائمة نواقص) */
export function checkMeetingSubmit(m: MeetingForCheck): string[] {
  const issues: string[] = [];
  if (!m.meetingDate) issues.push("حدد تاريخ الاجتماع");
  if (!m.startTime) issues.push("حدد توقيت الاجتماع");
  if (!m.durationMinutes) issues.push("حدد مدة الاجتماع");
  if (!m.location?.trim()) issues.push("حدد مكان الاجتماع");
  if (!m.attendance.length) issues.push("لا يوجد متدربون في سجل الحضور");
  if (!m.agendaItems.some((a) => a.trim())) issues.push("أضف بنداً واحداً على الأقل إلى جدول الأعمال");
  const words = countWords(m.minutes);
  if (words < MINUTES_MIN_WORDS) issues.push(`محضر الاجتماع ${MINUTES_MIN_WORDS} كلمة على الأقل (الحالي ${words})`);
  if (!m.decisions.some((d) => d.trim())) issues.push("أضف قراراً أو توصية واحدة على الأقل");
  if (!m.secretaryPlacementId) issues.push("حدد أمين الاجتماع من المتدربين");
  else if (m.attendance.find((a) => a.placementId === m.secretaryPlacementId)?.status !== "PRESENT") issues.push("أمين الاجتماع يجب أن يكون من الحاضرين");
  return issues;
}

/** جدول الأعمال كما يُطبع: التصديق على المحضر السابق (عدا الأول) + البنود + ما يستجد */
export function printedAgenda(number: number, items: string[]): string[] {
  return [...(number > 1 ? [PREVIOUS_MINUTES_ITEM] : []), ...items.filter((i) => i.trim()), STANDING_AGENDA_ITEM];
}
