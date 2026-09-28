"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AttachmentView { id: string; fileName: string; mimeType: string; sizeBytes: number; caption: string | null; url: string }

const MAX_DIM = 2000;

/**
 * ضغط الصور قبل الرفع: تصحيح الاتجاه، وتصغير الأبعاد الكبيرة، وإعادة الترميز (تُسقط بيانات EXIF أيضاً؛
 * والخادم ينظفها مرة أخرى على أي حال)
 */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

export function Evidence({ formId, title, attachments, canUpload }: { formId: string; title: string; attachments: AttachmentView[]; canUpload: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const upload = (files: FileList | null) =>
    files?.length &&
    start(async () => {
      setError(null);
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", await compress(f));
        if (caption) fd.append("caption", caption);
        const res = await fetch(`/api/forms/${formId}/attachments`, { method: "POST", body: fd });
        if (!res.ok) {
          setError((await res.json()).error);
          break;
        }
      }
      setCaption("");
      if (input.current) input.current.value = "";
      router.refresh();
    });

  if (!attachments.length && !canUpload) return null;
  return (
    <section className="rounded-xl border bg-card p-4 print:break-inside-avoid" aria-labelledby="evidence-title">
      <h3 id="evidence-title" className="mb-3 font-semibold text-qu-navy-800">{title}</h3>
      {attachments.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {attachments.map((a) => (
            <figure key={a.id} className="group relative overflow-hidden rounded-lg border bg-muted/30">
              <a href={a.url} target="_blank" rel="noreferrer" className="block">
                {a.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ملفات خاصة تمر عبر الخادم بعد فحص الصلاحية
                  <img src={a.url} alt={a.caption ?? a.fileName} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center"><FileText className="size-10 text-muted-foreground" /></div>
                )}
              </a>
              <figcaption className="truncate px-2 py-1 text-xs text-muted-foreground">{a.caption ?? a.fileName}</figcaption>
              {canUpload && (
                <button
                  type="button"
                  aria-label={`حذف ${a.fileName}`}
                  className="absolute left-1 top-1 rounded-md bg-white/90 p-1 text-red-700 opacity-0 shadow transition-opacity focus:opacity-100 group-hover:opacity-100 print:hidden"
                  onClick={() => start(async () => { await fetch(a.url, { method: "DELETE" }); router.refresh(); })}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
      {canUpload && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="وصف الشاهد (اختياري)" className="max-w-xs" aria-label="وصف الشاهد" />
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => upload(e.target.files)} aria-label="اختيار ملفات الشواهد" />
          <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
            {pending ? <LoaderCircle className="animate-spin" /> : <ImagePlus />} إضافة صور أو ملفات
          </Button>
          <span className="text-xs text-muted-foreground">JPEG أو PNG أو PDF حتى 5 ميجابايت — تُزال بيانات الموقع من الصور تلقائياً</span>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
