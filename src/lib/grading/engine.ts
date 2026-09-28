// =====================================================================
//  محرك احتساب الدرجة النهائية للتدريب الميداني
//  الافتراضي: 40% المشرف الميداني + 40% المشرف الأكاديمي + 20% التحضير والسجلات
//  (الأوزان مخزنة في AcademicTerm ويمكن تعديلها لكل فصل)
// =====================================================================

export interface GradeWeights {
  fieldWeight: number;
  academicWeight: number;
  attendanceWeight: number;
}

export interface GradeInput {
  weights: GradeWeights;
  fieldPercentage: number | null; // نسبة تقييم المشرف الميداني 0-100
  academicPercentage: number | null; // نسبة تقييم المشرف الأكاديمي 0-100
  approvedMinutes: number; // دقائق الحضور المعتمدة
  requiredHours: number;
  expectedWeeklyLogbooks: number; // عدد السجلات الأسبوعية المتوقعة حتى تاريخه
  submittedWeeklyLogbooks: number; // المرفوعة (مرفوعة أو موقعة أو مراجعة)
  unexcusedAbsences: number;
}

export interface GradeBreakdown {
  fieldComponent: number;
  academicComponent: number;
  attendanceComponent: number;
  total: number;
  letterGrade: string;
  passed: boolean;
  details: {
    hoursCompleted: number;
    hoursRatio: number;
    logbookRatio: number;
    absencePenalty: number;
    missing: string[];
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** سلم التقديرات المعتمد في الجامعات السعودية */
export function toLetterGrade(total: number): string {
  if (total >= 95) return "A+";
  if (total >= 90) return "A";
  if (total >= 85) return "B+";
  if (total >= 80) return "B";
  if (total >= 75) return "C+";
  if (total >= 70) return "C";
  if (total >= 65) return "D+";
  if (total >= 60) return "D";
  return "F";
}

export const LETTER_GRADE_AR: Record<string, string> = {
  "A+": "ممتاز مرتفع",
  A: "ممتاز",
  "B+": "جيد جداً مرتفع",
  B: "جيد جداً",
  "C+": "جيد مرتفع",
  C: "جيد",
  "D+": "مقبول مرتفع",
  D: "مقبول",
  F: "راسب",
};

export function validateWeights(w: GradeWeights): void {
  const sum = w.fieldWeight + w.academicWeight + w.attendanceWeight;
  if (sum !== 100) throw new Error(`مجموع الأوزان يجب أن يساوي 100 (الحالي ${sum})`);
}

/**
 * مكون "التحضير والسجلات" (20 درجة افتراضياً):
 *   - 50% نسبة إنجاز الساعات المطلوبة
 *   - 50% نسبة رفع السجلات الأسبوعية
 *   - خصم 1 درجة عن كل غياب بدون عذر (بحد أقصى نصف المكون)
 */
export function calculateFinalGrade(input: GradeInput): GradeBreakdown {
  validateWeights(input.weights);
  const { weights } = input;
  const missing: string[] = [];

  if (input.fieldPercentage == null) missing.push("تقييم المشرف الميداني");
  if (input.academicPercentage == null) missing.push("تقييم المشرف الأكاديمي");

  const fieldComponent = round2(((input.fieldPercentage ?? 0) / 100) * weights.fieldWeight);
  const academicComponent = round2(((input.academicPercentage ?? 0) / 100) * weights.academicWeight);

  const hoursCompleted = round2(input.approvedMinutes / 60);
  const hoursRatio = input.requiredHours > 0 ? clamp01(hoursCompleted / input.requiredHours) : 0;
  const logbookRatio =
    input.expectedWeeklyLogbooks > 0 ? clamp01(input.submittedWeeklyLogbooks / input.expectedWeeklyLogbooks) : 1;
  const absencePenalty = Math.min(input.unexcusedAbsences * 1, weights.attendanceWeight / 2);
  const attendanceComponent = round2(
    Math.max(0, (hoursRatio * 0.5 + logbookRatio * 0.5) * weights.attendanceWeight - absencePenalty)
  );

  const total = round2(fieldComponent + academicComponent + attendanceComponent);
  return {
    fieldComponent,
    academicComponent,
    attendanceComponent,
    total,
    letterGrade: toLetterGrade(total),
    passed: total >= 60 && missing.length === 0,
    details: { hoursCompleted, hoursRatio: round2(hoursRatio), logbookRatio: round2(logbookRatio), absencePenalty, missing },
  };
}

/** يحسب نسبة التقييم من بنود الاستمارة */
export function scoreEvaluation(items: { score: number; maxScore: number }[]) {
  const raw = items.reduce((s, i) => s + i.score, 0);
  const max = items.reduce((s, i) => s + i.maxScore, 0);
  for (const i of items) {
    if (i.score < 0 || i.score > i.maxScore) throw new Error("درجة البند خارج النطاق المسموح");
  }
  return { raw: round2(raw), max, percentage: max > 0 ? round2((raw / max) * 100) : 0 };
}
