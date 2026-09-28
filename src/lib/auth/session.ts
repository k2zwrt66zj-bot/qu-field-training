import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { authOptions } from "./options";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/** للاستخدام في صفحات الخادم: يعيد التوجيه عند عدم الصلاحية */
export async function requirePageRole(...roles: Role[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role) && user.role !== "ADMIN") redirect("/");
  return user;
}
