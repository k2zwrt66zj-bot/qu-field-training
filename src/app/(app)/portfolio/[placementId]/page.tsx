import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { loadPortfolio } from "@/server/forms/portfolio";

export const metadata = { title: "السجل المهني للطالب" };
export const dynamic = "force-dynamic";

/** سجل طالب محدد للمشرفين ورئيس الوحدة ورئيس القسم (حسب نطاق كل دور) */
export default async function PlacementPortfolioPage({ params }: { params: Promise<{ placementId: string }> }) {
  const user = await requirePageRole();
  if (user.role === "STUDENT") redirect("/portfolio");
  const { placementId } = await params;
  const portfolio = await loadPortfolio(user, placementId);
  if (!portfolio) notFound();
  const back = { href: "/queue", label: ["FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR"].includes(user.role) ? "قائمة الاعتماد" : "متابعة الاعتماد" };
  return (
    <div className="space-y-3">
      <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowRight className="size-4" /> {back.label}
      </Link>
      <PortfolioView p={portfolio} />
    </div>
  );
}
