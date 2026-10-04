/* فحص تكاملي لمخطط النماذج الرسمية على قاعدة بيانات حقيقية.
 * يعمل داخل معاملة تُلغى في النهاية، فلا يترك أي بيانات.
 * التشغيل: npm run db:check-forms   (يتطلب قاعدة مُهيأة بالبيانات التجريبية)
 */
import { Prisma, PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";

const prisma = new PrismaClient();
const ROLLBACK = Symbol("rollback");
let passed = 0;
const ok = (msg: string) => { passed++; console.log(`  ✓ ${msg}`); };

async function expectUniqueViolation(tx: Prisma.TransactionClient, label: string, fn: () => Promise<unknown>) {
  // نقطة حفظ حتى لا يُفسد الخطأ المتوقع بقية المعاملة
  await tx.$executeRawUnsafe("SAVEPOINT sp");
  try {
    await fn();
    assert.fail(`${label}: كان يجب رفض التكرار`);
  } catch (e) {
    assert.ok(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002", `${label}: ${String(e)}`);
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT sp");
    ok(`${label} (قيد فريد)`);
  }
}

async function main() {
  const placement = await prisma.placement.findFirstOrThrow({
    where: { student: { major: "SOCIAL_WORK" }, forms: { none: { kind: { not: "CUSTOM" } } }, // نماذج إضافية أو مرحّلة لا تؤثر
      academicSupervisorId: { not: null }, fieldSupervisorId: { not: null } },
    include: { student: true, fieldSupervisor: true, academicSupervisor: true, organization: true },
  });
  const studentUserId = placement.student.userId;
  const formsBefore = await prisma.fieldForm.count();
  const fieldUserId = placement.fieldSupervisor!.userId;
  const png = "data:image/png;base64,iVBORw0KGgo=";

  await prisma
    .$transaction(async (tx) => {
      console.log("1) المباشرة + الشعبة + تواقيع متعددة الأطراف");
      const section = await tx.courseSection.create({
        data: { termId: placement.termId, courseName: "تدريب ميداني (1)", courseCode: "SOC 481", sectionNumber: "T-CHECK", trainingNumber: 1, mode: "FIELD", major: "SOCIAL_WORK" },
      });
      await tx.placement.update({ where: { id: placement.id }, data: { sectionId: section.id, shift: "MORNING" } });
      const commencement = await tx.fieldForm.create({
        data: {
          kind: "COMMENCEMENT", placementId: placement.id, createdById: studentUserId,
          commencement: { create: { commencementDate: new Date("2026-09-06"), fixedTrainingDay: 0, shift: "MORNING", declarationAccepted: true, directorName: "أ. مدير المؤسسة" } },
        },
      });
      ok("نموذج مباشرة بمظروف + تفاصيل 1:1");
      await expectUniqueViolation(tx, "لا يمكن إنشاء نموذج مباشرة ثانٍ لنفس الإسناد", () =>
        tx.fieldForm.create({ data: { kind: "COMMENCEMENT", placementId: placement.id, createdById: studentUserId } })
      );
      const sign = async (slot: "STUDENT" | "FIELD_SUPERVISOR" | "ORG_DIRECTOR", signerId: string, name: string, withStamp = false) => {
        const sig = await tx.signature.create({ data: { signerId, imageData: png, contentHash: "0".repeat(64) } });
        return tx.formSignature.create({
          data: { formId: commencement.id, slot, signatureId: sig.id, signerUserId: slot === "ORG_DIRECTOR" ? null : signerId, signerName: name, withStamp },
        });
      };
      await sign("STUDENT", studentUserId, "الطالب");
      await sign("FIELD_SUPERVISOR", fieldUserId, "المشرف المؤسسي");
      await sign("ORG_DIRECTOR", fieldUserId, "أ. مدير المؤسسة"); // يوقّع المدير على جهاز المشرف
      ok("ثلاث خانات توقيع: الطالب، المشرف المؤسسي، المدير");
      await expectUniqueViolation(tx, "خانة توقيع واحدة لكل دور في النموذج", () => sign("STUDENT", studentUserId, "مكرر"));

      console.log("2) دراسة الحالة: التكوين الأسري + المقابلات المرتبطة");
      const cs = await tx.fieldForm.create({
        data: {
          kind: "CASE_STUDY", placementId: placement.id, createdById: studentUserId,
          caseStudy: {
            create: {
              caseAlias: "الحالة (س)", consentConfirmed: true, mainProblem: "انسحاب اجتماعي", subProblems: ["ضعف التواصل", "قلق"],
              therapeuticModels: ["المعرفي السلوكي"], techniques: ["إعادة البناء المعرفي"],
              initGoalsMeasurable: true, finalOutcome: "POSITIVE_CHANGE", terminationType: "PLANNED", plannedGoalsAchieved: true,
              followUpInterval: "CLOSE", followUpPurposes: ["SERVICE_EVALUATION", "CLIENT_ATTACHMENT"], followUpMethods: ["PHONE_CALLS"],
              familyMembers: { create: [{ order: 1, name: "الأب", age: 60, relation: "أب" }, { order: 2, name: "(ع)", age: 34, relation: "العميل" }] },
            },
          },
        },
        include: { caseStudy: true },
      });
      for (const n of [1, 2]) {
        await tx.fieldForm.create({
          data: {
            kind: "INTERVIEW", sequence: n, placementId: placement.id, createdById: studentUserId,
            interview: {
              create: {
                caseStudyId: cs.caseStudy!.id, interviewDate: new Date(`2026-09-1${n}`), parties: "العميل", goals: "بناء العلاقة", content: "…",
                difficulties: { create: [{ order: 1, difficulty: "تحفظ العميل", coping: "التقبل والإنصات" }] },
              },
            },
          },
        });
      }
      const loaded = await tx.caseStudy.findUniqueOrThrow({ where: { id: cs.caseStudy!.id }, include: { familyMembers: true, interviews: { include: { difficulties: true } } } });
      assert.equal(loaded.familyMembers.length, 2);
      assert.equal(loaded.interviews.length, 2);
      assert.deepEqual(loaded.followUpPurposes, ["SERVICE_EVALUATION", "CLIENT_ATTACHMENT"]);
      ok("دراسة حالة + فردا أسرة + مقابلتان مرقّمتان (1، 2) بصعوباتهما + قوائم التعداد");
      await expectUniqueViolation(tx, "رقم المقابلة لا يتكرر لنفس الطالب", () =>
        tx.fieldForm.create({ data: { kind: "INTERVIEW", sequence: 2, placementId: placement.id, createdById: studentUserId } })
      );
      await expectUniqueViolation(tx, "ترتيب أفراد الأسرة لا يتكرر", () =>
        tx.caseFamilyMember.create({ data: { caseStudyId: cs.caseStudy!.id, order: 1, name: "x", relation: "x" } })
      );

      console.log("3) الخطة الأسبوعية ← سجل المهارات + مرفق شاهد");
      const plan = await tx.fieldForm.create({
        data: {
          kind: "TRAINING_PLAN", placementId: placement.id, createdById: studentUserId,
          trainingPlan: { create: { generalGoal: "إكساب مهارات الممارسة", weeks: { create: [{ weekNumber: 1, tasks: "التعرف على المؤسسة", responsible: "الطالب والمشرف المؤسسي" }] } } },
        },
        include: { trainingPlan: { include: { weeks: true } } },
      });
      const log = await tx.fieldForm.create({
        data: {
          kind: "SKILLS_LOG", placementId: placement.id, createdById: studentUserId,
          skillsLog: { create: { weekNumber: 1, logDate: new Date("2026-09-06"), planWeekId: plan.trainingPlan!.weeks[0].id, topics: ["جولة تعريفية"], skillsNarrative: "…", knowledgeNarrative: "…" } },
          attachments: { create: { kind: "EVIDENCE", uploadedById: studentUserId, fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 1024, storageKey: `check/${Date.now()}.jpg`, sha256: "f".repeat(64) } },
        },
        include: { skillsLog: { include: { planWeek: true } }, attachments: true },
      });
      assert.equal(log.skillsLog!.planWeek!.weekNumber, 1);
      assert.equal(log.attachments.length, 1);
      ok("سجل مهارات مرتبط بأسبوع الخطة ومعه مرفق شاهد");

      console.log("4) البرنامج الجماعي + الموقف السريع الطبي + القراءة");
      await tx.fieldForm.create({ data: { kind: "GROUP_PROGRAM", placementId: placement.id, createdById: studentUserId, program: { create: { programDate: new Date("2026-09-20"), programTitle: "لقاء توعوي", membersCount: 15, positives: ["تفاعل جيد"], negatives: [] } } } });
      await tx.fieldForm.create({ data: { kind: "QUICK_SITUATION", placementId: placement.id, createdById: studentUserId, quickSituation: { create: { domain: "MEDICAL", situationDate: new Date("2026-09-21"), medicalVisitType: "INPATIENT", hospitalDepartment: "الباطنية", referralSource: "الطبيب", summary: "…", actionsTaken: "…" } } } });
      await tx.fieldForm.create({ data: { kind: "READING", placementId: placement.id, createdById: studentUserId, reading: { create: { sourceType: "JOURNAL_ARTICLE", readingDate: new Date("2026-09-22"), authors: ["Smith, J."], publicationYear: 2023, title: "Social work in hospitals", containerTitle: "Health & Social Work", volume: "48", issue: "2", pages: "101-110", apaCitation: "Smith, J. (2023). …", purpose: "…", professionalBenefit: "…" } } } });
      ok("برنامج جماعي، موقف سريع طبي (منوّم)، قراءة بتوثيق APA");

      console.log("5) الاجتماع الإشرافي الجماعي");
      const peers = await tx.placement.findMany({ where: { organizationId: placement.organizationId, termId: placement.termId }, include: { student: true } });
      const meeting = await tx.supervisionMeeting.create({
        data: {
          termId: placement.termId, organizationId: placement.organizationId, academicSupervisorId: placement.academicSupervisorId!, number: 1,
          meetingDate: new Date("2026-09-24"), approvePreviousMinutes: false, agendaItems: ["توزيع المهام"], decisions: ["تسليم الخطة"],
          secretaryPlacementId: placement.id,
          attendance: { create: peers.map((p, i) => ({ placementId: p.id, status: i === 0 ? "PRESENT" : i === 1 ? "ABSENT_EXCUSED" : "PRESENT" })) },
        },
        include: { attendance: true },
      });
      for (const p of peers.slice(0, 2)) {
        const sig = await tx.signature.create({ data: { signerId: p.student.userId, imageData: png, contentHash: "0".repeat(64) } });
        await tx.formSignature.create({ data: { meetingId: meeting.id, slot: "MEETING_MEMBER", signatureId: sig.id, signerUserId: p.student.userId, signerName: "عضو" } });
      }
      ok(`اجتماع رقم 1 بحضور ${meeting.attendance.length} متدربين + توقيع عضوين`);
      await expectUniqueViolation(tx, "رقم الاجتماع لا يتكرر لنفس المشرف والمؤسسة والفصل", () =>
        tx.supervisionMeeting.create({ data: { termId: placement.termId, organizationId: placement.organizationId, academicSupervisorId: placement.academicSupervisorId!, number: 1, meetingDate: new Date() } })
      );

      console.log("6) كشف الحضور اليومي الموقَّع");
      const rec = await tx.attendanceRecord.findFirstOrThrow({ where: { placementId: placement.id, checkInAt: { not: null } } });
      const sheet = await tx.attendanceSheet.create({ data: { organizationId: placement.organizationId, sheetDate: rec.date, weekNumber: 1, fieldSupervisorId: placement.fieldSupervisorId, records: { connect: [{ id: rec.id }] } }, include: { records: true } });
      assert.equal(sheet.records.length, 1);
      ok("كشف حضور للمؤسسة يربط سجلات التحضير الجغرافي باليوم");
      await expectUniqueViolation(tx, "كشف واحد لكل مؤسسة في اليوم", () => tx.attendanceSheet.create({ data: { organizationId: placement.organizationId, sheetDate: rec.date } }));

      console.log("7) الحذف المتسلسل");
      await tx.fieldForm.delete({ where: { id: cs.id } });
      assert.equal(await tx.caseFamilyMember.count({ where: { caseStudyId: cs.caseStudy!.id } }), 0);
      const orphanInterviews = await tx.interviewRecord.findMany({ where: { form: { placementId: placement.id } } });
      assert.equal(orphanInterviews.length, 2);
      assert.ok(orphanInterviews.every((i) => i.caseStudyId === null));
      ok("حذف دراسة الحالة يحذف التكوين الأسري ويُبقي المقابلات (يفك الارتباط فقط)");
      await tx.fieldForm.delete({ where: { id: commencement.id } });
      assert.equal(await tx.formSignature.count({ where: { formId: commencement.id } }), 0);
      ok("حذف النموذج يحذف خانات توقيعه");

      throw ROLLBACK;
    }, { timeout: 60_000 })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });

  // الثابت الصحيح: لا تغيّر في البيانات بعد الإلغاء (القاعدة قد تحتوي نماذج حقيقية)
  assert.equal(await prisma.fieldForm.count(), formsBefore, "يجب ألا تبقى بيانات بعد الإلغاء");
  console.log(`\n✅ ${passed} فحصاً ناجحاً — وأُلغيت المعاملة (لم تُكتب أي بيانات)`);
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
