import { NextResponse } from "next/server";
import { ApiError, handler, requireRole } from "@/lib/api";
import { parseCoordinates } from "@/lib/geo/parse-coords";

// نتبع إعادة التوجيه لروابط الخرائط المختصرة فقط (قائمة سماح لمنع SSRF)
const ALLOWED_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co", "maps.google.com", "www.google.com", "google.com"]);

/** GET /api/geo/resolve?url= — فك الروابط المختصرة لخرائط Google واستخراج الإحداثيات */
export const GET = handler(async (req: Request) => {
  await requireRole("TRAINING_HEAD");
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  const direct = parseCoordinates(raw);
  if (direct) return NextResponse.json(direct);

  let current: URL;
  try {
    current = new URL(raw);
  } catch {
    throw new ApiError(422, "الرابط غير صالح");
  }
  for (let hop = 0; hop < 5; hop++) {
    if (current.protocol !== "https:" || !ALLOWED_HOSTS.has(current.hostname)) throw new ApiError(422, "يُقبل رابط خرائط Google فقط");
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    const location = res.headers.get("location");
    if (!location) break;
    current = new URL(location, current);
    const coords = parseCoordinates(current.toString());
    if (coords) return NextResponse.json(coords);
  }
  throw new ApiError(422, "لم نتمكن من استخراج الإحداثيات من الرابط؛ انسخ الإحداثيات مباشرة من تطبيق الخرائط");
});
