import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

// حماية المسارات حسب الدور (طبقة أولى؛ الطبقة الثانية داخل كل صفحة ومسار API)
const ROUTE_ROLES: [string, Role[]][] = [
  ["/student", ["STUDENT"]],
  ["/field-supervisor", ["FIELD_SUPERVISOR"]],
  ["/academic-supervisor", ["ACADEMIC_SUPERVISOR"]],
  ["/training-head", ["TRAINING_HEAD"]],
  ["/department-head", ["DEPARTMENT_HEAD", "TRAINING_HEAD"]],
];

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as Role | undefined;
    const path = req.nextUrl.pathname;
    const rule = ROUTE_ROLES.find(([prefix]) => path.startsWith(prefix));
    if (rule && role && role !== "ADMIN" && !rule[1].includes(role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  { pages: { signIn: "/login" } }
);

export const config = {
  matcher: ["/student/:path*", "/field-supervisor/:path*", "/academic-supervisor/:path*", "/training-head/:path*", "/department-head/:path*", "/letters/:path*", "/forms/:path*", "/portfolio/:path*", "/queue/:path*", "/queue"],
};
