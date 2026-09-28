// اختبارات وحدة المرحلة 4: الاجتماعات الإشرافية الجماعية وبصمة كشف الحضور اليومي
import { test } from "node:test";
import assert from "node:assert/strict";
import { chairPatchSchema, checkMeetingSubmit, meetingCounts, printedAgenda, secretaryPatchSchema, STANDING_AGENDA_ITEM, PREVIOUS_MINUTES_ITEM } from "../src/lib/meetings.ts";
import { sheetRecordsHash } from "../src/lib/attendance-sheet.ts";

const words = (n: number) => Array.from({ length: n }, (_, i) => `كلمة${i}`).join(" ");
const rows = [
  { placementId: "p1", name: "أحمد", status: "PRESENT" as const },
  { placementId: "p2", name: "خالد", status: "ABSENT_EXCUSED" as const, excuse: "مراجعة طبية" },
  { placementId: "p3", name: "سعد", status: "ABSENT_UNEXCUSED" as const },
  { placementId: "p4", name: "فهد", status: "PRESENT" as const },
];
const complete = {
  number: 2, meetingDate: "2026-09-20", startTime: "10:00", durationMinutes: 60, location: "قاعة المؤسسة",
  agendaItems: ["مناقشة دراسات الحالة"], minutes: words(70), decisions: ["رفع الخطة الأسبوعية"], secretaryPlacementId: "p1", attendance: rows,
};

test("meetings: أعداد الحضور والغياب وأسماؤه محسوبة من السجل", () => {
  const c = meetingCounts(rows);
  assert.equal(c.present, 2);
  assert.equal(c.absent, 2);
  assert.deepEqual(c.excusedNames, ["خالد (مراجعة طبية)"]);
  assert.deepEqual(c.unexcusedNames, ["سعد"]);
});

test("meetings: جدول الأعمال المطبوع (التصديق عدا الأول + ما يستجد)", () => {
  assert.deepEqual(printedAgenda(1, ["أ", " "]), ["أ", STANDING_AGENDA_ITEM]);
  assert.deepEqual(printedAgenda(3, ["أ"]), [PREVIOUS_MINUTES_ITEM, "أ", STANDING_AGENDA_ITEM]);
});

test("meetings: شروط رفع المحضر", () => {
  assert.deepEqual(checkMeetingSubmit(complete), []);
  const issues = checkMeetingSubmit({ ...complete, minutes: words(10), decisions: [], location: " ", secretaryPlacementId: null });
  assert.ok(issues.some((i) => i.includes("محضر الاجتماع")));
  assert.ok(issues.some((i) => i.includes("قراراً")));
  assert.ok(issues.some((i) => i.includes("مكان")));
  assert.ok(issues.some((i) => i.includes("أمين الاجتماع")));
  assert.ok(checkMeetingSubmit({ ...complete, secretaryPlacementId: "p3" }).some((i) => i.includes("من الحاضرين")), "الأمين الغائب مرفوض");
});

test("meetings: الأمين يعدّل المحضر والقرارات فقط", () => {
  assert.equal(secretaryPatchSchema.safeParse({ minutes: "نص", decisions: ["ق"] }).success, true);
  assert.equal(secretaryPatchSchema.safeParse({ location: "x" }).success, false);
  assert.equal(secretaryPatchSchema.safeParse({ attendance: [] }).success, false);
  assert.equal(chairPatchSchema.safeParse({ startTime: "25:00" }).success, false);
  assert.equal(chairPatchSchema.safeParse({ startTime: "09:30", durationMinutes: 45 }).success, true);
});

test("attendance sheet: البصمة ثابتة للترتيب وتتغير بأي تعديل في الأوقات أو الحالة", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 8, 20, h));
  const base = [
    { placementId: "b", record: { status: "PRESENT", checkInAt: at(5), checkOutAt: at(10), workedMinutes: 300 } },
    { placementId: "a", record: { status: "ABSENT", checkInAt: null, checkOutAt: null, workedMinutes: 0 } },
  ];
  const h = sheetRecordsHash(base);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(sheetRecordsHash([...base].reverse()), h, "مستقلة عن الترتيب");
  assert.notEqual(sheetRecordsHash([base[0], { placementId: "a", record: { ...base[1].record, status: "EXCUSED" } }]), h, "تغيير الحالة");
  assert.notEqual(sheetRecordsHash([{ placementId: "b", record: { ...base[0].record, checkOutAt: at(11) } }, base[1]]), h, "تغيير الانصراف");
  assert.notEqual(sheetRecordsHash([base[0], { placementId: "a", record: null }]), h, "حذف سجل");
});
