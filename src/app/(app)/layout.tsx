import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { SITE_BOUND_HREFS } from "@/components/layout/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // طالب المحاكاة: لا تحضير جغرافي ولا سجل حضور (لا مقر تدريب فعلي)
  const simulation =
    user.role === "STUDENT" &&
    (await prisma.placement.findFirst({ where: { student: { userId: user.id } }, orderBy: { startDate: "desc" }, select: { section: { select: { mode: true } } } }))?.section?.mode === "SIMULATION";
  return (
    <AppShell user={{ name: user.name ?? "", role: user.role }} hiddenHrefs={simulation ? SITE_BOUND_HREFS : []}>
      {children}
    </AppShell>
  );
}
