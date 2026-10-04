/* حسابات العرض أمام العميد — تُنشأ بعد بيانات العرض (npm run demo:data)
 *
 *   طالب يبدأ رحلته من الصفر: عبدالملك العتيبي (441100100@qu.edu.sa)
 *     موزَّع على مؤسسة المشرف المؤسسي field1@example.sa، بحالة «موزَّع» بلا أي نموذج أو حضور،
 *     فيظهر كأول دخول: نموذج المباشرة ← توقيع المشرف المؤسسي ومدير المؤسسة ← إحاطة المشرف الأكاديمي ← بقية النماذج
 *   مشرفان أكاديميان: ناهس عائض العمري (مشرف عبدالملك) · الأمين محمد البشير
 *
 * كل تشغيل يعيد رحلة عبدالملك إلى البداية (للتجربة ثم العرض) ولا يمس أي بيانات أخرى.
 * التشغيل: npm run demo:accounts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { riyadhDateOnly } from "../src/lib/time";

const prisma = new PrismaClient();
const PASSWORD = "Qu@12345";
const FIELD_SUPERVISOR_EMAIL = "field1@example.sa";

export const DEMO_ACCOUNTS = {
  student: { email: "441100100@qu.edu.sa", universityId: "441100100", fullName: "عبدالملك العتيبي", phone: "0551000100" },
  academics: [
    { email: "nahes.alomari@qu.edu.sa", fullName: "ناهس عائض العمري", phone: "0551000201" },
    { email: "alameen.albasheer@qu.edu.sa", fullName: "الأمين محمد البشير", phone: "0551000202" },
  ],
};

async function upsertUser(email: string, fullName: string, role: "STUDENT" | "ACADEMIC_SUPERVISOR", phone: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { fullName, role, phone, isActive: true, passwordHash, deviceId: null },
    create: { email, fullName, role, phone, gender: "MALE", passwordHash },
  });
}

async function main() {
  const term = await prisma.academicTerm.findFirst({ where: { isActive: true } });
  if (!term) throw new Error("لا يوجد فصل دراسي مفعّل — شغّل npm run demo:reset أولاً");
  const field = await prisma.fieldSupervisorProfile.findFirst({ where: { user: { email: FIELD_SUPERVISOR_EMAIL } }, include: { organization: true } });
  if (!field) throw new Error(`لا يوجد المشرف المؤسسي ${FIELD_SUPERVISOR_EMAIL} — شغّل npm run demo:reset أولاً`);
  const section = await prisma.courseSection.findFirst({ where: { termId: term.id, mode: "FIELD" }, orderBy: { sectionNumber: "asc" } });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // المشرفان الأكاديميان
  const academics = [];
  for (const a of DEMO_ACCOUNTS.academics) {
    const u = await upsertUser(a.email, a.fullName, "ACADEMIC_SUPERVISOR", a.phone, passwordHash);
    academics.push(await prisma.academicSupervisorProfile.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, maxStudents: 15 } }));
  }

  // الطالب
  const s = DEMO_ACCOUNTS.student;
  const su = await upsertUser(s.email, s.fullName, "STUDENT", s.phone, passwordHash);
  const profile = await prisma.studentProfile.upsert({
    where: { userId: su.id },
    update: { major: "SOCIAL_WORK", gender: "MALE" },
    create: { userId: su.id, universityId: s.universityId, major: "SOCIAL_WORK", gender: "MALE", level: 7, gpa: 4.5, city: "بريدة" },
  });

  // رحلة جديدة من البداية: حذف إسناد الفصل (ومعه نماذجه وحضوره وخطاباته) ثم إسناد جديد بحالة «موزَّع»
  const removed = await prisma.placement.deleteMany({ where: { studentId: profile.id, termId: term.id } });
  const today = riyadhDateOnly();
  const placement = await prisma.placement.create({
    data: {
      studentId: profile.id,
      termId: term.id,
      organizationId: field.organizationId,
      fieldSupervisorId: field.id,
      academicSupervisorId: academics[0].id,
      sectionId: section?.id,
      startDate: today < term.startDate ? term.startDate : today,
      endDate: term.endDate,
      requiredHours: term.requiredHours,
      workDays: [0, 1, 2, 3, 4],
      status: "ASSIGNED",
    },
  });

  console.log(removed.count ? "↻ أُعيدت رحلة الطالب إلى البداية" : "✓ أُنشئ إسناد الطالب");
  console.log(`\nحسابات العرض (كلمة المرور: ${PASSWORD})`);
  console.log(`  طالب (أول دخول):     ${s.email} — ${s.fullName}`);
  console.log(`     جهة التدريب:     ${field.organization.name} · المشرف المؤسسي ${FIELD_SUPERVISOR_EMAIL}`);
  console.log(`     الإسناد:          ${placement.id}`);
  for (const [i, a] of DEMO_ACCOUNTS.academics.entries()) {
    console.log(`  مشرف أكاديمي:        ${a.email} — ${a.fullName}${i === 0 ? " (مشرف عبدالملك)" : ""}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
