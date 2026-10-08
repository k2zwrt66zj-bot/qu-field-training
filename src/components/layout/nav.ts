import type { Role } from "@prisma/client";

export interface NavItem { href: string; label: string; icon: string }

/** روابط لا تنطبق على طلاب التدريب بالمحاكاة (لا مقر تدريب فعلي — قرار القسم) */
export const SITE_BOUND_HREFS = ["/student/attendance"];

/** روابط مشتركة لجميع المستخدمين: أسفل القائمة الجانبية (لا في الشريط السفلي للجوال) */
export const COMMON_NAV: NavItem[] = [
  { href: "/account", label: "الحساب وكلمة المرور", icon: "key" },
  { href: "/developer", label: "عن المنصة والمطور", icon: "info" },
];

export const NAV: Record<Role, NavItem[]> = {
  STUDENT: [
    { href: "/student", label: "الرئيسية", icon: "home" },
    { href: "/portfolio", label: "السجل المهني", icon: "book" },
    { href: "/student/attendance", label: "التحضير الميداني", icon: "map-pin" },
    { href: "/meetings", label: "الاجتماعات الإشرافية", icon: "meeting" },
  ],
  FIELD_SUPERVISOR: [
    { href: "/field-supervisor", label: "المتدربون والحضور", icon: "users" },
    { href: "/queue", label: "قائمة الاعتماد", icon: "inbox" },
    { href: "/attendance-sheets", label: "كشوف الحضور اليومية", icon: "sheet" },
  ],
  ACADEMIC_SUPERVISOR: [
    { href: "/academic-supervisor", label: "طلابي", icon: "users" },
    { href: "/queue", label: "قائمة الاعتماد", icon: "inbox" },
    { href: "/meetings", label: "الاجتماعات الإشرافية", icon: "meeting" },
    { href: "/attendance-sheets", label: "كشوف الحضور", icon: "sheet" },
  ],
  TRAINING_HEAD: [
    { href: "/training-head", label: "لوحة المتابعة اللحظية", icon: "activity" },
    { href: "/queue", label: "متابعة الاعتماد", icon: "inbox" },
    { href: "/meetings", label: "الاجتماعات الإشرافية", icon: "meeting" },
    { href: "/attendance-sheets", label: "كشوف الحضور", icon: "sheet" },
    { href: "/training-head/placements", label: "التوزيع والخطابات", icon: "file" },
    { href: "/training-head/organizations", label: "جهات التدريب", icon: "building" },
    { href: "/training-head/settings", label: "بنود التقييم والإعدادات", icon: "settings" },
    { href: "/training-head/grades", label: "اعتماد النتائج", icon: "award" },
    { href: "/department-head", label: "اللوحة الاستراتيجية", icon: "chart" },
  ],
  DEPARTMENT_HEAD: [
    { href: "/department-head", label: "اللوحة الاستراتيجية", icon: "chart" },
    { href: "/queue", label: "متابعة الاعتماد", icon: "inbox" },
    { href: "/meetings", label: "الاجتماعات الإشرافية", icon: "meeting" },
    { href: "/attendance-sheets", label: "كشوف الحضور", icon: "sheet" },
  ],
  ADMIN: [
    { href: "/training-head", label: "لوحة المتابعة", icon: "activity" },
    { href: "/queue", label: "متابعة الاعتماد", icon: "inbox" },
    { href: "/department-head", label: "اللوحة الاستراتيجية", icon: "chart" },
  ],
};
