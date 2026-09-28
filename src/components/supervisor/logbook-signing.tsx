"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SignaturePad } from "@/components/evaluation/signature-pad";

export function LogbookSigning({ id }: { id: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = (decision: "SIGN" | "RETURN") =>
    start(async () => {
      setError(null);
      const res = await fetch(`/api/logbooks/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || undefined, signature: decision === "SIGN" ? signature : undefined }),
      });
      if (!res.ok) return setError((await res.json()).error);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ملاحظة المشرف (اختيارية، ومطلوبة عند الإعادة)" />
      <SignaturePad onChange={setSignature} height={120} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={pending || !signature} onClick={() => send("SIGN")}><PenLine /> توقيع واعتماد</Button>
        <Button variant="outline" disabled={pending || !comment} onClick={() => send("RETURN")}><Undo2 /> إعادة للتعديل</Button>
      </div>
    </div>
  );
}
