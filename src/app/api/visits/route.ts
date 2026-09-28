import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    placementId: z.string(),
    type: z.enum(["IN_PERSON", "VIRTUAL"]),
    visitDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
    meetingLink: z.string().url().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    summary: z.string().min(10).max(5000),
    recommendations: z.string().max(5000).optional(),
    studentRating: z.number().int().min(1).max(5).optional(),
  })
  .refine((v) => v.type === "IN_PERSON" || !!v.meetingLink, { message: "رابط الاجتماع مطلوب للزيارة الافتراضية", path: ["meetingLink"] });

/** POST /api/visits — توثيق زيارة إشرافية (المشرف الأكاديمي) */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("ACADEMIC_SUPERVISOR");
  const body = await parseBody(req, schema);
  const placement = await prisma.placement.findFirst({
    where: { id: body.placementId, academicSupervisor: { userId: user.id } },
    select: { id: true, academicSupervisorId: true },
  });
  if (!placement?.academicSupervisorId) throw new ApiError(403, "الطالب غير مسند إليك");
  const visit = await prisma.supervisionVisit.create({
    data: { ...body, visitDate: new Date(body.visitDate), supervisorId: placement.academicSupervisorId },
  });
  return NextResponse.json({ ok: true, visit });
});
