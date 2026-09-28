// =====================================================================
//  التحول إلى النماذج الرسمية: السجلات والتقارير القديمة أصبحت أرشيفاً للقراءة فقط
//  (نُقلت إلى FieldForm(kind=CUSTOM) بسكربت prisma/data-migrations/legacy-to-forms.ts)
// =====================================================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** الكتابة على الجداول القديمة متوقفة: كل ما يُكتب هناك لن يظهر في السجل المهني */
export const legacyGone = async () =>
  NextResponse.json(
    { error: "توقف هذا المسار بعد اعتماد النماذج الرسمية. استخدم السجل المهني (/api/forms).", replacement: "/api/forms" },
    { status: 410 }
  );

/** رابط النموذج المرحَّل لسجل/تقرير قديم (صلاحية العرض تتحقق منها صفحة النموذج نفسها) */
export async function migratedFormHref(legacyId: string): Promise<string | null> {
  const form = await prisma.fieldForm.findFirst({
    where: { kind: "CUSTOM", data: { path: ["_legacy", "id"], equals: legacyId } },
    select: { id: true },
  });
  return form ? `/forms/${form.id}` : null;
}
