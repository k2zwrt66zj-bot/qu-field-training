"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SignaturePad } from "@/components/evaluation/signature-pad";

/** لوحة توقيع/إعادة مشتركة للسجلات والتقارير (endpoint: /api/logbooks/:id/sign أو /api/reports/:id/sign) */
export function SigningPanel({ endpoint, afterHref }: { endpoint: string; afterHref?: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = (decision: "SIGN" | "RETURN") =>
    start(async () => {
      setError(null);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || undefined, signature: decision === "SIGN" ? signature : undefined }),
      });
      if (!res.ok) {
        const j = await res.json();
        return setError(j.details?.[0]?.message ?? j.error);
      }
      if (afterHref) router.push(afterHref);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ملاحظة المشرف (اختيارية، ومطلوبة عند الإعادة)" aria-label="ملاحظة المشرف" />
      <SignaturePad onChange={setSignature} height={120} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !signature} onClick={() => send("SIGN")}><PenLine /> توقيع واعتماد</Button>
        <Button variant="outline" disabled={pending || !comment} onClick={() => send("RETURN")}><Undo2 /> إعادة للتعديل</Button>
      </div>
    </div>
  );
}

export const LogbookSigning = ({ id }: { id: string }) => <SigningPanel endpoint={`/api/logbooks/${id}/sign`} />;
