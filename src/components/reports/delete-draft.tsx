"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteDraftButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" className="text-red-700" disabled={pending} onClick={() => {
      if (!confirm("حذف المسودة نهائياً؟")) return;
      start(async () => {
        await fetch(`/api/reports/${id}`, { method: "DELETE" });
        router.push("/student/reports");
        router.refresh();
      });
    }}><Trash2 /> حذف المسودة</Button>
  );
}
