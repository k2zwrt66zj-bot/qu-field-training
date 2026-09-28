import { NextResponse } from "next/server";
import { handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";
import { legacyGone } from "@/server/legacy";

/** GET /api/reports?placementId=&status= — أرشيف التقارير القديمة (قراءة فقط) ضمن نطاق المستخدم */
export const GET = handler(async (req: Request) => {
  const user = await requireRole();
  const url = new URL(req.url);
  const placementId = url.searchParams.get("placementId") ?? undefined;
  const status = url.searchParams.get("status");
  const reports = await prisma.fieldReport.findMany({
    where: {
      placement: { ...placementScope(user), ...(placementId ? { id: placementId } : {}) },
      ...(status ? { status: status as never } : {}),
      // المشرفون لا يرون المسودات
      ...(user.role !== "STUDENT" ? { status: { not: "DRAFT" } } : {}),
    },
    select: { id: true, template: true, title: true, status: true, submittedAt: true, updatedAt: true, score: true, placementId: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ reports });
});

/** POST /api/reports — متوقف: النماذج الإضافية تُنشأ عبر POST /api/forms {kind: "CUSTOM"} */
export const POST = legacyGone;
