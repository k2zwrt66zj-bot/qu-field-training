"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

/** مراجعة المشرف الأكاديمي: درجة استرشادية + ملاحظة + اعتماد/إعادة */
export function ReviewPanel({ id, canApprove }: { id: string; canApprove: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [score, setScore] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (decision: "APPROVE" | "RETURN") =>
    start(async () => {
      setError(null);
      const res = await fetch(`/api/reports/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || undefined, score: score === "" ? undefined : Number(score) }),
      });
      if (!res.ok) {
        const j = await res.json();
        return setError(j.details?.[0]?.message ?? j.error);
      }
      router.push("/academic-supervisor/reports");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="score">الدرجة الاسترشادية (من 100)</Label>
        <Input id="score" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
        <p className="text-xs text-muted-foreground">تساعدك عند رصد بند «التطبيق المهني» في استمارة التقييم الأكاديمي.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="comment">ملاحظات للطالب</Label>
        <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {!canApprove && <p className="text-xs text-amber-700">يمكن الاعتماد بعد توقيع المشرف الميداني؛ الإعادة متاحة الآن.</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !canApprove} onClick={() => send("APPROVE")}><CircleCheck /> اعتماد التقرير</Button>
        <Button variant="outline" disabled={pending || !comment} onClick={() => send("RETURN")}><Undo2 /> إعادة للتعديل</Button>
      </div>
    </div>
  );
}
