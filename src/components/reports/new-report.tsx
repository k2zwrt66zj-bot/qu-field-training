"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";

export interface TemplateCard { id: string; title: string; description: string; disabled?: string }

/** بطاقات النماذج المتاحة لتخصص الطالب + إنشاء تقرير جديد */
export function NewReport({ templates }: { templates: TemplateCard[] }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<TemplateCard | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {templates.map((t) => (
          <button
            key={t.id}
            disabled={!!t.disabled}
            onClick={() => { setChosen(t); setTitle(""); setError(null); }}
            className="group flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-start transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-card"
          >
            <FilePlus2 className="size-6 text-primary" />
            <span className="font-semibold">{t.title}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{t.disabled ?? t.description}</span>
          </button>
        ))}
      </div>
      <Dialog open={chosen !== null} onClose={() => setChosen(null)} title={`تقرير جديد: ${chosen?.title ?? ""}`} className="max-w-lg">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: chosen!.id, title }) });
              const json = await res.json();
              if (!res.ok) return setError(json.details?.[0]?.message ?? json.error);
              router.push(`/student/reports/${json.id}`);
            });
          }}
        >
          <Label htmlFor="new-title">عنوان التقرير</Label>
          <Input id="new-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} placeholder="مثال: دراسة حالة لمريض مزمن وأسرته" />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />} إنشاء والبدء بالتعبئة</Button>
        </form>
      </Dialog>
    </>
  );
}
