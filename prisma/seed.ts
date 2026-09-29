// بيانات تجريبية لتشغيل المنصة وعرضها. كل الأسماء (عدا رئيس القسم ورئيس الوحدة) وهمية،
// وإحداثيات الجهات تقريبية داخل بريدة/عنيزة ويجب تحديثها بالإحداثيات الفعلية قبل التشغيل.
import { PrismaClient, type Gender, type Major, type OrgCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { riyadhDateOnly } from "../src/lib/time";
import { calculateFinalGrade, scoreEvaluation } from "../src/lib/grading/engine";
import { validateContent } from "../src/lib/report-templates";
import { signedPayload } from "../src/lib/report-signing";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const PASSWORD = "Qu@12345";

// مولد أرقام شبه عشوائية ثابت (نفس النتائج في كل تشغيل)
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const jitter = (m: number) => (rand() - 0.5) * (m / 55_000); // إزاحة تقريبية بالمتر

async function main() {
  console.log("🧹 تنظيف البيانات...");
  // الترتيب مهم بسبب العلاقات
  await prisma.$transaction([
    // النماذج الرسمية (تتسلسل حذفاً إلى جداولها التفصيلية)
    prisma.formSignature.deleteMany(), prisma.attachment.deleteMany(), prisma.formComment.deleteMany(),
    prisma.fieldForm.deleteMany(), prisma.supervisionMeeting.deleteMany(), prisma.attendanceSheet.deleteMany(),
    prisma.courseSection.deleteMany(),
    prisma.auditLog.deleteMany(), prisma.alert.deleteMany(), prisma.finalGrade.deleteMany(),
    prisma.evaluationItem.deleteMany(), prisma.evaluation.deleteMany(), prisma.evaluationCriterion.deleteMany(),
    prisma.logbook.deleteMany(), prisma.fieldReport.deleteMany(), prisma.signature.deleteMany(),
    prisma.task.deleteMany(), prisma.supervisorNote.deleteMany(), prisma.supervisionVisit.deleteMany(),
    prisma.attendanceAttempt.deleteMany(), prisma.attendanceRecord.deleteMany(), prisma.letter.deleteMany(),
    prisma.placement.deleteMany(), prisma.trainingPreference.deleteMany(), prisma.fieldSupervisorProfile.deleteMany(),
    prisma.academicSupervisorProfile.deleteMany(), prisma.studentProfile.deleteMany(), prisma.organization.deleteMany(),
    prisma.academicTerm.deleteMany(), prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ---------- الفصل الدراسي (نسبي لتاريخ اليوم: بدأ قبل 3 أسابيع ويستمر 14 أسبوعاً) ----------
  const today = riyadhDateOnly();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 21 - start.getUTCDay()); // أحد قبل 3 أسابيع
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 14 * 7 - 3);
  const term = await prisma.academicTerm.create({
    data: { name: "الفصل الدراسي الأول 1448هـ", startDate: start, endDate: end, requiredHours: 180, isActive: true },
  });

  // ---------- القيادات ----------
  const mkUser = (email: string, fullName: string, role: "DEPARTMENT_HEAD" | "TRAINING_HEAD" | "ADMIN" | "ACADEMIC_SUPERVISOR" | "FIELD_SUPERVISOR" | "STUDENT", gender: Gender = "MALE", phone?: string) =>
    prisma.user.create({ data: { email, fullName, role, gender, passwordHash, phone } });

  await mkUser("omar.alnamlah@qu.edu.sa", "د. عمر النملة", "DEPARTMENT_HEAD");
  await mkUser("bushra.aldubaikhi@qu.edu.sa", "بشرى محمد الدبيخي", "TRAINING_HEAD");
  await mkUser("admin@qu.edu.sa", "مدير النظام", "ADMIN");

  // ---------- المشرفون الأكاديميون ----------
  const academicsData: [string, string, Gender, string][] = [
    ["academic1@qu.edu.sa", "د. خالد العتيبي", "MALE", "أستاذ مشارك"],
    ["academic2@qu.edu.sa", "د. نورة الحربي", "FEMALE", "أستاذ مساعد"],
    ["academic3@qu.edu.sa", "د. سلطان الرشيدي", "MALE", "أستاذ مساعد"],
    ["academic4@qu.edu.sa", "د. هيا السبيعي", "FEMALE", "أستاذ مشارك"],
  ];
  const academics = [];
  for (const [email, name, gender, rank] of academicsData) {
    const u = await mkUser(email, name, "ACADEMIC_SUPERVISOR", gender, "0163800000");
    academics.push(await prisma.academicSupervisorProfile.create({ data: { userId: u.id, academicRank: rank, maxStudents: 12 } }));
  }
  const maleAcademics = academics.filter((_, i) => academicsData[i][2] === "MALE");
  const femaleAcademics = academics.filter((_, i) => academicsData[i][2] === "FEMALE");

  // ---------- جهات التدريب ----------
  const orgsData: { name: string; category: OrgCategory; city: string; lat: number; lng: number; scope: "MALE_ONLY" | "FEMALE_ONLY" | "BOTH"; majors: Major[]; cm: number; cf: number; title: string; sup: [string, string, Gender] }[] = [
    { name: "مستشفى بريدة المركزي - قسم الخدمة الاجتماعية الطبية", category: "MEDICAL", city: "بريدة", lat: 26.3415, lng: 43.9632, scope: "BOTH", majors: ["SOCIAL_WORK"], cm: 4, cf: 4, title: "سعادة مدير", sup: ["field1@example.sa", "أ. فهد المطيري", "MALE"] },
    { name: "جمعية البر الخيرية ببريدة", category: "CHARITY", city: "بريدة", lat: 26.3592, lng: 43.9818, scope: "MALE_ONLY", majors: [], cm: 4, cf: 0, title: "سعادة مدير", sup: ["field2@example.sa", "أ. عبدالرحمن الدخيل", "MALE"] },
    { name: "جمعية رعاية الأيتام بالقصيم", category: "ORPHAN_CARE", city: "بريدة", lat: 26.3301, lng: 43.9905, scope: "FEMALE_ONLY", majors: ["SOCIAL_WORK"], cm: 0, cf: 4, title: "سعادة مديرة", sup: ["field3@example.sa", "أ. منيرة القحطاني", "FEMALE"] },
    { name: "دار رعاية المسنين بعنيزة", category: "ELDERLY_CARE", city: "عنيزة", lat: 26.0842, lng: 43.9935, scope: "BOTH", majors: ["SOCIAL_WORK"], cm: 3, cf: 3, title: "سعادة مدير", sup: ["field4@example.sa", "أ. صالح الجربوع", "MALE"] },
    { name: "مركز الإرشاد الأسري بالقصيم", category: "FAMILY_COUNSELING", city: "بريدة", lat: 26.3187, lng: 43.9551, scope: "FEMALE_ONLY", majors: [], cm: 0, cf: 4, title: "سعادة مديرة", sup: ["field5@example.sa", "أ. لطيفة الشمري", "FEMALE"] },
    { name: "مركز الدراسات والبحوث الاجتماعية", category: "RESEARCH_CENTER", city: "بريدة", lat: 26.3478, lng: 43.7669, scope: "BOTH", majors: ["SOCIOLOGY"], cm: 5, cf: 5, title: "سعادة مدير", sup: ["field6@example.sa", "د. ماجد الفوزان", "MALE"] },
    { name: "مكتب التعليم - الإرشاد الطلابي ببريدة", category: "SCHOOL", city: "بريدة", lat: 26.3369, lng: 43.9723, scope: "BOTH", majors: [], cm: 4, cf: 4, title: "سعادة مدير", sup: ["field7@example.sa", "أ. سارة العمر", "FEMALE"] },
    { name: "مركز التأهيل الشامل ببريدة", category: "DISABILITY_CARE", city: "بريدة", lat: 26.3625, lng: 43.9489, scope: "BOTH", majors: ["SOCIAL_WORK", "SOCIOLOGY"], cm: 3, cf: 3, title: "سعادة مدير", sup: ["field8@example.sa", "أ. ناصر البريدي", "MALE"] },
  ];
  const orgs = [];
  for (const o of orgsData) {
    const org = await prisma.organization.create({
      data: {
        name: o.name, category: o.category, city: o.city, address: `${o.city} - منطقة القصيم`, latitude: o.lat, longitude: o.lng,
        geofenceRadius: 100, genderScope: o.scope, acceptedMajors: o.majors, capacityMale: o.cm, capacityFemale: o.cf,
        contactTitle: o.title, contactName: o.sup[1], contactPhone: "0163000000", workStartTime: "08:00", workEndTime: "13:00",
      },
    });
    const u = await mkUser(o.sup[0], o.sup[1], "FIELD_SUPERVISOR", o.sup[2], "0500000000");
    const sup = await prisma.fieldSupervisorProfile.create({ data: { userId: u.id, organizationId: org.id, jobTitle: "أخصائي اجتماعي أول" } });
    orgs.push({ ...org, supervisorId: sup.id });
  }

  // ---------- الطلاب ----------
  const maleNames = ["محمد العنزي", "عبدالعزيز الحربي", "فيصل السهلي", "تركي الدوسري", "يوسف الخالدي", "بندر الشهري", "سعد القرني", "راكان المالكي", "نواف الجهني", "عمر الزهراني", "ماجد البقمي", "أحمد الغامدي"];
  const femaleNames = ["ريم العتيبي", "شهد الحربي", "لمى السديري", "أمل الرشيد", "نوف المطيري", "جود القحطاني", "رهف الشمري", "دانة العمري", "غدير الفهيد", "حصة الوهيبي", "منار السالم", "ليان البراك"];
  const students: { id: string; userId: string; gender: Gender; major: Major; name: string }[] = [];
  let seq = 441100001;
  for (const [names, gender] of [[maleNames, "MALE"], [femaleNames, "FEMALE"]] as const) {
    for (let i = 0; i < names.length; i++) {
      const major: Major = i % 2 === 0 ? "SOCIAL_WORK" : "SOCIOLOGY";
      const uid = String(seq++);
      const u = await mkUser(`${uid}@qu.edu.sa`, names[i], "STUDENT", gender, "05" + uid.slice(-8));
      const sp = await prisma.studentProfile.create({
        data: {
          userId: u.id, universityId: uid, major, gender, level: 7, gpa: Math.round((3 + rand() * 2) * 100) / 100,
          city: pick(["بريدة", "بريدة", "عنيزة", "البكيرية"]), homeLat: 26.33 + jitter(8000), homeLng: 43.97 + jitter(8000),
        },
      });
      students.push({ id: sp.id, userId: u.id, gender, major, name: names[i] });
    }
  }

  // ---------- بنود التقييم ----------
  const fieldCriteria: [string, string, number][] = [
    ["الانضباط والالتزام", "الالتزام بمواعيد الحضور والانصراف", 10],
    ["الانضباط والالتزام", "الالتزام بأنظمة الجهة ولوائحها", 5],
    ["الانضباط والالتزام", "المظهر العام والسلوك المهني", 5],
    ["العلاقات المهنية", "العلاقة مع المستفيدين وفق أخلاقيات المهنة", 10],
    ["العلاقات المهنية", "العلاقة مع فريق العمل والتعاون", 5],
    ["العلاقات المهنية", "تقبل التوجيه والإشراف والاستفادة منه", 5],
    ["المهارات المهنية", "مهارات المقابلة والاتصال", 10],
    ["المهارات المهنية", "جمع البيانات وتحليل المواقف", 10],
    ["المهارات المهنية", "التوثيق وكتابة التقارير والسجلات", 10],
    ["الإنجاز والمبادرة", "إنجاز المهام المسندة بجودة وفي وقتها", 10],
    ["الإنجاز والمبادرة", "المبادرة والإبداع في تقديم الأفكار", 10],
    ["الإنجاز والمبادرة", "القدرة على حل المشكلات", 10],
  ];
  const academicCriteria: [string, string, number, Major | null][] = [
    ["السجلات والتقارير الدورية", "انتظام رفع السجلات الأسبوعية وجودتها", 10, null],
    ["السجلات والتقارير الدورية", "الالتزام بحضور اللقاءات الإشرافية", 10, null],
    ["التطبيق المهني", "دراسة الحالة وخطة التدخل المهني", 30, "SOCIAL_WORK"],
    ["التطبيق المهني", "البحث الميداني / المسح الاجتماعي", 30, "SOCIOLOGY"],
    ["التقرير النهائي", "بناء التقرير النهائي ومنهجيته", 15, null],
    ["التقرير النهائي", "ربط الإطار النظري بالممارسة الميدانية", 15, null],
    ["العرض والمناقشة", "العرض الشفهي والمناقشة", 20, null],
  ];
  const fieldCrit = await Promise.all(
    fieldCriteria.map(([section, label, maxScore], order) => prisma.evaluationCriterion.create({ data: { termId: term.id, type: "FIELD", section, label, maxScore, order } }))
  );
  const acadCrit = await Promise.all(
    academicCriteria.map(([section, label, maxScore, major], order) => prisma.evaluationCriterion.create({ data: { termId: term.id, type: "ACADEMIC", section, label, maxScore, order, major } }))
  );

  // ---------- التوزيع (20 طالباً موزعون، 4 بلا توزيع لتجربة التوزيع الآلي) ----------
  const capacity = new Map(orgs.map((o) => [o.id, { MALE: o.capacityMale, FEMALE: o.capacityFemale }]));
  const placedStudents = students.filter((_, i) => i % 6 !== 5);
  const unplaced = students.filter((_, i) => i % 6 === 5);
  const placements = [];
  let mi = 0, fi = 0;
  for (const s of placedStudents) {
    const org = orgs.find(
      (o) => capacity.get(o.id)![s.gender] > 0 && (o.acceptedMajors.length === 0 || o.acceptedMajors.includes(s.major))
    )!;
    capacity.get(org.id)![s.gender]--;
    const academic = s.gender === "MALE" ? maleAcademics[mi++ % maleAcademics.length] : femaleAcademics[fi++ % femaleAcademics.length];
    placements.push({
      ...(await prisma.placement.create({
        data: {
          studentId: s.id, termId: term.id, organizationId: org.id, fieldSupervisorId: org.supervisorId, academicSupervisorId: academic.id,
          startDate: start, endDate: end, requiredHours: 180, workDays: [0, 1, 2, 3], status: "ACTIVE",
        },
      })),
      org,
      student: s,
    });
  }
  for (const s of unplaced) {
    await prisma.trainingPreference.createMany({
      data: [
        { studentId: s.id, termId: term.id, rank: 1, category: s.major === "SOCIAL_WORK" ? "MEDICAL" : "RESEARCH_CENTER" },
        { studentId: s.id, termId: term.id, rank: 2, category: "SCHOOL" },
      ],
    });
  }

  // ---------- الشعب: ميداني وبالمحاكاة ----------
  const fieldSection = await prisma.courseSection.create({
    data: { termId: term.id, courseName: "التدريب الميداني (1)", courseCode: "SOC 481", sectionNumber: "4810", trainingNumber: 1, mode: "FIELD" },
  });
  const simSection = await prisma.courseSection.create({
    data: { termId: term.id, courseName: "التدريب الميداني بالمحاكاة", courseCode: "SOC 482", sectionNumber: "4820", trainingNumber: 1, mode: "SIMULATION", academicSupervisorId: academics[0].id },
  });
  await prisma.placement.updateMany({ where: { termId: term.id }, data: { sectionId: fieldSection.id } });

  // ---------- طلاب المحاكاة: مختبر المحاكاة بالقسم (غير متاح للتوزيع الميداني) ----------
  const simLab = await prisma.organization.create({
    data: {
      name: "مختبر المحاكاة المهنية بالقسم", category: "OTHER", city: "بريدة", address: "جامعة القصيم — المليداء",
      latitude: 26.3489, longitude: 43.7668, geofenceRadius: 100, genderScope: "BOTH", acceptedMajors: [], capacityMale: 20, capacityFemale: 20,
      isApproved: false, notes: "مقر افتراضي لطلاب التدريب بالمحاكاة — لا تحضير جغرافي",
    },
  });
  for (const [uid, name, gender, major, academic] of [
    ["441100025", "سلمان العنزي", "MALE", "SOCIOLOGY", maleAcademics[0]],
    ["441100026", "هند الدوسري", "FEMALE", "SOCIAL_WORK", femaleAcademics[0]],
  ] as const) {
    const u = await mkUser(`${uid}@qu.edu.sa`, name, "STUDENT", gender, "05" + uid.slice(-8));
    const sp = await prisma.studentProfile.create({ data: { userId: u.id, universityId: uid, major, gender, level: 7, gpa: 4.1, city: "بريدة" } });
    await prisma.placement.create({
      data: {
        studentId: sp.id, termId: term.id, organizationId: simLab.id, academicSupervisorId: academic.id, sectionId: simSection.id,
        startDate: start, endDate: end, requiredHours: 180, workDays: [0, 1, 2, 3], status: "ACTIVE", commencedAt: start,
      },
    });
  }

  // ---------- سجل الحضور التاريخي ----------
  const riyadh = (day: Date, h: number, m: number) => new Date(day.getTime() + ((h - 3) * 60 + m) * 60_000);
  const absentStreakStudent = placements[3].id; // حالة حرجة تجريبية
  for (const p of placements) {
    const records = [];
    for (let d = new Date(start); d < today; d.setUTCDate(d.getUTCDate() + 1)) {
      if (!p.workDays.includes(d.getUTCDay())) continue;
      const day = new Date(d);
      const daysAgo = Math.round((today.getTime() - day.getTime()) / 86_400_000);
      const streak = p.id === absentStreakStudent && daysAgo <= 6;
      const r = rand();
      if (streak || r < 0.06) {
        records.push({ placementId: p.id, date: day, status: "ABSENT" as const, approvalStatus: "APPROVED" as const });
        continue;
      }
      const late = r > 0.9;
      const inAt = riyadh(day, late ? 8 : 7, late ? 25 + Math.floor(rand() * 20) : 45 + Math.floor(rand() * 14));
      const outAt = riyadh(day, 12, 30 + Math.floor(rand() * 40));
      const suspicious = rand() < 0.03;
      records.push({
        placementId: p.id, date: day, status: late ? ("LATE" as const) : ("PRESENT" as const),
        checkInAt: inAt, checkInLat: p.org.latitude + jitter(60), checkInLng: p.org.longitude + jitter(60), checkInAccuracy: 8 + rand() * 20, checkInDistance: 10 + rand() * 60,
        checkOutAt: outAt, checkOutLat: p.org.latitude + jitter(60), checkOutLng: p.org.longitude + jitter(60), checkOutAccuracy: 8 + rand() * 20, checkOutDistance: 10 + rand() * 60,
        workedMinutes: Math.round((outAt.getTime() - inAt.getTime()) / 60000),
        approvalStatus: daysAgo <= 2 ? ("PENDING" as const) : ("APPROVED" as const),
        isSuspicious: suspicious, riskScore: suspicious ? 35 : 0, riskFlags: suspicious ? ["ZERO_JITTER"] : [],
      });
    }
    await prisma.attendanceRecord.createMany({ data: records });
    const agg = await prisma.attendanceRecord.aggregate({
      where: { placementId: p.id, approvalStatus: "APPROVED", status: { in: ["PRESENT", "LATE"] } },
      _sum: { workedMinutes: true },
    });
    await prisma.placement.update({ where: { id: p.id }, data: { approvedMinutes: agg._sum.workedMinutes ?? 0 } });
  }

  // تحضير اليوم (لبعض الطلاب) لإظهار اللوحة اللحظية
  if ([0, 1, 2, 3].includes(today.getUTCDay())) {
    for (const p of placements.slice(0, 12)) {
      if (p.id === absentStreakStudent) continue;
      await prisma.attendanceRecord.create({
        data: {
          placementId: p.id, date: today, status: rand() > 0.85 ? "LATE" : "PRESENT",
          checkInAt: riyadh(today, 7, 50 + Math.floor(rand() * 9)), checkInLat: p.org.latitude + jitter(50), checkInLng: p.org.longitude + jitter(50),
          checkInAccuracy: 12, checkInDistance: 15 + rand() * 50,
        },
      });
    }
  }

  // ---------- السجلات الأسبوعية ----------
  for (const p of placements) {
    for (let w = 1; w <= 3; w++) {
      if (rand() < 0.2) continue;
      const ps = new Date(start); ps.setUTCDate(ps.getUTCDate() + (w - 1) * 7);
      const pe = new Date(ps); pe.setUTCDate(pe.getUTCDate() + 3);
      await prisma.logbook.create({
        data: {
          placementId: p.id, type: "WEEKLY", weekNumber: w, periodStart: ps, periodEnd: pe,
          activities: p.student.major === "SOCIAL_WORK"
            ? "حضور اجتماع الفريق متعدد التخصصات، إجراء مقابلة أولية مع حالة جديدة وتعبئة استمارة البيانات الأولية، متابعة خطة التدخل لحالتين."
            : "المشاركة في تصميم استمارة المسح الاجتماعي، تطبيق الاستمارة على عينة تجريبية، إدخال البيانات ومراجعتها مع المشرف.",
          skills: "مهارات المقابلة المهنية والتوثيق",
          reflections: "لاحظت أهمية بناء العلاقة المهنية في المراحل الأولى لنجاح التدخل.",
          status: w === 3 ? "SUBMITTED" : "SIGNED", submittedAt: new Date(),
        },
      });
    }
  }

  // ---------- تقييمات مرصودة لبعض الطلاب + احتساب الدرجات ----------
  const leader = await prisma.user.findUniqueOrThrow({ where: { email: "bushra.aldubaikhi@qu.edu.sa" } });
  for (const p of placements.slice(0, 8)) {
    const level = 0.7 + rand() * 0.3;
    const fieldUser = await prisma.fieldSupervisorProfile.findUniqueOrThrow({ where: { id: p.org.supervisorId } });
    const fItems = fieldCrit.map((c) => ({ criterionId: c.id, score: Math.min(c.maxScore, Math.round(c.maxScore * (level + (rand() - 0.5) * 0.1) * 2) / 2), maxScore: c.maxScore }));
    const fs = scoreEvaluation(fItems);
    await prisma.evaluation.create({
      data: {
        placementId: p.id, evaluatorId: fieldUser.userId, type: "FIELD", status: "SUBMITTED", submittedAt: new Date(),
        rawScore: fs.raw, maxScore: fs.max, percentage: fs.percentage, strengths: "التزام عالٍ وحسن تعامل مع المستفيدين",
        items: { create: fItems.map(({ criterionId, score }) => ({ criterionId, score })) },
      },
    });
    const acad = await prisma.academicSupervisorProfile.findUniqueOrThrow({ where: { id: p.academicSupervisorId! } });
    const aCrit = acadCrit.filter((c) => c.major == null || c.major === p.student.major);
    const aItems = aCrit.map((c) => ({ criterionId: c.id, score: Math.min(c.maxScore, Math.round(c.maxScore * (level - 0.05 + rand() * 0.1) * 2) / 2), maxScore: c.maxScore }));
    const as = scoreEvaluation(aItems);
    await prisma.evaluation.create({
      data: {
        placementId: p.id, evaluatorId: acad.userId, type: "ACADEMIC", status: "SUBMITTED", submittedAt: new Date(),
        rawScore: as.raw, maxScore: as.max, percentage: as.percentage,
        items: { create: aItems.map(({ criterionId, score }) => ({ criterionId, score })) },
      },
    });
    const weekly = await prisma.logbook.count({ where: { placementId: p.id, type: "WEEKLY", status: { in: ["SUBMITTED", "SIGNED"] } } });
    const absences = await prisma.attendanceRecord.count({ where: { placementId: p.id, status: "ABSENT" } });
    const pl = await prisma.placement.findUniqueOrThrow({ where: { id: p.id } });
    const g = calculateFinalGrade({
      weights: { fieldWeight: 40, academicWeight: 40, attendanceWeight: 20 },
      fieldPercentage: fs.percentage, academicPercentage: as.percentage,
      approvedMinutes: pl.approvedMinutes * 4, // محاكاة نهاية الفصل
      requiredHours: 180, expectedWeeklyLogbooks: 3, submittedWeeklyLogbooks: weekly, unexcusedAbsences: absences,
    });
    await prisma.finalGrade.create({
      data: {
        placementId: p.id, fieldComponent: g.fieldComponent, academicComponent: g.academicComponent, attendanceComponent: g.attendanceComponent,
        total: g.total, letterGrade: g.letterGrade, breakdown: { ...g.details, passed: g.passed },
        ...(placements.indexOf(p) < 3 ? { status: "PUBLISHED", approvedById: leader.id, approvedAt: new Date() } : {}),
      },
    });
  }

  // ---------- تقارير ميدانية نموذجية ----------
  // توقيع نموذجي (PNG) لأغراض العرض
  const SIG = readFileSync(path.join(__dirname, "fixtures/sample-signature.txt"), "utf8").trim();
  const sw = placements.find((p) => p.student.major === "SOCIAL_WORK")!;
  const so = placements.find((p) => p.student.major === "SOCIOLOGY")!;
  const d = (days: number) => new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10);

  const caseContent = validateContent("CASE_STUDY", {
    caseCode: "الحالة (م)", gender: "ذكر", age: 58, maritalStatus: "متزوج/ة", education: "ثانوي", occupation: "متقاعد",
    referralSource: "تحويل داخلي", firstContact: d(14),
    presentingProblem: "يعاني العميل من اكتئاب وانسحاب اجتماعي بعد تشخيصه بمرض مزمن، مع رفض الالتزام بالخطة العلاجية.",
    problemHistory: "بدأت الأعراض قبل ستة أشهر عقب التشخيص، وتفاقمت بعد التقاعد وقلة التواصل مع الأبناء.",
    interviews: [
      { date: d(14), source: "العميل", purpose: "مقابلة أولية وبناء علاقة مهنية", outcome: "إبداء رغبة مبدئية في التعاون" },
      { date: d(10), source: "الأسرة", purpose: "فهم البيئة الأسرية", outcome: "ضعف التواصل الأسري وقلق الزوجة" },
      { date: d(7), source: "فريق العمل", purpose: "التنسيق مع الطبيب المعالج", outcome: "أهمية الالتزام بالعلاج الدوائي" },
    ],
    familyContext: "يعيش مع زوجته، وللأسرة أربعة أبناء متزوجون يقيمون خارج المدينة.",
    socioEconomic: "دخل تقاعدي كافٍ، ولا توجد صعوبات مادية مؤثرة.",
    strengths: "دعم الزوجة، التدين، خبرة حياتية طويلة، وثقة بالفريق الطبي.",
    diagnosis: "اضطراب تكيفي مع مزاج مكتئب مرتبط بالمرض المزمن وفقدان الدور بعد التقاعد.",
    theoreticalModel: "المعرفي السلوكي",
    modelJustification: "لوجود أفكار سلبية تلقائية حول المرض والمستقبل قابلة للتعديل.",
    plan: [
      { goal: "تحسين الالتزام بالخطة العلاجية", techniques: "التثقيف الصحي والتعاقد", timeline: "أسبوعان", indicator: "انتظام المواعيد" },
      { goal: "تعديل الأفكار السلبية", techniques: "إعادة البناء المعرفي", timeline: "3 أسابيع", indicator: "مقياس بيك قبلي/بعدي" },
      { goal: "تعزيز المساندة الأسرية", techniques: "مقابلة أسرية مشتركة", timeline: "أسبوع", indicator: "زيارات الأبناء" },
    ],
    progress: "تحسن ملحوظ في الالتزام بالمواعيد وانخفاض درجة الاكتئاب على المقياس.",
    evaluation: "تمكنت من تطبيق مهارات المقابلة والتعاقد، وأحتاج لتطوير مهارة إدارة الجلسات الأسرية.",
    recommendations: "المتابعة الشهرية وإحالة الأسرة لبرنامج الدعم النفسي بالمستشفى.",
    consent: true,
  }, true);
  const signedAt = new Date(today.getTime() - 2 * 86_400_000);
  const caseReport = await prisma.fieldReport.create({
    data: { placementId: sw.id, template: "CASE_STUDY", title: "دراسة حالة لمريض مزمن يعاني من انسحاب اجتماعي", content: caseContent.content as object, status: "SUBMITTED", submittedAt: new Date(today.getTime() - 3 * 86_400_000) },
  });
  const swSup = await prisma.fieldSupervisorProfile.findUniqueOrThrow({ where: { id: sw.org.supervisorId } });
  const sig = await prisma.signature.create({
    data: {
      signerId: swSup.userId, imageData: SIG, signedAt,
      contentHash: createHash("sha256").update(JSON.stringify(signedPayload(caseReport))).digest("hex"),
    },
  });
  await prisma.fieldReport.update({ where: { id: caseReport.id }, data: { status: "SIGNED", signatureId: sig.id, fieldComment: "دراسة جيدة وواقعية، وتعكس ما تم فعلاً مع الحالة." } });

  const surveyContent = validateContent("SOCIAL_SURVEY", {
    surveyTitle: "اتجاهات المستفيدين نحو الخدمات الاجتماعية المقدمة", objective: "قياس رضا المستفيدين وتحديد أولويات التطوير.",
    area: "مدينة بريدة", population: "المستفيدون المسجلون لدى الجهة", sampleMethod: "عشوائية بسيطة", sampleSize: 120, responses: 97,
    instrument: "استبانة إلكترونية", period: "أسبوعان",
    variables: [
      { name: "الجنس", kind: "ديموغرافي", measure: "اسمي" },
      { name: "مدة الاستفادة", kind: "مستقل", measure: "رتبي (أقل من سنة، 1-3، أكثر من 3)" },
      { name: "الرضا عن الخدمات", kind: "تابع", measure: "مقياس ليكرت خماسي" },
    ],
    indicators: [
      { indicator: "راضون جداً", count: 31, percent: 32 },
      { indicator: "راضون", count: 42, percent: 43.3 },
      { indicator: "محايدون", count: 15, percent: 15.5 },
      { indicator: "غير راضين", count: 9, percent: 9.2 },
    ],
    keyFindings: "ثلاثة أرباع المستفيدين راضون، وتتركز الملاحظات حول طول مدة الانتظار.",
    limitations: "اقتصار العينة على المستفيدين الحاليين دون المنقطعين.",
    recommendations: "تطوير نظام المواعيد الإلكتروني، ودراسة أسباب انقطاع المستفيدين.",
  }, true);
  await prisma.fieldReport.create({
    data: { placementId: so.id, template: "SOCIAL_SURVEY", title: "مسح رضا المستفيدين عن الخدمات الاجتماعية", content: surveyContent.content as object, status: "SUBMITTED", submittedAt: new Date(today.getTime() - 86_400_000) },
  });
  await prisma.fieldReport.create({
    data: { placementId: sw.id, template: "FINAL_REPORT", title: "التقرير الختامي للتدريب الميداني", content: { orgOverview: "مستشفى حكومي يقدم خدمات علاجية..." } },
  });

  // ---------- خطابات توجيه صادرة ----------
  let n = 1;
  for (const p of placements) {
    await prisma.letter.create({
      data: {
        placementId: p.id, type: "REFERRAL", issuedById: leader.id,
        serialNumber: `FT-${new Date().getFullYear()}-${String(n++).padStart(6, "0")}`,
        verificationCode: Math.random().toString(36).slice(2, 14),
        issuedAt: new Date(start.getTime() - 5 * 86_400_000),
      },
    });
  }

  // ---------- مهام وملاحظات ----------
  for (const p of placements.slice(0, 10)) {
    const fs = await prisma.fieldSupervisorProfile.findUniqueOrThrow({ where: { id: p.org.supervisorId } });
    await prisma.task.create({
      data: {
        placementId: p.id, assignedById: fs.userId,
        title: p.student.major === "SOCIAL_WORK" ? "إعداد دراسة حالة متكاملة لإحدى الحالات" : "تحليل نتائج المسح الاجتماعي الأولي",
        dueDate: new Date(today.getTime() + 10 * 86_400_000),
      },
    });
    await prisma.supervisorNote.create({ data: { placementId: p.id, authorId: fs.userId, content: "أداء جيد، ونوصي بالتركيز على توثيق المقابلات أولاً بأول." } });
  }

  // ---------- تنبيهات ----------
  const streakP = placements.find((p) => p.id === absentStreakStudent)!;
  await prisma.alert.create({
    data: {
      type: "CONSECUTIVE_ABSENCE", severity: "CRITICAL", placementId: streakP.id,
      title: `غياب متتالٍ: ${streakP.student.name}`, message: `تغيب عدة أيام متتالية عن ${streakP.org.name}`,
    },
  });
  const sus = await prisma.attendanceRecord.findFirst({ where: { isSuspicious: true }, include: { placement: { include: { student: { include: { user: true } }, organization: true } } } });
  if (sus) {
    await prisma.alert.create({
      data: {
        type: "SUSPICIOUS_GPS", severity: "WARNING", placementId: sus.placementId,
        title: `اشتباه تحضير وهمي - ${sus.placement.student.user.fullName}`, message: `${sus.placement.organization.name}: إحداثيات ثابتة تماماً بين القراءات`,
      },
    });
  }

  console.log("✅ تمت تعبئة البيانات التجريبية");
  console.log(`   كلمة المرور لجميع الحسابات: ${PASSWORD}`);
  console.log("   رئيس القسم:            omar.alnamlah@qu.edu.sa");
  console.log("   رئيسة وحدة التدريب:    bushra.aldubaikhi@qu.edu.sa");
  console.log("   مشرف أكاديمي:          academic1@qu.edu.sa");
  console.log("   مشرف ميداني:           field1@example.sa");
  console.log("   طالب:                  441100001@qu.edu.sa");
  console.log("   طالب (محاكاة):         441100025@qu.edu.sa · 441100026@qu.edu.sa");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
