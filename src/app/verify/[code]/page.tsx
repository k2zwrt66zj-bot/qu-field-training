import Image from "next/image";
import { BadgeCheck, CircleX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { INSTITUTION } from "@/lib/labels";
import { formatDateAr } from "@/lib/time";
import { LETTER_TYPE_LABELS } from "@/server/letters";
import { LOGO } from "@/lib/brand";

export const metadata = { title: "التحقق من خطاب" };
export const dynamic = "force-dynamic";

/** صفحة عامة للتحقق من صحة الخطابات عبر رمز QR (تعرض أقل قدر من البيانات) */
export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const letter = await prisma.letter.findUnique({
    where: { verificationCode: code },
    include: { placement: { include: { student: { include: { user: true } }, organization: true } } },
  });
  const valid = letter && !letter.revokedAt;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <Image src={LOGO.full} alt="جامعة القصيم" width={206} height={72} className="mx-auto" />
        <div className="mt-2 text-sm text-muted-foreground">{INSTITUTION.university} · {INSTITUTION.unit}</div>
        {valid ? (
          <>
            <BadgeCheck className="mx-auto mt-6 size-14 text-emerald-600" />
            <h1 className="mt-2 text-xl font-bold">خطاب صحيح وساري</h1>
            <dl className="mt-6 space-y-2 text-right text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">نوع الخطاب</dt><dd>{LETTER_TYPE_LABELS[letter.type]}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">رقم الصادر</dt><dd dir="ltr">{letter.serialNumber}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">تاريخ الإصدار</dt><dd>{formatDateAr(letter.issuedAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">المتدرب/ة</dt><dd>{letter.placement.student.user.fullName}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">الجهة</dt><dd>{letter.placement.organization.name}</dd></div>
            </dl>
          </>
        ) : (
          <>
            <CircleX className="mx-auto mt-6 size-14 text-red-600" />
            <h1 className="mt-2 text-xl font-bold">{letter ? "هذا الخطاب ملغى" : "رمز التحقق غير صحيح"}</h1>
          </>
        )}
      </div>
    </div>
  );
}
