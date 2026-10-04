import type { SignatureSlot } from "@prisma/client";
import { SLOT_LABELS } from "@/lib/forms/catalog";

export interface SignatureView { slot: SignatureSlot; signerName: string; signerTitle: string | null; withStamp: boolean; signedAt: string | Date; imageData: string }

/** خانات التوقيع كما تُطبع في النموذج الرسمي */
export function SignaturesView({ signatures, expected }: { signatures: SignatureView[]; expected: SignatureSlot[] }) {
  const slots = [...new Set([...expected, ...signatures.map((s) => s.slot)])];
  if (!slots.length) return null;
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3" aria-label="التواقيع">
      {slots.map((slot) => {
        const s = signatures.find((x) => x.slot === slot);
        return (
          <div key={slot} className="flex flex-col rounded-xl border bg-card p-3 text-center print:break-inside-avoid">
            <div className="text-xs font-semibold text-qu-navy-700">{SLOT_LABELS[slot]}</div>
            {s ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- توقيع Data URL */}
                <img src={s.imageData} alt={`توقيع ${s.signerName}`} className="mx-auto my-2 h-16 max-w-full object-contain" />
                <div className="text-sm font-medium">{s.signerName}</div>
                <div className="text-xs text-muted-foreground">{new Date(s.signedAt).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" })}</div>
              </>
            ) : (
              <div className="my-2 flex flex-1 items-center justify-center rounded-lg border border-dashed py-6 text-xs text-muted-foreground">لم يوقَّع بعد</div>
            )}
          </div>
        );
      })}
    </section>
  );
}
