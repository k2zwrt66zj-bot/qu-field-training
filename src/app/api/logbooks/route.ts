import { NextResponse } from "next/server";
import { handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";
import { legacyGone } from "@/server/legacy";

/** GET /api/logbooks?placementId= — أرشيف السجلات القديمة (قراءة فقط) */
export const GET = handler(async (req: Request) => {
  const user = await requireRole();
  const placementId = new URL(req.url).searchParams.get("placementId") ?? undefined;
  const logbooks = await prisma.logbook.findMany({
    where: { placement: { ...placementScope(user), ...(placementId ? { id: placementId } : {}) } },
    include: { signature: { select: { signedAt: true, signer: { select: { fullName: true } } } } },
    orderBy: { periodStart: "desc" },
  });
  return NextResponse.json({ logbooks });
});

/** POST /api/logbooks — متوقف: السجل الأسبوعي أصبح «نموذج تسجيل المهارات والمعارف» (POST /api/forms {kind: "SKILLS_LOG"}) */
export const POST = legacyGone;
