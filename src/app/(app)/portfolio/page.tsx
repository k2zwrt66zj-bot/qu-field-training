import { requirePageRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { loadPortfolio } from "@/server/forms/portfolio";

export const metadata = { title: "السجل المهني" };
export const dynamic = "force-dynamic";

/** «السجل المهني» للطالب: آخر إسناد له */
export default async function MyPortfolioPage() {
  const user = await requirePageRole("STUDENT");
  const portfolio = await loadPortfolio(user, null);
  if (!portfolio) {
    return (
      <>
        <PageHeader title="السجل المهني" />
        <Card><CardContent className="p-8 text-center text-muted-foreground">لم يتم توزيعك على تدريب ميداني بعد.</CardContent></Card>
      </>
    );
  }
  return <PortfolioView p={portfolio} />;
}
