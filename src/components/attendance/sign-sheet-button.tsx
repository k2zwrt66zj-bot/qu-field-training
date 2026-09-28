"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignDialog } from "@/components/forms/sign-dialog";

/** توقيع المشرف المؤسسي على كشف الحضور والانصراف لليوم */
export function SignSheetButton({ organizationId, date, missing }: { organizationId: string; date: string; missing: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}><PenLine /> توقيع كشف اليوم</Button>
      {open && (
        <SignDialog
          title="توقيع كشف الحضور والانصراف"
          description={`بتوقيعك تقر بصحة أوقات الحضور والانصراف في الكشف، ويُقفل اليوم أمام أي تعديل لاحق مع حفظ بصمة رقمية للسجلات.${missing ? ` سيُسجَّل غياب ${missing} متدرب/ـة لم يحضروا في يوم تدريبهم.` : ""}`}
          confirmLabel="توقيع الكشف"
          signerLabel="توقيع المشرف المؤسسي"
          onClose={() => setOpen(false)}
          onConfirm={async ({ imageData }) => {
            const res = await fetch(`/api/attendance-sheets/${organizationId}/${date}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageData }) });
            const json = await res.json();
            if (!res.ok) return json.error ?? "تعذر التوقيع";
            setOpen(false);
            router.refresh();
            return null;
          }}
        />
      )}
    </>
  );
}
