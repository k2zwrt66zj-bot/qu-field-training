import { ApiError, handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";
import { portfolioParts } from "@/server/pdf/documents";
import { officialDocument } from "@/server/pdf/layout";
import { pdfResponse } from "@/server/pdf/engine";
import { publicBaseUrl } from "@/server/pdf/base-url";

export const runtime = "nodejs";
export const maxDuration = 120;

/** GET /api/portfolio/:placementId/pdf — «السجل المهني» الكامل بترتيب الدليل الرسمي */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ placementId: string }> }) => {
  const user = await requireRole();
  const { placementId } = await params;
  const placement = await prisma.placement.findFirst({ where: { id: placementId, ...placementScope(user) }, select: { id: true } });
  if (!placement) throw new ApiError(404, "السجل غير موجود");
  const { title, parts } = await portfolioParts(user, placementId, publicBaseUrl(req));
  return pdfResponse(await officialDocument(title, parts), title, req);
});
