"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

/** نموذج كتابة ملاحظة توجيهية أو إسناد مهمة ميدانية */
export function GuidanceForm({ students }: { students: { placementId: string; name: string }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"NOTE" | "TASK">("TASK");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const body =
          kind === "NOTE"
            ? { kind, placementId: fd.get("placementId"), content: fd.get("content"), isPrivate: fd.get("isPrivate") === "on" }
            : { kind, placementId: fd.get("placementId"), title: fd.get("title"), description: fd.get("content") || undefined, dueDate: fd.get("dueDate") || undefined };
        start(async () => {
          const res = await fetch("/api/guidance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          const json = await res.json();
          setMsg(res.ok ? (kind === "NOTE" ? "تم حفظ الملاحظة" : "تم إسناد المهمة") : json.error);
          if (res.ok) { form.reset(); router.refresh(); }
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Select value={kind} onChange={(e) => setKind(e.target.value as "NOTE" | "TASK")} aria-label="النوع">
          <option value="TASK">مهمة ميدانية</option>
          <option value="NOTE">ملاحظة توجيهية</option>
        </Select>
        <Select name="placementId" required aria-label="المتدرب">
          {students.map((s) => <option key={s.placementId} value={s.placementId}>{s.name}</option>)}
        </Select>
      </div>
      {kind === "TASK" && (
        <div className="grid grid-cols-[1fr_150px] gap-2">
          <Input name="title" placeholder="عنوان المهمة" required minLength={3} />
          <Input name="dueDate" type="date" aria-label="تاريخ الاستحقاق" />
        </div>
      )}
      <Textarea name="content" placeholder={kind === "NOTE" ? "نص الملاحظة التوجيهية" : "تفاصيل المهمة (اختياري)"} required={kind === "NOTE"} />
      {kind === "NOTE" && (
        <Label className="flex items-center gap-2 font-normal"><input type="checkbox" name="isPrivate" /> ملاحظة داخلية (لا يراها الطالب)</Label>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || students.length === 0}>حفظ</Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </form>
  );
}
