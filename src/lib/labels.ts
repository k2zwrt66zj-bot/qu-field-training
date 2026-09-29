import type { AttendanceStatus, Major, OrgCategory, PlacementStatus, Role, ReportTemplate, ApprovalStatus } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "طالب / طالبة",
  FIELD_SUPERVISOR: "مشرف ميداني",
  ACADEMIC_SUPERVISOR: "مشرف أكاديمي",
  TRAINING_HEAD: "رئيسة وحدة التدريب الميداني",
  DEPARTMENT_HEAD: "رئيس القسم",
  ADMIN: "مدير النظام",
};

export const ROLE_HOME: Record<Role, string> = {
  STUDENT: "/student",
  FIELD_SUPERVISOR: "/field-supervisor",
  ACADEMIC_SUPERVISOR: "/academic-supervisor",
  TRAINING_HEAD: "/training-head",
  DEPARTMENT_HEAD: "/department-head",
  ADMIN: "/training-head",
};

export const MAJOR_LABELS: Record<Major, string> = {
  SOCIOLOGY: "علم الاجتماع",
  SOCIAL_WORK: "الخدمة الاجتماعية",
};

export const ORG_CATEGORY_LABELS: Record<OrgCategory, string> = {
  MEDICAL: "خدمة طبية",
  ORPHAN_CARE: "رعاية أيتام",
  ELDERLY_CARE: "رعاية مسنين",
  DISABILITY_CARE: "رعاية ذوي الإعاقة",
  SCHOOL: "مدارس وإرشاد طلابي",
  CHARITY: "جمعيات خيرية",
  FAMILY_COUNSELING: "إرشاد أسري",
  JUVENILE_CARE: "رعاية الأحداث",
  PRISON_CARE: "إصلاحيات",
  ADDICTION_RECOVERY: "علاج الإدمان",
  RESEARCH_CENTER: "مراكز بحثية",
  GOVERNMENT: "جهات حكومية",
  OTHER: "أخرى",
};

export const PLACEMENT_STATUS_LABELS: Record<PlacementStatus, string> = {
  DRAFT: "مقترح",
  ASSIGNED: "بانتظار المباشرة",
  ACTIVE: "على رأس التدريب",
  COMPLETED: "مكتمل",
  WITHDRAWN: "منسحب",
  SUSPENDED: "موقوف",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "حاضر",
  LATE: "متأخر",
  ABSENT: "غائب",
  EXCUSED: "غياب بعذر",
  HOLIDAY: "إجازة",
};

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
};

export const REPORT_TEMPLATE_LABELS: Record<ReportTemplate, string> = {
  CASE_STUDY: "دراسة حالة",
  SOCIAL_INTERVENTION: "خطة تدخل اجتماعي",
  GROUP_WORK: "خدمة الجماعة",
  FIELD_RESEARCH: "بحث ميداني",
  SOCIAL_SURVEY: "مسح اجتماعي",
  FINAL_REPORT: "التقرير الختامي",
};

/** بيانات الجهة الرسمية المستخدمة في الخطابات والترويسة */
/** بيانات الجهة الرسمية كما وردت في ترويسة «نماذج التدريب الميداني لمرحلة البكالوريوس» */
export const INSTITUTION = {
  country: "المملكة العربية السعودية",
  ministry: "وزارة التعليم",
  university: "جامعة القصيم",
  college: "كلية اللغات والعلوم الإنسانية",
  department: "قسم الاجتماع والخدمة الاجتماعية",
  unit: "وحدة التدريب الميداني",
  departmentHead: "د. عمر النملة",
  trainingHead: "د. بشرى محمد الدبيخي",
  // الترويسة الإنجليزية كما في النماذج الرسمية
  en: {
    country: "Kingdom of Saudi Arabia",
    ministry: "Ministry of Education",
    university: "Qassim University",
    college: "College of Languages & Social Sciences",
    department: "Department of Sociology & Social Work",
  },
  formsEdition: "نماذج التدريب الميداني لمرحلة البكالوريوس ١٤٤٧ هـ – ٢٠٢٦ م",
};
