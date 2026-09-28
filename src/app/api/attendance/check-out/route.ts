import { attendanceRoute } from "@/server/attendance-route";

/** POST /api/attendance/check-out — نفس صيغة التحضير، ويعيد workedMinutes */
export const POST = attendanceRoute("CHECK_OUT");
