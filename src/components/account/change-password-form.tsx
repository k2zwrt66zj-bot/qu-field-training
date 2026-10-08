"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { passwordProblem } from "@/lib/auth/password-policy";
import { cn } from "@/lib/utils";

export function ChangePasswordForm() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const problem = next ? passwordProblem(next, { email: session?.user.email ?? undefined, current }) : null;
  const mismatch = !!confirm && next !== confirm;
  const ready = !!current && !!next && !problem && next === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setMsg({ ok: false, text: json.error ?? "تعذّر تغيير كلمة المرور" });
    }
    await update(); // تحديث الجلسة الحالية (ترفع شرط التغيير الإلزامي)
    setBusy(false);
    setCurrent(""); setNext(""); setConfirm("");
    setMsg({ ok: true, text: "تم تغيير كلمة المرور بنجاح" });
    router.refresh();
  }

  const type = show ? "text" : "password";
  return (
    <form onSubmit={submit} className="space-y-4" data-change-password>
      <div className="space-y-1.5">
        <Label htmlFor="pw-current">كلمة المرور الحالية</Label>
        <Input id="pw-current" type={type} dir="ltr" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-new">كلمة المرور الجديدة</Label>
        <Input id="pw-new" type={type} dir="ltr" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!!problem} required />
        {problem && <p className="text-xs text-red-700">{problem}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-confirm">تأكيد كلمة المرور الجديدة</Label>
        <Input id="pw-confirm" type={type} dir="ltr" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} required />
        {mismatch && <p className="text-xs text-red-700">كلمتا المرور غير متطابقتين</p>}
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} إظهار كلمات المرور
      </label>
      {msg && <p role="status" className={cn("rounded-md p-2 text-sm", msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>{msg.text}</p>}
      <Button type="submit" disabled={!ready || busy}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Check />} حفظ كلمة المرور الجديدة
      </Button>
    </form>
  );
}
