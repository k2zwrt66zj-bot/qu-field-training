import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, type SessionUser } from "@/lib/api";

/** شرط Prisma يحصر الإسنادات التي يحق للمستخدم رؤيتها */
export function placementScope(user: SessionUser): Prisma.PlacementWhereInput {
  switch (user.role) {
    case "STUDENT":
      return { student: { userId: user.id } };
    case "FIELD_SUPERVISOR":
      return { fieldSupervisor: { userId: user.id } };
    case "ACADEMIC_SUPERVISOR":
      return { academicSupervisor: { userId: user.id } };
    default:
      return {}; // رئيس التدريب / رئيس القسم / مدير النظام
  }
}

/** يتحقق أن المستخدم مرتبط بالإسناد ويعيده */
export async function assertPlacementAccess(user: SessionUser, placementId: string) {
  const placement = await prisma.placement.findFirst({ where: { id: placementId, ...placementScope(user) } });
  if (!placement) throw new ApiError(404, "الإسناد غير موجود أو لا تملك صلاحية عليه");
  return placement;
}
