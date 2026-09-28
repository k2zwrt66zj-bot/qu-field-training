// حسابات النطاق الجغرافي (Geofencing) - دوال نقية قابلة للاختبار

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** المسافة بالمتر بين نقطتين (معادلة هافرساين) */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface GeofenceResult {
  distance: number; // المسافة الفعلية عن مركز الجهة
  inside: boolean; // داخل النطاق بعد احتساب هامش الدقة
  tolerance: number; // الهامش المسموح به بسبب دقة GPS
}

/**
 * يتحقق من وجود الطالب داخل دائرة جهة التدريب.
 * يُسمح بهامش صغير يساوي دقة القراءة بحد أقصى 25 متراً، حتى لا يُظلم
 * الطالب الواقف عند مدخل المبنى بسبب ضعف الإشارة، ودون فتح الباب للتحايل.
 */
export function checkGeofence(
  point: LatLng,
  center: LatLng,
  radiusMeters: number,
  accuracyMeters?: number | null
): GeofenceResult {
  const distance = haversineMeters(point, center);
  const tolerance = Math.min(Math.max(accuracyMeters ?? 0, 0), 25);
  return { distance, inside: distance <= radiusMeters + tolerance, tolerance };
}

/** أقصى تشتت (بالمتر) بين عينات متعددة للموقع */
export function samplesSpread(samples: LatLng[]): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      max = Math.max(max, haversineMeters(samples[i], samples[j]));
    }
  }
  return max;
}
