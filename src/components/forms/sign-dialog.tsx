"use client";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { SignaturePad } from "@/components/evaluation/signature-pad";

/** نافذة توقيع واحد (أو ملاحظة إعادة) — للاجتماعات الإشرافية وكشوف الحضور */
export function SignDialog({ title, description, confirmLabel, signerLabel, mode = "sign", destructive, onClose, onConfirm }: {
  title: string;
  description?: string;
  confirmLabel: string;
  signerLabel?: string;
  /** sign: توقيع مطلوب؛ comment: ملاحظة مطلوبة بلا توقيع */
  mode?: "sign" | "comment";
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (p: { imageData?: string; comment?: string }) => Promise<string | null>;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = mode === "sign" ? !!image : comment.trim().length >= 3;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const err = await onConfirm(mode === "sign" ? { imageData: image! } : { comment: comment.trim() });
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Dialog open onClose={onClose} title={title} description={description} className="max-w-xl">
      <div className="space-y-4">
        {mode === "sign" ? (
          <div className="space-y-2 rounded-lg border p-3">
            {signerLabel && <div className="text-sm font-semibold text-qu-navy-800">{signerLabel}</div>}
            <SignaturePad onChange={setImage} height={140} />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="sign-comment">السبب (مطلوب)</Label>
            <Textarea id="sign-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        )}
        {error && <p role="alert" className="whitespace-pre-line rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={confirm} disabled={busy || !ready} variant={destructive ? "destructive" : "default"}>
            {busy && <LoaderCircle className="animate-spin" />} {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>إلغاء</Button>
        </div>
      </div>
    </Dialog>
  );
}
