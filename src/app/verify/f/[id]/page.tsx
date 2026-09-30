import Image from "next/image";
import { BadgeCheck, CircleX, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { INSTITUTION } from "@/lib/labels";
import { LOGO } from "@/lib/brand";
import { SLOT_LABELS } from "@/lib/forms/catalog";
import { FORM_INCLUDE } from "@/server/forms/include";
import { formContentHash } from "@/server/forms/service";
import { formDisplayTitle } from "@/lib/forms/catalog";
import { customTitle } from "@/lib/forms/ui/custom";
import { formatDateAr } from "@/lib/time";
import { DEVELOPER_CREDIT } from "@/lib/developer";

export const metadata = { title: "التحقق من مستند" };
export const dynamic = "force-dynamic";

/**
 * صفحة عامة للتحقق من نموذج مطبوع عبر رمز QR: تقارن بصمة المحتوى المطبوعة بالمحتوى الحالي.
 * لا تعرض أي محتوى من النموذج (خصوصية المستفيدين): النوع والحالة والتواقيع وتواريخها فقط.
 */
export default async function VerifyFormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ h?: string }> }) {
  const { id } = await params;
  const { h } = await searchParams;
  const form = await prisma.fieldForm.findUnique({ where: { id }, include: FORM_INCLUDE });
  const hash = form ? formContentHash(form) : null;
  const matches = !!(form && h && h.length >= 16 && hash!.startsWith(h));
  const title = form ? (form.kind === "CUSTOM" ? form.title ?? customTitle(form.templateKey) : formDisplayTitle(form.kind, form.sequence, form.quickSituation?.domain)) : null;
  const initials = form?.placement.student.user.fullName.split(" ").map((w) => w[0]).join(".") ?? "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <Image src={LOGO.full} alt="جامعة القصيم" width={206} height={72} className="mx-auto" />
        <div className="mt-2 text-sm text-muted-foreground">{INSTITUTION.university} · {INSTITUTION.unit}</div>
        {!form ? (
          <>
            <CircleX className="mx-auto mt-6 size-14 text-red-600" />
            <h1 className="mt-2 text-xl font-bold">المستند غير موجود</h1>
          </>
        ) : (
          <>
            {matches ? <BadgeCheck className="mx-auto mt-6 size-14 text-emerald-600" /> : <TriangleAlert className="mx-auto mt-6 size-14 text-amber-600" />}
            <h1 className="mt-2 text-xl font-bold">{matches ? "المستند المطبوع مطابق للنسخة المعتمدة في المنصة" : "المحتوى تغيّر بعد طباعة هذه النسخة"}</h1>
            <dl className="mt-6 space-y-2 text-right text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">المستند</dt><dd className="font-medium">{title}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">صاحب/ـة السجل</dt><dd className="font-medium">{initials}</dd></div>
              {form.signatures.map((s) => (
                <div key={s.id} className="flex justify-between gap-3"><dt className="text-muted-foreground">{SLOT_LABELS[s.slot]}</dt><dd>{s.slot === "STUDENT" ? initials : s.signerName} · {formatDateAr(s.signature.signedAt)}</dd></div>
              ))}
              {form.academicApprovedAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">اعتماد المشرف الأكاديمي</dt><dd>{formatDateAr(form.academicApprovedAt)}</dd></div>}
            </dl>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{DEVELOPER_CREDIT}</p>
    </div>
  );
}
