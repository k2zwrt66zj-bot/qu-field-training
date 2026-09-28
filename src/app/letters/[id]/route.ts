import { ApiError, handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";
import { renderLetterHtml } from "@/server/letters";

/** GET /letters/:id — نسخة الخطاب للعرض والطباعة (A4) */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole();
  const { id } = await params;
  const letter = await prisma.letter.findFirst({ where: { id, placement: placementScope(user) }, select: { id: true } });
  if (!letter) throw new ApiError(404, "الخطاب غير موجود");
  const html = await renderLetterHtml(id, new URL(req.url).origin, { printButton: true });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});
