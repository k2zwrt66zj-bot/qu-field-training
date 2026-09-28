/** العنوان العام للمنصة (لروابط التحقق في رموز QR) */
export const publicBaseUrl = (req: Request) => process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
