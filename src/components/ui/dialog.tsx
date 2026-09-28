"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** نافذة حوار بسيطة: تُغلق بـ Esc أو النقر خارجها، وتمنع تمرير الصفحة خلفها */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/40 px-2 md:px-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal aria-labelledby="dialog-title" className={cn("my-2 w-full max-w-4xl rounded-xl bg-card md:my-6 shadow-xl outline-none", className)}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-xl border-b bg-card p-4 md:p-5">
          <div>
            <h2 id="dialog-title" className="text-lg font-bold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="إغلاق"><X className="size-5" /></button>
        </div>
        <div className="p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
}
