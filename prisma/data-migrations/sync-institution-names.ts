/* مزامنة أسماء القيادات في قاعدة البيانات مع src/lib/labels.ts (INSTITUTION) — بلا مساس بأي بيانات أخرى
 *
 *   رئيس القسم (DEPARTMENT_HEAD)              ← INSTITUTION.departmentHead
 *   رئيسة وحدة التدريب الميداني (TRAINING_HEAD) ← INSTITUTION.trainingHead
 *
 * الخطابات والمستندات تقرأ الأسماء من INSTITUTION مباشرة، وهذا السكربت يحدّث اسم الحساب
 * الظاهر في الشريط العلوي والتواقيع. يُعاد تشغيله بأمان.
 *
 * التشغيل:
 *   npm run db:sync-names            # معاينة (لا يكتب شيئاً)
 *   npm run db:sync-names -- --apply # تنفيذ
 */
import { PrismaClient, type Role } from "@prisma/client";
import { INSTITUTION } from "../../src/lib/labels";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const TARGETS: { role: Role; fullName: string }[] = [
  { role: "DEPARTMENT_HEAD", fullName: INSTITUTION.departmentHead },
  { role: "TRAINING_HEAD", fullName: INSTITUTION.trainingHead },
];

async function main() {
  console.log(APPLY ? "تنفيذ مزامنة الأسماء" : "معاينة مزامنة الأسماء (أضف -- --apply للتنفيذ)");
  for (const { role, fullName } of TARGETS) {
    const users = await prisma.user.findMany({ where: { role, isActive: true }, select: { id: true, email: true, fullName: true } });
    if (users.length !== 1) {
      console.log(`  ⚠ ${role}: ${users.length} حساب مفعّل — تُترك دون تغيير (حدّث الاسم يدوياً)`);
      continue;
    }
    const [u] = users;
    if (u.fullName === fullName) {
      console.log(`  ✓ ${u.email}: «${fullName}» (لا تغيير)`);
      continue;
    }
    console.log(`  ↻ ${u.email}: «${u.fullName}» ← «${fullName}»`);
    if (APPLY) await prisma.user.update({ where: { id: u.id }, data: { fullName } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
