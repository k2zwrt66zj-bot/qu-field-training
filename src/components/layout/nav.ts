import type { Role } from "@prisma/client";

export interface NavItem { href: string; label: string; icon: string }

export const NAV: Record<Role, NavItem[]> = {
  STUDENT: [
    { href: "/student", label: "الرئيسية", icon: "home" },
    { href: "/student/attendance", label: "التحضير الميداني", icon: "map-pin" },
    { href: "/student/logbooks", label: "السجلات والتقارير", icon: "book" },
  ],
  FIELD_SUPERVISOR: [
    { href: "/field-supervisor", label: "المتدربون والحضور", icon: "users" },
    { href: "/field-supervisor/logbooks", label: "السجلات بانتظار التوقيع", icon: "pen" },
  ],
  ACADEMIC_SUPERVISOR: [{ href: "/academic-supervisor", label: "طلابي", icon: "users" }],
  TRAINING_HEAD: [
    { href: "/training-head", label: "لوحة المتابعة اللحظية", icon: "activity" },
    { href: "/training-head/placements", label: "التوزيع والخطابات", icon: "file" },
    { href: "/training-head/organizations", label: "جهات التدريب", icon: "building" },
    { href: "/training-head/settings", label: "بنود التقييم والإعدادات", icon: "settings" },
    { href: "/training-head/grades", label: "اعتماد النتائج", icon: "award" },
    { href: "/department-head", label: "اللوحة الاستراتيجية", icon: "chart" },
  ],
  DEPARTMENT_HEAD: [{ href: "/department-head", label: "اللوحة الاستراتيجية", icon: "chart" }],
  ADMIN: [
    { href: "/training-head", label: "لوحة المتابعة", icon: "activity" },
    { href: "/department-head", label: "اللوحة الاستراتيجية", icon: "chart" },
  ],
};
