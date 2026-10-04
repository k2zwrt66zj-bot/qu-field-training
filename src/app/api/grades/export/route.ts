import { handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { MAJOR_LABELS } from "@/lib/labels";
import { LETTER_GRADE_AR } from "@/lib/grading/engine";
import { toNum } from "@/lib/utils";

/** GET /api/grades/export?termId=&status=APPROVED — كشف الدرجات المعتمد (CSV متوافق مع Excel العربي) */
export const GET = handler(async (req: Request) => {
  await requireRole("TRAINING_HEAD", "DEPARTMENT_HEAD");
  const url = new URL(req.url);
  const termId = url.searchParams.get("termId") ?? undefined;
  const onlyApproved = url.searchParams.get("status") !== "ALL";

  const rows = await prisma.finalGrade.findMany({
    where: { placement: { termId }, ...(onlyApproved ? { status: { in: ["APPROVED", "PUBLISHED"] } } : {}) },
    include: { placement: { include: { student: { include: { user: true } }, organization: true, term: true, section: { select: { mode: true } } } } },
    orderBy: { placement: { student: { universityId: "asc" } } },
  });

  // الأوزان من الفصل؛ طلاب المحاكاة: المكوّن الميداني «لا ينطبق» ووزنه ضمن الأكاديمي
  const w = rows[0]?.placement.term ?? { fieldWeight: 40, academicWeight: 40, attendanceWeight: 20 };
  const header = ["م", "الرقم الجامعي", "اسم الطالب/ة", "التخصص", "نوع التدريب", "جهة التدريب", `المشرف المؤسسي (${w.fieldWeight})`, `المشرف الأكاديمي (${w.academicWeight}، وللمحاكاة ${w.academicWeight + w.fieldWeight})`, `التحضير والسجلات (${w.attendanceWeight})`, "المجموع (100)", "التقدير", "الحالة"];
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((g, i) =>
    [
      i + 1,
      g.placement.student.universityId,
      g.placement.student.user.fullName,
      MAJOR_LABELS[g.placement.student.major],
      g.placement.section?.mode === "SIMULATION" ? "بالمحاكاة" : "ميداني",
      g.placement.organization.name,
      g.placement.section?.mode === "SIMULATION" ? "لا ينطبق" : toNum(g.fieldComponent),
      toNum(g.academicComponent),
      toNum(g.attendanceComponent),
      toNum(g.total),
      `${g.letterGrade} - ${LETTER_GRADE_AR[g.letterGrade] ?? ""}`,
      g.status === "CALCULATED" ? "غير معتمدة" : "معتمدة",
    ].map(q).join(",")
  );
  const csv = "﻿" + [header.map(q).join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="grades-${termId ?? "all"}.csv"`,
    },
  });
});
