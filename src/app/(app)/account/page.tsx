import type { Metadata } from "next";
import { KeyRound, ShieldCheck } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDateAr } from "@/lib/time";

export const metadata: Metadata = { title: "الحساب وكلمة المرور" };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const session = await requirePageRole();
  const { required } = await searchParams;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { fullName: true, email: true, role: true, phone: true, lastLoginAt: true, passwordChangedAt: true, mustChangePassword: true },
  });
  const mustChange = user.mustChangePassword || required === "1";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="الحساب وكلمة المرور" description={`${user.fullName} · ${ROLE_LABELS[user.role]}`} />
      {mustChange && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900" role="alert">
          <ShieldCheck className="mt-1 size-5 shrink-0" />
          حسابك يستخدم كلمة مرور مؤقتة. لحماية بياناتك وبيانات الطلاب، اختر كلمة مرور جديدة خاصة بك قبل متابعة استخدام المنصة.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-qu-teal-700" /> تغيير كلمة المرور</CardTitle>
          <CardDescription>8 أحرف على الأقل تجمع حروفاً وأرقاماً. تغييرها يُنهي دخولك من الأجهزة الأخرى.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>بيانات الحساب</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">البريد</dt><dd dir="ltr" className="text-end font-medium sm:text-start">{user.email}</dd></div>
            <div><dt className="text-muted-foreground">الجوال</dt><dd dir="ltr" className="text-end font-medium sm:text-start">{user.phone ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">آخر دخول</dt><dd className="font-medium">{user.lastLoginAt ? formatDateAr(user.lastLoginAt) : "—"}</dd></div>
            <div><dt className="text-muted-foreground">آخر تغيير لكلمة المرور</dt><dd className="font-medium">{user.passwordChangedAt ? formatDateAr(user.passwordChangedAt) : "لم تُغيَّر بعد"}</dd></div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
