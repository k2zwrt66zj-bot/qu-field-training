import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGeofence, haversineMeters } from "../src/lib/geo/geofence.ts";
import { assessLocationRisk, type PositionSample } from "../src/lib/geo/anti-spoof.ts";
import { calculateFinalGrade, scoreEvaluation, toLetterGrade } from "../src/lib/grading/engine.ts";

const ORG = { latitude: 26.347812, longitude: 43.766934 };
const now = Date.now();
const real = (dLat = 0, acc = 12.7, t = now - 2000): PositionSample => ({
  latitude: ORG.latitude + dLat + Math.random() * 0.00002,
  longitude: ORG.longitude + Math.random() * 0.00002,
  accuracy: acc,
  timestamp: t,
});

test("haversine: ~111 m لكل 0.001 درجة عرض", () => {
  const d = haversineMeters(ORG, { ...ORG, latitude: ORG.latitude + 0.001 });
  assert.ok(d > 110 && d < 112, `d=${d}`);
});

test("geofence: داخل 100م وخارجها", () => {
  assert.equal(checkGeofence({ ...ORG, latitude: ORG.latitude + 0.0005 }, ORG, 100, 10).inside, true); // ~55م
  assert.equal(checkGeofence({ ...ORG, latitude: ORG.latitude + 0.002 }, ORG, 100, 10).inside, false); // ~222م
  // الهامش لا يتجاوز 25م حتى لو كانت الدقة 80م
  assert.equal(checkGeofence({ ...ORG, latitude: ORG.latitude + 0.0012 }, ORG, 100, 80).inside, false); // ~133م
});

test("anti-spoof: قراءات حقيقية مقبولة", () => {
  const r = assessLocationRisk({ samples: [real(), real(), real()], serverNow: now });
  assert.equal(r.verdict, "ACCEPTED", JSON.stringify(r.flags));
});

test("anti-spoof: إحداثيات ثابتة + دقة مثالية => رفض", () => {
  const s = { ...ORG, accuracy: 1, timestamp: now - 1000 };
  const r = assessLocationRisk({ samples: [s, s, s], serverNow: now });
  assert.ok(r.flags.includes("ZERO_JITTER") && r.flags.includes("IMPOSSIBLE_ACCURACY"));
  assert.equal(r.verdict, "REJECTED");
});

test("anti-spoof: إحداثيات ثابتة فقط (دقة طبيعية) => مراجعة لا رفض", () => {
  const s = { ...ORG, accuracy: 11.3, timestamp: now - 1000 };
  const r = assessLocationRisk({ samples: [s, s, s], serverNow: now });
  assert.equal(r.verdict, "FLAGGED");
});

test("anti-spoof: موقع وهمي من النظام => رفض", () => {
  const r = assessLocationRisk({ samples: [real()], serverNow: now, isMockedByOS: true });
  assert.equal(r.verdict, "REJECTED");
});

test("anti-spoof: قراءة قديمة => رفض", () => {
  const r = assessLocationRisk({ samples: [real(0, 10, now - 10 * 60_000)], serverNow: now });
  assert.equal(r.verdict, "REJECTED");
});

test("anti-spoof: سفر مستحيل (الرياض -> بريدة في 5 دقائق)", () => {
  const r = assessLocationRisk({
    samples: [real(), real(), real()],
    serverNow: now,
    previous: { latitude: 24.7136, longitude: 46.6753, at: now - 5 * 60_000 },
  });
  assert.ok(r.flags.includes("IMPOSSIBLE_TRAVEL"));
  assert.notEqual(r.verdict, "ACCEPTED");
});

test("grading: 40/40/20", () => {
  const g = calculateFinalGrade({
    weights: { fieldWeight: 40, academicWeight: 40, attendanceWeight: 20 },
    fieldPercentage: 90,
    academicPercentage: 85,
    approvedMinutes: 120 * 60,
    requiredHours: 120,
    expectedWeeklyLogbooks: 10,
    submittedWeeklyLogbooks: 8,
    unexcusedAbsences: 1,
  });
  // 36 + 34 + (0.5*1 + 0.5*0.8)*20 - 1 = 36 + 34 + 17 = 87
  assert.equal(g.total, 87);
  assert.equal(g.letterGrade, "B+");
  assert.equal(g.passed, true);
});

test("grading: الأوزان يجب أن تساوي 100", () => {
  assert.throws(() =>
    calculateFinalGrade({
      weights: { fieldWeight: 50, academicWeight: 40, attendanceWeight: 20 },
      fieldPercentage: 1, academicPercentage: 1, approvedMinutes: 0, requiredHours: 1,
      expectedWeeklyLogbooks: 0, submittedWeeklyLogbooks: 0, unexcusedAbsences: 0,
    })
  );
});

test("evaluation scoring + letter grades", () => {
  assert.deepEqual(scoreEvaluation([{ score: 8, maxScore: 10 }, { score: 4.5, maxScore: 5 }]), { raw: 12.5, max: 15, percentage: 83.33 });
  assert.throws(() => scoreEvaluation([{ score: 11, maxScore: 10 }]));
  assert.equal(toLetterGrade(95), "A+");
  assert.equal(toLetterGrade(59.99), "F");
});

import { parseCoordinates } from "../src/lib/geo/parse-coords.ts";

test("parseCoordinates: صيغ روابط الخرائط الشائعة", () => {
  const exp = { latitude: 26.3415, longitude: 43.9632 };
  assert.deepEqual(parseCoordinates("26.3415, 43.9632"), exp);
  assert.deepEqual(parseCoordinates("26.3415،43.9632"), exp);
  assert.deepEqual(parseCoordinates("https://www.google.com/maps/@26.3415,43.9632,17z"), exp);
  assert.deepEqual(parseCoordinates("https://www.google.com/maps/place/X/@26.30,43.90,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d26.3415!4d43.9632"), exp); // الدبوس لا مركز الكاميرا
  assert.deepEqual(parseCoordinates("https://maps.google.com/?q=26.3415,43.9632"), exp);
  assert.deepEqual(parseCoordinates("https://maps.apple.com/?ll=26.3415,43.9632&q=Pin"), exp);
  assert.deepEqual(parseCoordinates("https://www.openstreetmap.org/#map=17/26.3415/43.9632"), exp);
  assert.equal(parseCoordinates("https://maps.app.goo.gl/AbCdEf"), null);
  assert.equal(parseCoordinates("مستشفى بريدة"), null);
});
