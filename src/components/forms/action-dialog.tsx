"use client";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { SignatureSlot } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SignaturePad } from "@/components/evaluation/signature-pad";
import { SLOT_LABELS } from "@/lib/forms/catalog";
import { ACTION_LABELS, type FormAction } from "@/lib/forms/workflow";

export interface TransitionPayload {
  action: FormAction;
  comment?: string;
  score?: number;
  signatures?: { slot: SignatureSlot; imageData: string; signerName?: string; withStamp?: boolean }[];
}

const INTRO: Partial<Record<FormAction, string>> = {
  SUBMIT: "بعد الرفع لا يمكن التعديل إلا إذا أُعيد النموذج إليك.",
  FIELD_SIGN: "بتوقيعك تقر بصحة ما ورد عن العمل الميداني للطالب/ـة. يُحفظ مع التوقيع بصمة رقمية للمحتوى تكشف أي تعديل لاحق.",
  FIELD_RETURN: "اكتب ما يلزم الطالب/ـة تعديله.",
  ACADEMIC_RETURN: "اكتب ما يلزم الطالب/ـة تعديله. تُلغى التواقيع السابقة لأن المحتوى سيتغير.",
  ACADEMIC_APPROVE: "اعتماد النموذج نهائياً.",
};

/** نافذة تنفيذ إجراء: تجمع التواقيع المطلوبة والملاحظة والدرجة حسب الإجراء */
export function ActionDialog({ action, slots, withScore, directorDefault, hasStamp, onClose, onConfirm }: {
  action: FormAction;
  slots: SignatureSlot[];
  withScore: boolean;
  directorDefault?: string | null;
  hasStamp?: boolean;
  onClose: () => void;
  onConfirm: (p: TransitionPayload) => Promise<string | null>;
}) {
  const [images, setImages] = useState<Partial<Record<SignatureSlot, string | null>>>({});
  const [comment, setComment] = useState("");
  const [score, setScore] = useState("");
  const [director, setDirector] = useState(directorDefault ?? "");
  const [stamp, setStamp] = useState(!!hasStamp);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isReturn = action === "FIELD_RETURN" || action === "ACADEMIC_RETURN";
  const ready = slots.every((s) => images[s]) && (!isReturn || comment.trim().length >= 3) && (!slots.includes("ORG_DIRECTOR") || director.trim().length >= 3);

  async function confirm() {
    setBusy(true);
    setError(null);
    const err = await onConfirm({
      action,
      comment: comment.trim() || undefined,
      score: withScore && score !== "" ? Number(score) : undefined,
      signatures: slots.length
        ? slots.map((slot) => ({ slot, imageData: images[slot]!, ...(slot === "ORG_DIRECTOR" ? { signerName: director.trim(), withStamp: stamp } : {}) }))
        : undefined,
    });
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Dialog open onClose={onClose} title={ACTION_LABELS[action]} description={INTRO[action]} className="max-w-xl">
      <div className="space-y-4">
        {slots.map((slot) => (
          <div key={slot} className="space-y-2 rounded-lg border p-3">
            <div className="text-sm font-semibold text-qu-navy-800">{SLOT_LABELS[slot]}</div>
            {slot === "ORG_DIRECTOR" && (
              <>
                <p className="text-xs text-muted-foreground">يوقّع مدير المؤسسة على هذا الجهاز مباشرة.</p>
                <div className="space-y-1">
                  <Label htmlFor="director-name">اسم مدير المؤسسة</Label>
                  <Input id="director-name" value={director} onChange={(e) => setDirector(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={stamp} disabled={!hasStamp} onChange={(e) => setStamp(e.target.checked)} />
                  {hasStamp ? "إضافة ختم المؤسسة الرسمي" : "لا يوجد ختم رسمي مرفوع للمؤسسة (يُختم الورقي يدوياً)"}
                </label>
              </>
            )}
            <SignaturePad onChange={(img) => setImages((m) => ({ ...m, [slot]: img }))} height={130} />
          </div>
        ))}
        {withScore && (
          <div className="space-y-1">
            <Label htmlFor="action-score">الدرجة الاسترشادية (من 100) — اختيارية</Label>
            <Input id="action-score" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} className="max-w-32" />
          </div>
        )}
        {(isReturn || action === "ACADEMIC_APPROVE" || action === "FIELD_SIGN") && (
          <div className="space-y-1">
            <Label htmlFor="action-comment">{isReturn ? "سبب الإعادة (مطلوب)" : "ملاحظة للطالب/ـة (اختيارية)"}</Label>
            <Textarea id="action-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        )}
        {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={confirm} disabled={busy || !ready} variant={isReturn ? "destructive" : "default"}>
            {busy && <LoaderCircle className="animate-spin" />} {ACTION_LABELS[action]}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>إلغاء</Button>
        </div>
      </div>
    </Dialog>
  );
}
