import { NextResponse } from "next/server";
import { runDailyAttendanceSweep } from "@/server/alerts";

/**
 * POST /api/cron/daily — تُستدعى يومياً بعد نهاية الدوام (مثلاً 15:00 بتوقيت الرياض)
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  return NextResponse.json(await runDailyAttendanceSweep());
}
