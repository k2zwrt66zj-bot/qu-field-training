import { ApiError, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";
import { renderLetterHtml } from "@/server/letters";

const htmlHeaders = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" };

/** صفحة خطأ بسيطة بدل نص JSON (هذا المسار يُفتح في المتصفح مباشرة) */
function errorPage(status: number, message: string) {
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>تعذّر عرض الخطاب</title>
<style>body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;background:#f7f8f9;color:#1d2330;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
.card{background:#fff;border:1px solid #e3e6ea;border-radius:16px;padding:28px;max-width:420px;text-align:center}
h1{color:#0f486e;font-size:20px;margin:0 0 8px}p{color:#4a4f57;line-height:1.8;margin:0 0 18px}
a{display:inline-block;background:#0f486e;color:#fff;border-radius:8px;padding:9px 18px;text-decoration:none;margin:0 4px}a.alt{background:#0b7a93}</style></head>
<body><div class="card"><h1>تعذّر عرض الخطاب</h1><p>${message}</p><a href="javascript:location.reload()">إعادة المحاولة</a><a class="alt" href="/">الرئيسية</a></div></body></html>`;
  return new Response(html, { status, headers: htmlHeaders });
}

/** GET /letters/:id — نسخة الخطاب للعرض والطباعة (A4) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole();
    const { id } = await params;
    const letter = await prisma.letter.findFirst({ where: { id, placement: placementScope(user) }, select: { id: true } });
    if (!letter) return errorPage(404, "الخطاب غير موجود، أو ليست لديك صلاحية عرضه.");
    const html = await renderLetterHtml(id, new URL(req.url).origin, { printButton: true });
    return new Response(html, { headers: htmlHeaders });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return Response.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(new URL(req.url).pathname)}`, req.url), 302);
    if (e instanceof ApiError) return errorPage(e.status, e.message);
    console.error("[letters]", e);
    return errorPage(500, "حدث خطأ غير متوقع أثناء تجهيز الخطاب. أعد المحاولة بعد لحظات، وإن تكرر فأبلغ الدعم الفني.");
  }
}
