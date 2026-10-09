import { NextResponse } from "next/server";
import { runDailyAttendanceSweep } from "@/server/alerts";

/**
 * المسح اليومي للحضور (تعليم الغياب وإطلاق التنبيهات) بعد نهاية الدوام.
 * يُجدول على Vercel Cron (GET) يومياً، ويمكن استدعاؤه يدوياً (POST).
 * التفويض: Authorization: Bearer <CRON_SECRET> — ويضيفه Vercel تلقائياً عند ضبط CRON_SECRET.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  return NextResponse.json(await runDailyAttendanceSweep());
}

export const GET = run;
export const POST = run;
