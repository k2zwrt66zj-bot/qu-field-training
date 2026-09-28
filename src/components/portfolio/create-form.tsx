"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FormKind, SituationDomain } from "@prisma/client";
import { FilePlus2, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";

async function postForm(body: Record<string, unknown>): Promise<{ id?: string; error?: string }> {
  const res = await fetch("/api/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  // النموذج الفردي موجود مسبقاً: نفتحه بدل الخطأ
  if (res.status === 409 && json.details?.existingId) return { id: json.details.existingId };
  if (!res.ok) return { error: json.details?.[0]?.message ?? json.error ?? "تعذر إنشاء النموذج" };
  return { id: json.id };
}

const DOMAIN_LABELS: Record<SituationDomain, string> = { SCHOOL: "بالمدرسة", MEDICAL: "بالمستشفى" };

/** زر إنشاء نموذج رسمي (مع اختيار مجال الموقف السريع إن لزم) ثم الانتقال إليه */
export function CreateFormButton({ kind, domains, label = "جديد", size = "sm", variant = "outline" }: {
  kind: FormKind;
  domains?: SituationDomain[];
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyDomain, setBusyDomain] = useState<SituationDomain | null>(null);

  const create = (domain?: SituationDomain) =>
    start(async () => {
      setError(null);
      setBusyDomain(domain ?? null);
      const r = await postForm({ kind, ...(domain ? { domain } : {}) });
      if (r.error) return setError(r.error);
      router.push(`/forms/${r.id}`);
    });

  const choices = domains && domains.length > 1 ? domains : null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {choices ? (
          choices.map((d) => (
            <Button key={d} size={size} variant={variant} disabled={pending} onClick={() => create(d)}>
              {pending && busyDomain === d ? <LoaderCircle className="animate-spin" /> : <Plus />} موقف {DOMAIN_LABELS[d]}
            </Button>
          ))
        ) : (
          <Button size={size} variant={variant} disabled={pending} onClick={() => create(domains?.[0])}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Plus />} {label}
          </Button>
        )}
      </div>
      {error && <p role="alert" className="max-w-64 text-end text-xs text-red-700">{error}</p>}
    </div>
  );
}

export interface CustomTemplateCard { key: string; title: string; description: string; disabled?: string }

/** النماذج الإضافية (البحث الميداني، المسح الاجتماعي، التقرير الختامي): عنوان ثم إنشاء */
export function NewCustomForm({ templates }: { templates: CustomTemplateCard[] }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<CustomTemplateCard | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.key}
            disabled={!!t.disabled}
            onClick={() => { setChosen(t); setTitle(""); setError(null); }}
            className="group flex flex-col items-start gap-1.5 rounded-xl border bg-card p-4 text-start transition-colors hover:border-qu-teal-500 hover:bg-qu-teal-50/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-card"
          >
            <FilePlus2 className="size-5 text-qu-teal-700" />
            <span className="font-semibold text-qu-navy-800">{t.title}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{t.disabled ?? t.description}</span>
          </button>
        ))}
      </div>
      <Dialog open={chosen !== null} onClose={() => setChosen(null)} title={`نموذج إضافي: ${chosen?.title ?? ""}`} className="max-w-lg">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await postForm({ kind: "CUSTOM", templateKey: chosen!.key, title });
              if (r.error) return setError(r.error);
              router.push(`/forms/${r.id}`);
            });
          }}
        >
          <Label htmlFor="custom-title">العنوان</Label>
          <Input id="custom-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} placeholder="مثال: واقع المشاركة التطوعية لدى طلاب المرحلة الثانوية" />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />} إنشاء والبدء بالتعبئة</Button>
        </form>
      </Dialog>
    </>
  );
}
