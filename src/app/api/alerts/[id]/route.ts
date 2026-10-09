import { NextResponse } from "next/server";
import { audit, clientIp, handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** PATCH /api/alerts/:id — إغلاق تنبيه بعد معالجته */
export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("TRAINING_HEAD");
  const { id } = await params;
  await prisma.alert.update({ where: { id }, data: { isResolved: true, resolvedAt: new Date() } });
  await audit(user.id, "alert.resolve", "Alert", id, undefined, clientIp(req));
  return NextResponse.json({ ok: true });
});
