/**
 * العنوان العام للمنصة لروابط التحقق في رموز QR:
 * APP_PUBLIC_URL إن حُدِّد (نطاق رسمي ثابت)، وإلا نطاق الطلب الحالي (مع دعم الوكيل العكسي)
 * — لا نعتمد NEXTAUTH_URL لأنه قد يبقى http://localhost:3000 عند فتح المنصة من نطاق آخر.
 */
export function publicBaseUrl(req: Request): string {
  const fixed = process.env.APP_PUBLIC_URL?.replace(/\/$/, "");
  if (fixed) return fixed;
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
