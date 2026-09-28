"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/labels";
import type { Role } from "@prisma/client";

export interface CommentView { id: string; author: string; role: Role; body: string; createdAt: string | Date }

const when = (d: string | Date) => new Date(d).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" });

export function Comments({ formId, comments, canComment }: { formId: string; comments: CommentView[]; canComment: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  if (!comments.length && !canComment) return null;
  return (
    <section className="rounded-xl border bg-card p-4 print:hidden" aria-labelledby="comments-title">
      <h3 id="comments-title" className="mb-3 flex items-center gap-2 font-semibold text-qu-navy-800"><MessageSquareText className="size-4" /> ملاحظات المراجعة</h3>
      <div className="space-y-2">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">لا توجد ملاحظات</p>}
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border-s-4 border-qu-teal-500 bg-muted/40 p-3 text-sm">
            <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{c.author} <span className="font-normal text-muted-foreground">· {ROLE_LABELS[c.role]}</span></span>
              <span>{when(c.createdAt)}</span>
            </div>
            <p className="whitespace-pre-line">{c.body}</p>
          </div>
        ))}
      </div>
      {canComment && (
        <form
          className="mt-3 flex items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await fetch(`/api/forms/${formId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
              if (res.ok) { setBody(""); router.refresh(); }
            });
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب ملاحظة…" className="min-h-[44px]" aria-label="ملاحظة جديدة" />
          <Button type="submit" size="icon" disabled={pending || body.trim().length < 2} aria-label="إرسال الملاحظة"><Send /></Button>
        </form>
      )}
    </section>
  );
}
