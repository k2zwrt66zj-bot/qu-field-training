"use client";
import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Award, CircleAlert, Eye, EyeOff, FileText, Lock, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { INSTITUTION } from "@/lib/labels";
import { LOGO } from "@/lib/brand";
import { safeRelativePath } from "@/lib/auth/redirect";
import { credentialsLogin } from "@/lib/auth/client-login";
import { LOCK_MINUTES } from "@/lib/auth/password-policy";
import { DEVELOPER_CREDIT } from "@/lib/developer";

/** نقشة شبكية خفيفة مستوحاة من رمز شعار الجامعة */
const LATTICE = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(255,255,255,.09) 0 2px, transparent 2px 26px), repeating-linear-gradient(-45deg, rgba(255,255,255,.09) 0 2px, transparent 2px 26px)",
};

const FEATURES = [
  { icon: MapPin, text: "تحضير يومي بالتحديد الجغرافي واعتماد فوري من المشرف المؤسسي" },
  { icon: FileText, text: "نماذج التدريب الرسمية بتواقيع رقمية ومسارات اعتماد واضحة" },
  { icon: Award, text: "متابعة لحظية وتقييم واعتماد النتائج في مكان واحد" },
] as const;

// الحقول بالاتجاه ltr (بريد وكلمة مرور)، لذا مواضع الأيقونات فيزيائية: right للأيقونة، left لزر الإظهار
const fieldCls = "h-12 rounded-xl border-qu-gray-300 pr-11 text-base transition-shadow focus-visible:border-qu-teal-700 focus-visible:ring-4 focus-visible:ring-qu-teal-500/20";
const iconCls = "pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground transition-colors peer-focus:text-qu-teal-700";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await credentialsLogin(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
    setLoading(false);
    if (result === "invalid") return setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    if (result === "locked") return setError(`أُوقف الدخول مؤقتاً بعد تكرار كلمة مرور خاطئة. حاول بعد ${LOCK_MINUTES} دقيقة، أو تواصل مع وحدة التدريب الميداني.`);
    if (result === "error") return setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    // مسار نسبي آمن فقط: لا إعادة توجيه إلى موقع خارجي عبر ?callbackUrl=https://…
    const next = safeRelativePath(params.get("callbackUrl"), "/");
    router.replace(next.startsWith("/login") ? "/" : next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="font-semibold">البريد الجامعي</Label>
        <div className="relative">
          <Input id="email" name="email" type="email" dir="ltr" autoComplete="username" required placeholder="name@qu.edu.sa" className={`peer ${fieldCls}`} />
          <Mail className={iconCls} aria-hidden />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="font-semibold">كلمة المرور</Label>
        <div className="relative">
          <Input id="password" name="password" type={showPassword ? "text" : "password"} dir="ltr" autoComplete="current-password" required className={`peer pl-12 ${fieldCls}`} />
          <Lock className={iconCls} aria-hidden />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            aria-pressed={showPassword}
            className="absolute left-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-qu-navy-50 hover:text-qu-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/10"
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="h-12 w-full rounded-xl bg-gradient-to-l from-qu-navy-700 to-qu-teal-700 text-base font-semibold shadow-lg shadow-qu-navy-700/25 transition hover:brightness-110"
      >
        {loading ? "جارٍ الدخول..." : <>تسجيل الدخول <ArrowLeft className="size-5" aria-hidden /></>}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-qu-gray-50 dark:bg-background lg:grid lg:grid-cols-2">
      {/* الواجهة الكحلية: رأس منحني على الجوال، ونصف الشاشة على الحاسب */}
      <section className="relative overflow-hidden rounded-b-[2.25rem] bg-gradient-to-br from-qu-navy-800 via-qu-navy-700 to-qu-teal-800 px-6 pb-36 pt-14 text-center text-white lg:flex lg:flex-col lg:justify-between lg:rounded-none lg:p-12 lg:text-start">
        <div aria-hidden className="absolute inset-0" style={LATTICE} />
        <div aria-hidden className="absolute -left-28 -top-28 size-80 rounded-full border-[44px] border-qu-teal-500/20 lg:size-[28rem] lg:border-[56px]" />
        <div aria-hidden className="absolute -bottom-24 -right-16 hidden size-72 rounded-full bg-qu-teal-500/10 lg:block" />

        <div className="relative">
          <Image src={LOGO.white} alt="جامعة القصيم" width={752} height={195} priority className="mx-auto h-auto w-56 lg:mx-0 lg:w-64" />
          <p className="mt-6 text-2xl font-bold lg:hidden">منصة التدريب الميداني</p>
          <p className="mt-1.5 text-sm text-qu-teal-100 lg:hidden">{INSTITUTION.department}</p>
        </div>

        <div className="relative hidden lg:block">
          <p className="text-sm font-medium text-qu-teal-300">{INSTITUTION.unit}</p>
          <h2 className="mt-2 text-4xl font-bold leading-snug">منصة التدريب الميداني</h2>
          <p className="mt-3 max-w-md leading-7 text-white/75">{INSTITUTION.department} · {INSTITUTION.college}</p>
          <ul className="mt-8 max-w-md space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-qu-teal-300 ring-1 ring-white/15"><Icon className="size-5" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative hidden text-xs text-white/60 lg:block">
          رئيس القسم: {INSTITUTION.departmentHead} · رئيسة وحدة التدريب الميداني: {INSTITUTION.trainingHead}
        </p>
      </section>

      {/* بطاقة الدخول: تتداخل مع الرأس على الجوال */}
      <section className="relative -mt-28 flex flex-col items-center px-5 pb-8 lg:mt-0 lg:justify-center lg:p-10">
        <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-xl shadow-qu-navy-900/10 ring-1 ring-black/5 sm:p-8 lg:shadow-2xl">
          <h1 className="text-2xl font-bold text-qu-navy-800 dark:text-qu-navy-100">أهلاً بك</h1>
          <p className="mb-7 mt-1 text-sm text-muted-foreground">سجّل دخولك ببريدك الجامعي</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">{DEVELOPER_CREDIT}</p>
      </section>
    </div>
  );
}
