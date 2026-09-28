import { NextResponse } from "next/server";
import { handler, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** PATCH /api/alerts/:id — إغلاق تنبيه بعد معالجته */
export const PATCH = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireRole("TRAINING_HEAD");
  const { id } = await params;
  await prisma.alert.update({ where: { id }, data: { isResolved: true, resolvedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
