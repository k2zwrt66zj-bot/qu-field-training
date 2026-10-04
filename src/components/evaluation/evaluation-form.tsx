"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LoaderCircle, Lock, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SignaturePad } from "./signature-pad";
import { MAJOR_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

interface Criterion { id: string; section: string; label: string; maxScore: number; order: number }
interface FormData {
  type: "FIELD" | "ACADEMIC";
  student: { name: string; universityId: string; major: "SOCIOLOGY" | "SOCIAL_WORK" };
  organization: string;
  criteria: Criterion[];
  evaluation: null | {
    status: "DRAFT" | "SUBMITTED" | "LOCKED";
    strengths: string | null;
    improvements: string | null;
    comments: string | null;
    items: { criterionId: string; score: number; comment: string | null }[];
  };
}

const LEVELS = [
  { label: "ممتاز", ratio: 1 },
  { label: "جيد جداً", ratio: 0.85 },
  { label: "جيد", ratio: 0.7 },
  { label: "مقبول", ratio: 0.6 },
  { label: "ضعيف", ratio: 0.4 },
];

/**
 * نموذج تقييم المشرف المؤسسي/الأكاديمي — يُحمّل البنود المعتمدة من الخادم حسب الفصل والتخصص،
 * ويتيح اختيار مستوى سريع أو إدخال درجة دقيقة، مع حساب لحظي وتوقيع إلكتروني عند الاعتماد.
 */
export function EvaluationForm({ placementId, backHref }: { placementId: string; backHref: string }) {
  const router = useRouter();
  const [data, setData] = useState<FormData | null>(null);
  const [scores, setScores] = useState<Record<string, number | undefined>>({});
  const [text, setText] = useState({ strengths: "", improvements: "", comments: "" });
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/evaluations?placementId=${placementId}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        return json as FormData;
      })
      .then((d) => {
        setData(d);
        if (d.evaluation) {
          setScores(Object.fromEntries(d.evaluation.items.map((i) => [i.criterionId, i.score])));
          setText({ strengths: d.evaluation.strengths ?? "", improvements: d.evaluation.improvements ?? "", comments: d.evaluation.comments ?? "" });
        }
      })
      .catch((e) => setError(e.message));
  }, [placementId]);

  const sections = useMemo(() => {
    const map = new Map<string, Criterion[]>();
    for (const c of data?.criteria ?? []) map.set(c.section, [...(map.get(c.section) ?? []), c]);
    return [...map.entries()];
  }, [data]);

  const total = data?.criteria.reduce((s, c) => s + (scores[c.id] ?? 0), 0) ?? 0;
  const max = data?.criteria.reduce((s, c) => s + c.maxScore, 0) ?? 0;
  const filled = data?.criteria.filter((c) => scores[c.id] != null).length ?? 0;
  const complete = !!data && filled === data.criteria.length;
  const locked = !!data?.evaluation && data.evaluation.status !== "DRAFT";
  const pct = max ? (total / max) * 100 : 0;

  async function save(submit: boolean) {
    if (!data) return;
    setError(null);
    setSaved(null);
    if (submit && !complete) return setError("يجب تقييم جميع البنود قبل الاعتماد");
    if (submit && !signature) return setError("يرجى التوقيع إلكترونياً لاعتماد التقييم");
    setSaving(submit ? "submit" : "draft");
    const res = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placementId,
        items: data.criteria.filter((c) => scores[c.id] != null).map((c) => ({ criterionId: c.id, score: scores[c.id]! })),
        ...text,
        submit,
        signature: submit ? signature : undefined,
      }),
    });
    const json = await res.json();
    setSaving(null);
    if (!res.ok) return setError(json.error + (json.details ? ` (${json.details.map((d: { message: string }) => d.message).join("، ")})` : ""));
    if (submit) {
      router.push(backHref);
      router.refresh();
    } else setSaved("تم حفظ المسودة");
  }

  if (error && !data) return <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>;
  if (!data) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> جارٍ تحميل الاستمارة...</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {sections.map(([section, items]) => {
          const secTotal = items.reduce((s, c) => s + (scores[c.id] ?? 0), 0);
          const secMax = items.reduce((s, c) => s + c.maxScore, 0);
          return (
            <Card key={section}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{section}</CardTitle>
                <Badge variant="teal">{secTotal} / {secMax}</Badge>
              </CardHeader>
              <CardContent className="divide-y">
                {items.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm md:max-w-[45%]">
                      {c.label} <span className="text-xs text-muted-foreground">({c.maxScore} درجات)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {LEVELS.map((lvl) => {
                        const v = Math.round(c.maxScore * lvl.ratio * 2) / 2;
                        const active = scores[c.id] === v;
                        return (
                          <button
                            key={lvl.label}
                            type="button"
                            disabled={locked}
                            onClick={() => setScores((s) => ({ ...s, [c.id]: v }))}
                            className={cn(
                              "rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-60",
                              active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                            )}
                          >
                            {lvl.label}
                          </button>
                        );
                      })}
                      <input
                        type="number"
                        aria-label={`درجة ${c.label}`}
                        min={0}
                        max={c.maxScore}
                        step={0.5}
                        disabled={locked}
                        value={scores[c.id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : Math.min(c.maxScore, Math.max(0, Number(e.target.value)));
                          setScores((s) => ({ ...s, [c.id]: v }));
                        }}
                        className="h-8 w-16 rounded-md border border-input bg-card px-2 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader><CardTitle>الملاحظات التوجيهية</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {([
              ["strengths", "جوانب القوة لدى المتدرب"],
              ["improvements", "جوانب تحتاج إلى تطوير"],
              ["comments", "ملاحظات عامة وتوصيات"],
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Textarea id={key} disabled={locked} value={text[key]} onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ملخص ثابت */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>{data.student.name}</CardTitle>
            <CardDescription>
              {data.student.universityId} · {MAJOR_LABELS[data.student.major]}
              <br />
              {data.organization}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{Math.round(pct * 10) / 10}%</div>
              <div className="text-sm text-muted-foreground">{total} من {max} · {data.type === "FIELD" ? "تقييم المشرف المؤسسي" : "تقييم المشرف الأكاديمي"}</div>
            </div>
            <Progress value={pct} />
            <div className="text-xs text-muted-foreground">البنود المقيَّمة: {filled} / {data.criteria.length}</div>
          </CardContent>
        </Card>

        {locked ? (
          <Card>
            <CardContent className="flex items-center gap-2 p-5 text-sm text-emerald-700">
              <Lock className="size-4" /> تم اعتماد هذا التقييم وتوقيعه ولا يمكن تعديله
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>التوقيع الإلكتروني</CardTitle><CardDescription>مطلوب لاعتماد التقييم نهائياً</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <SignaturePad onChange={setSignature} />
              {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              {saved && <p className="flex items-center gap-1 text-sm text-emerald-700"><CircleCheck className="size-4" />{saved}</p>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={!!saving} onClick={() => save(false)}>
                  {saving === "draft" ? <LoaderCircle className="animate-spin" /> : <Save />} حفظ مسودة
                </Button>
                <Button disabled={!!saving || !complete} onClick={() => save(true)}>
                  {saving === "submit" ? <LoaderCircle className="animate-spin" /> : <Send />} اعتماد
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
