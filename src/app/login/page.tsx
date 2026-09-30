"use client";
import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { INSTITUTION } from "@/lib/labels";
import { LOGO } from "@/lib/brand";
import { safeRelativePath } from "@/lib/auth/redirect";
import { credentialsLogin } from "@/lib/auth/client-login";
import { DEVELOPER_CREDIT } from "@/lib/developer";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await credentialsLogin(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
    setLoading(false);
    if (result === "invalid") return setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    if (result === "error") return setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    // مسار نسبي آمن فقط: لا إعادة توجيه إلى موقع خارجي عبر ?callbackUrl=https://…
    const next = safeRelativePath(params.get("callbackUrl"), "/");
    router.replace(next.startsWith("/login") ? "/" : next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">البريد الجامعي</Label>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="username" required placeholder="name@qu.edu.sa" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">كلمة المرور</Label>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required />
      </div>
      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-qu-navy-800 p-10 text-white lg:flex">
        <div className="absolute -left-24 -top-24 size-96 rounded-full border-[40px] border-qu-teal-500/20" />
        <div className="relative flex items-center gap-4">
          <div className="rounded-xl bg-white px-3 py-2"><Image src={LOGO.full} alt="جامعة القصيم" width={172} height={60} priority /></div>
          <div>
            <div className="text-lg font-bold">{INSTITUTION.university}</div>
            <div className="text-sm text-qu-teal-100">{INSTITUTION.college}</div>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-snug">منصة التدريب الميداني</h2>
          <p className="mt-3 max-w-md text-white/80">
            {INSTITUTION.department} — متابعة الحضور بالتحديد الجغرافي، السجلات الميدانية، والتقييم في مكان واحد.
          </p>
        </div>
        <div className="relative text-xs text-white/60">
          رئيس القسم: {INSTITUTION.departmentHead} · رئيسة وحدة التدريب الميداني: {INSTITUTION.trainingHead}
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <Image src={LOGO.full} alt="جامعة القصيم" width={206} height={72} priority />
            <div className="font-bold text-qu-navy-700">{INSTITUTION.unit}</div>
          </div>
          <h1 className="mb-1 text-2xl font-bold">تسجيل الدخول</h1>
          <p className="mb-6 text-sm text-muted-foreground">ادخل ببريدك الجامعي</p>
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="mt-10 text-center text-xs text-muted-foreground">{DEVELOPER_CREDIT}</p>
        </div>
      </div>
    </div>
  );
}
