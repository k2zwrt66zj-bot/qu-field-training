/* ترحيل البيانات القديمة إلى النماذج الموحدة (FieldForm) — بلا فقد
 *
 *   FieldReport (قوالب JSON السابقة)      → FieldForm(kind=CUSTOM, templateKey=<القالب>)
 *   Logbook (السجل اليومي/الأسبوعي القديم) → FieldForm(kind=CUSTOM, templateKey=LEGACY_LOGBOOK_<النوع>)
 *
 * يحفظ: الحالة، التواريخ، الدرجة، التوقيع (كخانة FIELD_SUPERVISOR تشير لنفس التوقيع وبصمته)،
 * وملاحظات المشرفين (كـ FormComment). المعرّف القديم يُحفظ في data._legacy لضمان عدم التكرار.
 *
 * التشغيل:
 *   npx tsx prisma/data-migrations/legacy-to-forms.ts          # معاينة (لا يكتب شيئاً)
 *   npx tsx prisma/data-migrations/legacy-to-forms.ts --apply  # تنفيذ
 * يُنفَّذ عند التحول للواجهة الجديدة (المرحلة 3)، ويمكن إعادة تشغيله بأمان.
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Legacy = { source: "FieldReport" | "Logbook"; id: string };

async function alreadyMigrated(l: Legacy) {
  return (await prisma.fieldForm.count({ where: { kind: "CUSTOM", data: { path: ["_legacy", "id"], equals: l.id } } })) > 0;
}

async function nextSequence(tx: Prisma.TransactionClient, placementId: string) {
  const last = await tx.fieldForm.findFirst({ where: { placementId, kind: "CUSTOM" }, orderBy: { sequence: "desc" }, select: { sequence: true } });
  return (last?.sequence ?? 0) + 1;
}

async function main() {
  const reports = await prisma.fieldReport.findMany({
    include: { placement: { include: { student: true, fieldSupervisor: true, academicSupervisor: true } }, signature: true },
    orderBy: { createdAt: "asc" },
  });
  const logbooks = await prisma.logbook.findMany({
    include: { placement: { include: { student: true, fieldSupervisor: true, academicSupervisor: true } }, signature: true },
    orderBy: { createdAt: "asc" },
  });

  const plan = { reports: { total: reports.length, pending: 0 }, logbooks: { total: logbooks.length, pending: 0 } };
  let migrated = 0;

  for (const r of reports) {
    const legacy: Legacy = { source: "FieldReport", id: r.id };
    if (await alreadyMigrated(legacy)) continue;
    plan.reports.pending++;
    if (!APPLY) continue;
    await prisma.$transaction(async (tx) => {
      const p = r.placement;
      const form = await tx.fieldForm.create({
        data: {
          kind: "CUSTOM",
          templateKey: r.template,
          title: r.title,
          data: { ...(r.content as object), _legacy: legacy },
          placementId: r.placementId,
          sequence: await nextSequence(tx, r.placementId),
          status: r.status,
          submittedAt: r.submittedAt,
          fieldApprovedAt: r.signature?.signedAt ?? null,
          fieldApprovedById: r.signature?.signerId ?? null,
          academicApprovedAt: r.reviewedAt,
          academicApprovedById: r.reviewedById,
          academicScore: r.score,
          createdById: p.student.userId,
          createdAt: r.createdAt,
        },
      });
      if (r.signature) {
        await tx.formSignature.create({
          data: { formId: form.id, slot: "FIELD_SUPERVISOR", signatureId: r.signature.id, signerUserId: r.signature.signerId, signerName: "المشرف المؤسسي" },
        });
      }
      const fieldAuthor = r.signature?.signerId ?? p.fieldSupervisor?.userId;
      const academicAuthor = r.reviewedById ?? p.academicSupervisor?.userId;
      if (r.fieldComment && fieldAuthor) await tx.formComment.create({ data: { formId: form.id, authorId: fieldAuthor, body: r.fieldComment, createdAt: r.updatedAt } });
      if (r.academicComment && academicAuthor) await tx.formComment.create({ data: { formId: form.id, authorId: academicAuthor, body: r.academicComment, createdAt: r.updatedAt } });
    });
    migrated++;
  }

  for (const l of logbooks) {
    const legacy: Legacy = { source: "Logbook", id: l.id };
    if (await alreadyMigrated(legacy)) continue;
    plan.logbooks.pending++;
    if (!APPLY) continue;
    await prisma.$transaction(async (tx) => {
      const p = l.placement;
      const form = await tx.fieldForm.create({
        data: {
          kind: "CUSTOM",
          templateKey: `LEGACY_LOGBOOK_${l.type}`,
          title: l.type === "WEEKLY" ? `السجل الأسبوعي ${l.weekNumber ?? ""}`.trim() : "السجل اليومي",
          data: {
            type: l.type, weekNumber: l.weekNumber,
            periodStart: l.periodStart.toISOString().slice(0, 10), periodEnd: l.periodEnd.toISOString().slice(0, 10),
            activities: l.activities, skills: l.skills, challenges: l.challenges, reflections: l.reflections, plannedNext: l.plannedNext,
            _legacy: legacy,
          },
          placementId: l.placementId,
          sequence: await nextSequence(tx, l.placementId),
          status: l.status,
          submittedAt: l.submittedAt,
          fieldApprovedAt: l.signature?.signedAt ?? null,
          fieldApprovedById: l.signature?.signerId ?? null,
          createdById: p.student.userId,
          createdAt: l.createdAt,
        },
      });
      if (l.signature) {
        await tx.formSignature.create({
          data: { formId: form.id, slot: "FIELD_SUPERVISOR", signatureId: l.signature.id, signerUserId: l.signature.signerId, signerName: "المشرف المؤسسي" },
        });
      }
      const author = l.signature?.signerId ?? p.fieldSupervisor?.userId;
      if (l.fieldComment && author) await tx.formComment.create({ data: { formId: form.id, authorId: author, body: l.fieldComment, createdAt: l.updatedAt } });
    });
    migrated++;
  }

  console.log(APPLY ? "وضع التنفيذ" : "وضع المعاينة (لم يُكتب شيء — أضف --apply للتنفيذ)");
  console.log(`  التقارير القديمة: ${plan.reports.total} (بانتظار الترحيل ${plan.reports.pending})`);
  console.log(`  السجلات القديمة:  ${plan.logbooks.total} (بانتظار الترحيل ${plan.logbooks.pending})`);
  if (APPLY) {
    const signed = await prisma.formSignature.count({ where: { form: { kind: "CUSTOM" } } });
    const legacySigned = (await prisma.fieldReport.count({ where: { signatureId: { not: null } } })) + (await prisma.logbook.count({ where: { signatureId: { not: null } } }));
    console.log(`  رُحِّل الآن: ${migrated} — التواقيع المنقولة ${signed} من ${legacySigned}`);
  }
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
