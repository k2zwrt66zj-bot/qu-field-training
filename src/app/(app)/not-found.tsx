import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
      <SearchX className="mx-auto size-12 text-qu-teal-700" />
      <h1 className="mt-3 text-xl font-bold text-qu-navy-700 dark:text-qu-navy-100">الصفحة غير موجودة</h1>
      <p className="mt-2 text-sm text-muted-foreground">ربما نُقلت الصفحة أو ليست لديك صلاحية الوصول إليها.</p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        العودة إلى الرئيسية
      </Link>
    </div>
  );
}
