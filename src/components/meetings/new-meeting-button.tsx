"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** اجتماع جديد برقم تالٍ للمجموعة الإشرافية */
export function NewMeetingButton({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={pending} onClick={() => start(async () => {
        const res = await fetch("/api/meetings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId }) });
        const json = await res.json();
        if (!res.ok) return setError(json.error);
        router.push(`/meetings/${json.id}`);
      })}>
        {pending ? <LoaderCircle className="animate-spin" /> : <Plus />} اجتماع جديد
      </Button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
