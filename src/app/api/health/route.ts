import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health — فحص خفيف يُبقي دالة الخادم وقاعدة البيانات «دافئتين».
 * استعلام SELECT 1 بسيط يوقظ الاتصال بقاعدة البيانات دون كشف أي بيانات.
 * يُستخدم كهدف لمُراقب جاهزية خارجي (كل 5 دقائق) لتفادي البطء بعد الخمول.
 */
export async function GET() {
  const t0 = Date.now();
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return NextResponse.json(
    { ok: db, db, ms: Date.now() - t0, at: new Date().toISOString() },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
