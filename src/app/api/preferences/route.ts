import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const CATEGORIES = ["MEDICAL", "ORPHAN_CARE", "ELDERLY_CARE", "DISABILITY_CARE", "SCHOOL", "CHARITY", "FAMILY_COUNSELING", "JUVENILE_CARE", "PRISON_CARE", "ADDICTION_RECOVERY", "RESEARCH_CENTER", "GOVERNMENT", "OTHER"] as const;

const schema = z.object({
  city: z.string().min(2).max(60),
  district: z.string().max(60).optional(),
  homeLat: z.number().min(16).max(33).optional(), // حدود المملكة تقريباً
  homeLng: z.number().min(34).max(56).optional(),
  preferences: z
    .array(z.object({ category: z.enum(CATEGORIES).optional(), organizationId: z.string().optional(), notes: z.string().max(300).optional() }))
    .min(1)
    .max(3),
});

/** POST /api/preferences — تسجيل البيانات الجغرافية ورغبات التدريب (الطالب، قبل التوزيع) */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("STUDENT");
  const body = await parseBody(req, schema);
  const term = await prisma.academicTerm.findFirst({ where: { isActive: true } });
  if (!term) throw new ApiError(404, "لا يوجد فصل دراسي مفعّل");
  const student = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: user.id }, include: { placements: { where: { termId: term.id } } } });
  if (student.placements.length) throw new ApiError(409, "تم توزيعك مسبقاً ولا يمكن تعديل الرغبات");

  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { id: student.id },
      data: { city: body.city, district: body.district, homeLat: body.homeLat, homeLng: body.homeLng },
    }),
    prisma.trainingPreference.deleteMany({ where: { studentId: student.id, termId: term.id } }),
    prisma.trainingPreference.createMany({
      data: body.preferences.map((p, i) => ({ ...p, studentId: student.id, termId: term.id, rank: i + 1 })),
    }),
  ]);
  await audit(user.id, "preferences.save", "StudentProfile", student.id, { count: body.preferences.length }, clientIp(req));
  return NextResponse.json({ ok: true });
});
