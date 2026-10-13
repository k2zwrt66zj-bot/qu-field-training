import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { audit, clientIp, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { Gender, Major } from "@prisma/client";

const MAX_ROWS = 200;

// قيم مرنة للتخصص والجنس (عربي أو رمز)
const MAJOR_MAP: Record<string, Major> = {
  "social_work": "SOCIAL_WORK", "الخدمة الاجتماعية": "SOCIAL_WORK", "خدمة اجتماعية": "SOCIAL_WORK",
  "sociology": "SOCIOLOGY", "علم الاجتماع": "SOCIOLOGY", "اجتماع": "SOCIOLOGY",
};
const GENDER_MAP: Record<string, Gender> = {
  "male": "MALE", "ذكر": "MALE", "طالب": "MALE", "m": "MALE",
  "female": "FEMALE", "أنثى": "FEMALE", "انثى": "FEMALE", "طالبة": "FEMALE", "f": "FEMALE",
};

const rowSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  universityId: z.string().trim().regex(/^\d{6,12}$/),
  major: z.string().trim().min(1),
  gender: z.string().trim().min(1),
  city: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  level: z.coerce.number().int().min(1).max(12).optional(),
  gpa: z.coerce.number().min(0).max(5).optional(),
});
const schema = z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_ROWS) });

/**
 * POST /api/students/import — استيراد دفعة طلاب (رئيس التدريب).
 * يستقبل صفوفاً مُحلَّلة من ملف CSV/Excel، يتحقق من كلٍّ على حدة،
 * ينشئ الصالح منها بكلمة مرور مؤقتة، ويتجاوز المكرر/غير الصالح مع بيان السبب.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("TRAINING_HEAD");
  const { rows } = await parseBody(req, schema);

  const created: { fullName: string; universityId: string; email: string; tempPassword: string }[] = [];
  const skipped: { row: number; universityId?: string; reason: string }[] = [];
  const seenUid = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const n = i + 1; // رقم الصف (بدون الترويسة)
    const parsed = rowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      skipped.push({ row: n, universityId: String((rows[i] as Record<string, unknown>).universityId ?? ""), reason: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
      continue;
    }
    const r = parsed.data;
    const major = MAJOR_MAP[r.major.toLowerCase()] ?? MAJOR_MAP[r.major];
    const gender = GENDER_MAP[r.gender.toLowerCase()] ?? GENDER_MAP[r.gender];
    if (!major) { skipped.push({ row: n, universityId: r.universityId, reason: "تخصص غير معروف" }); continue; }
    if (!gender) { skipped.push({ row: n, universityId: r.universityId, reason: "جنس غير معروف" }); continue; }
    if (seenUid.has(r.universityId)) { skipped.push({ row: n, universityId: r.universityId, reason: "مكرر داخل الملف" }); continue; }
    seenUid.add(r.universityId);

    const email = `${r.universityId}@qu.edu.sa`;
    if (await prisma.studentProfile.findUnique({ where: { universityId: r.universityId }, select: { id: true } })) {
      skipped.push({ row: n, universityId: r.universityId, reason: "الرقم الجامعي مسجّل مسبقاً" }); continue;
    }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      skipped.push({ row: n, universityId: r.universityId, reason: "معرّف الدخول مستخدم" }); continue;
    }

    const tempPassword = `Qu-${randomBytes(4).toString("hex")}`;
    try {
      await prisma.user.create({
        data: {
          email, fullName: r.fullName, phone: r.phone || null, gender,
          role: "STUDENT", passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true,
          student: { create: { universityId: r.universityId, major, gender, city: r.city, district: r.district || null, level: r.level ?? 7, gpa: r.gpa ?? null } },
        },
      });
      created.push({ fullName: r.fullName, universityId: r.universityId, email, tempPassword });
    } catch {
      skipped.push({ row: n, universityId: r.universityId, reason: "تعذّر الإنشاء" });
    }
  }

  await audit(user.id, "student.import", "User", undefined, { created: created.length, skipped: skipped.length }, clientIp(req));
  return NextResponse.json({ ok: true, total: rows.length, createdCount: created.length, skippedCount: skipped.length, created, skipped }, { status: 201 });
});
