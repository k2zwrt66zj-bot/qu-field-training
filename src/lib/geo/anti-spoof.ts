// =====================================================================
//  كشف التحضير الوهمي (Fake GPS Detection)
// ---------------------------------------------------------------------
//  لا توجد طريقة مضمونة 100% لكشف تزوير الموقع من متصفح الويب، لذلك
//  يعتمد النظام على "تقييم المخاطر" (Risk Scoring) بعدة مؤشرات مستقلة:
//    - مؤشرات حاسمة  => رفض التحضير مباشرة (REJECTED)
//    - مؤشرات مشبوهة => قبول مع تعليم السجل ورفعه للمراجعة (FLAGGED)
//  وتبقى الكلمة الأخيرة للمشرف الميداني الذي يعتمد الحضور يومياً.
// =====================================================================

import { haversineMeters, samplesSpread, type LatLng } from "./geofence.ts";

export interface PositionSample extends LatLng {
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number; // ms - من الجهاز
}

export interface SpoofCheckInput {
  samples: PositionSample[]; // عينات متتالية جمعها العميل (3-5 خلال ~10 ثوانٍ)
  serverNow: number; // ms
  isMockedByOS?: boolean; // من غلاف أصلي (Capacitor) إن وُجد
  deviceId?: string | null;
  registeredDeviceId?: string | null;
  enforceDeviceBinding?: boolean;
  previous?: { latitude: number; longitude: number; at: number } | null; // آخر محاولة مقبولة
  maxAccuracy?: number;
  maxPositionAgeSec?: number;
}

export type RiskFlag =
  | "OS_MOCK_LOCATION"
  | "NO_SAMPLES"
  | "LOW_ACCURACY"
  | "IMPOSSIBLE_ACCURACY"
  | "STALE_POSITION"
  | "FUTURE_TIMESTAMP"
  | "ZERO_JITTER"
  | "SAMPLE_JUMP"
  | "IMPOSSIBLE_TRAVEL"
  | "LOW_PRECISION_COORDS"
  | "DEVICE_MISMATCH"
  | "NULL_ISLAND";

export const RISK_FLAG_LABELS: Record<RiskFlag, string> = {
  OS_MOCK_LOCATION: "نظام الجهاز أبلغ عن موقع وهمي",
  NO_SAMPLES: "لا توجد قراءات موقع",
  LOW_ACCURACY: "دقة الموقع ضعيفة جداً",
  IMPOSSIBLE_ACCURACY: "دقة غير واقعية (نمط تطبيقات التزييف)",
  STALE_POSITION: "قراءة موقع قديمة",
  FUTURE_TIMESTAMP: "توقيت الجهاز غير متطابق مع الخادم",
  ZERO_JITTER: "إحداثيات ثابتة تماماً بين القراءات",
  SAMPLE_JUMP: "قفزات غير طبيعية بين القراءات",
  IMPOSSIBLE_TRAVEL: "سرعة انتقال مستحيلة منذ آخر تحضير",
  LOW_PRECISION_COORDS: "إحداثيات منخفضة الدقة (مُدخلة يدوياً)",
  DEVICE_MISMATCH: "جهاز مختلف عن الجهاز المسجَّل",
  NULL_ISLAND: "إحداثيات صفرية",
};

const WEIGHTS: Record<RiskFlag, number> = {
  OS_MOCK_LOCATION: 100,
  NO_SAMPLES: 100,
  NULL_ISLAND: 100,
  LOW_ACCURACY: 100, // رفض: لا يمكن التحقق من النطاق
  STALE_POSITION: 100,
  FUTURE_TIMESTAMP: 60,
  IMPOSSIBLE_TRAVEL: 70,
  // كل مؤشر منفرداً => مراجعة، واجتماعهما (نمط تطبيقات التزييف) => رفض
  IMPOSSIBLE_ACCURACY: 40,
  ZERO_JITTER: 40,
  SAMPLE_JUMP: 30,
  LOW_PRECISION_COORDS: 40,
  DEVICE_MISMATCH: 45,
};

/** المؤشرات التي تؤدي إلى الرفض الفوري بغض النظر عن المجموع */
const HARD_FLAGS: RiskFlag[] = ["OS_MOCK_LOCATION", "NO_SAMPLES", "NULL_ISLAND", "LOW_ACCURACY", "STALE_POSITION"];

export interface SpoofCheckResult {
  riskScore: number; // 0 - 100
  flags: RiskFlag[];
  verdict: "ACCEPTED" | "FLAGGED" | "REJECTED";
  best: PositionSample | null; // أدق قراءة
  spread: number;
}

function decimals(n: number): number {
  const s = n.toString();
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

export function assessLocationRisk(input: SpoofCheckInput): SpoofCheckResult {
  const maxAccuracy = input.maxAccuracy ?? 100;
  const maxAgeMs = (input.maxPositionAgeSec ?? 120) * 1000;
  const flags = new Set<RiskFlag>();
  const samples = input.samples.filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));

  if (input.isMockedByOS) flags.add("OS_MOCK_LOCATION");
  if (samples.length === 0) {
    flags.add("NO_SAMPLES");
    return finalize(flags, null, 0);
  }

  const best = [...samples].sort((a, b) => a.accuracy - b.accuracy)[0];

  if (Math.abs(best.latitude) < 0.01 && Math.abs(best.longitude) < 0.01) flags.add("NULL_ISLAND");

  // 1) الدقة
  if (!(best.accuracy > 0) || best.accuracy > maxAccuracy) {
    flags.add("LOW_ACCURACY");
  }
  // تطبيقات التزييف كثيراً ما تُرجع دقة 0 أو 1 أو قيمة صحيحة ثابتة
  if (samples.every((s) => s.accuracy <= 1) || (samples.length >= 3 && samples.every((s) => s.accuracy === samples[0].accuracy && Number.isInteger(s.accuracy) && s.accuracy <= 5))) {
    flags.add("IMPOSSIBLE_ACCURACY");
  }

  // 2) التوقيت
  const newest = Math.max(...samples.map((s) => s.timestamp));
  if (input.serverNow - newest > maxAgeMs) flags.add("STALE_POSITION");
  if (newest - input.serverNow > 60_000) flags.add("FUTURE_TIMESTAMP");

  // 3) التذبذب الطبيعي: GPS الحقيقي يتذبذب ولو قليلاً بين القراءات
  const spread = samplesSpread(samples);
  if (samples.length >= 3 && spread === 0) flags.add("ZERO_JITTER");
  // قفزات بين العينات أكبر بكثير من الدقة المعلنة خلال ثوانٍ
  if (samples.length >= 2 && spread > Math.max(150, best.accuracy * 4)) flags.add("SAMPLE_JUMP");

  // 4) دقة الإحداثيات: GPS يعطي عادة 6 منازل عشرية أو أكثر
  if (decimals(best.latitude) < 4 || decimals(best.longitude) < 4) flags.add("LOW_PRECISION_COORDS");

  // 5) السفر المستحيل منذ آخر محاولة مقبولة
  if (input.previous) {
    const meters = haversineMeters(input.previous, best);
    const hours = Math.max((input.serverNow - input.previous.at) / 3_600_000, 1 / 3600);
    const kmh = meters / 1000 / hours;
    if (meters > 2_000 && kmh > 200) flags.add("IMPOSSIBLE_TRAVEL");
  }

  // 6) ربط الجهاز
  if (input.enforceDeviceBinding && input.registeredDeviceId && input.deviceId && input.deviceId !== input.registeredDeviceId) {
    flags.add("DEVICE_MISMATCH");
  }

  return finalize(flags, best, spread);
}

function finalize(flags: Set<RiskFlag>, best: PositionSample | null, spread: number): SpoofCheckResult {
  const list = [...flags];
  const riskScore = Math.min(100, list.reduce((sum, f) => sum + WEIGHTS[f], 0));
  let verdict: SpoofCheckResult["verdict"] = "ACCEPTED";
  if (list.some((f) => HARD_FLAGS.includes(f)) || riskScore >= 80) verdict = "REJECTED";
  else if (riskScore >= 30) verdict = "FLAGGED";
  return { riskScore, flags: list, verdict, best, spread };
}
