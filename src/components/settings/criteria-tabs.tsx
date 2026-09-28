"use client";
import { useState } from "react";
import { CriteriaEditor } from "./criteria-editor";
import { cn } from "@/lib/utils";

export function CriteriaTabs({ termId }: { termId: string }) {
  const [type, setType] = useState<"FIELD" | "ACADEMIC">("FIELD");
  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex rounded-lg bg-muted p-1">
        {([["FIELD", "استمارة المشرف الميداني"], ["ACADEMIC", "استمارة المشرف الأكاديمي"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={type === k} onClick={() => setType(k)}
            className={cn("rounded-md px-4 py-1.5 text-sm transition-colors", type === k ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}>
            {l}
          </button>
        ))}
      </div>
      <CriteriaEditor termId={termId} type={type} />
    </div>
  );
}
