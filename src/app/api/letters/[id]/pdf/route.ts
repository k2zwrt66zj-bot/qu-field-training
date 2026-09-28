import { ApiError, handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";
import { renderLetterHtml, renderLetterPdf } from "@/server/letters";

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET /api/letters/:id/pdf — تنزيل الخطاب PDF (يتطلب CHROME_EXECUTABLE_PATH) */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole();
  const { id } = await params;
  const letter = await prisma.letter.findFirst({ where: { id, placement: placementScope(user) } });
  if (!letter) throw new ApiError(404, "الخطاب غير موجود");

  const html = await renderLetterHtml(id, new URL(req.url).origin);
  const pdf = await renderLetterPdf(html);
  if (!pdf) {
    // لا يوجد متصفح على الخادم: نعيد التوجيه لنسخة الطباعة (حفظ كـ PDF من المتصفح)
    return Response.redirect(new URL(`/letters/${id}`, req.url), 302);
  }
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${letter.serialNumber}.pdf"`,
    },
  });
});
