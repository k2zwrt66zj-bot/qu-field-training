import { handler, requireRole } from "@/lib/api";
import { loadFormFor } from "@/server/forms/service";
import { formDocPart } from "@/server/pdf/documents";
import { officialDocument } from "@/server/pdf/layout";
import { pdfResponse } from "@/server/pdf/engine";
import { publicBaseUrl } from "@/server/pdf/base-url";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/forms/:id/pdf — النموذج الرسمي PDF (الصلاحية: EXPORT، والإخفاء نفسه كالواجهة) */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole();
  const { form } = await loadFormFor(user, (await params).id, "EXPORT");
  const part = await formDocPart(user, form, publicBaseUrl(req));
  const html = await officialDocument(part.label, [part]);
  return pdfResponse(html, part.label.replace(/[\\/:*?"<>|]/g, "-"), req);
});
