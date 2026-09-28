import { attendanceRoute } from "@/server/attendance-route";

/**
 * POST /api/attendance/check-in
 * body: { samples: PositionSample[], deviceId?: string, isMocked?: boolean }
 * 200 => { ok: true, recordId, status: "PRESENT" | "LATE", distance, flagged, riskFlags }
 * 422 => { ok: false, reason, distance?, riskFlags }
 */
export const POST = attendanceRoute("CHECK_IN");
