// استخراج الإحداثيات من نص يلصقه المستخدم: رابط خرائط Google أو Apple أو OSM أو "lat, lng" مباشرة

export interface ParsedCoords {
  latitude: number;
  longitude: number;
}

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export function parseCoordinates(input: string): ParsedCoords | null {
  const text = decodeURIComponent(input.trim());
  const patterns = [
    // دبوس المكان الفعلي في روابط place — يُقدَّم على @ لأن @ هو مركز الكاميرا وقد يبعد مئات الأمتار
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, //                 google.com/maps/place/...!3d26.34!4d43.96
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, //                    google.com/maps/@26.34,43.96,17z
    /[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, // ?q=26.34,43.96  (Google / Apple)
    /[?&]mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)/, //        openstreetmap.org/?mlat=..&mlon=..
    /#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/, //           openstreetmap.org/#map=17/26.34/43.96
    /^\(?\s*(-?\d{1,2}\.\d+)\s*[,،\s]\s*(-?\d{1,3}\.\d+)\s*\)?$/, // "26.3415, 43.9632"
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (valid(lat, lng)) return { latitude: lat, longitude: lng };
    }
  }
  return null;
}
