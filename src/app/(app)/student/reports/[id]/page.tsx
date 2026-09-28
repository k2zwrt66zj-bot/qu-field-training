import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/session";
import { migratedFormHref } from "@/server/legacy";

/** رابط تقرير قديم: يُحوَّل إلى النموذج المرحَّل (صفحة النموذج تتحقق من صلاحية العرض) */
export default async function LegacyReport({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole();
  const { id } = await params;
  redirect((await migratedFormHref(id)) ?? "/portfolio");
}
