import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { loadFormFor, presentForm } from "@/server/forms/service";
import { FormWorkspace } from "@/components/forms/form-workspace";

export const dynamic = "force-dynamic";

/** صفحة النموذج لكل الأطراف — الإجراءات الظاهرة تحددها صلاحيات الخادم */
export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole();
  const { id } = await params;
  const loaded = await loadFormFor(user, id).catch((e) => {
    if (e instanceof ApiError) return null;
    throw e;
  });
  if (!loaded) notFound();
  const { form, actor } = loaded;
  const p = form.placement;

  const [caseStudies, stamp] = await Promise.all([
    form.kind === "INTERVIEW"
      ? prisma.fieldForm.findMany({ where: { placementId: p.id, kind: "CASE_STUDY" }, select: { id: true, sequence: true, caseStudy: { select: { caseAlias: true } } }, orderBy: { sequence: "asc" } })
      : Promise.resolve([]),
    form.kind === "COMMENCEMENT" ? prisma.attachment.count({ where: { organizationId: p.organizationId, kind: "STAMP" } }) : Promise.resolve(0),
  ]);

  const backHref = user.role === "STUDENT" ? "/portfolio" : ["FIELD_SUPERVISOR", "ACADEMIC_SUPERVISOR"].includes(user.role) ? "/queue" : `/portfolio/${p.id}`;
  return (
    <FormWorkspace
      initial={presentForm(form, actor)}
      context={{
        caseStudies: caseStudies.map((c) => ({ value: c.id, label: `دراسة الحالة ${c.sequence}${c.caseStudy?.caseAlias ? ` — ${c.caseStudy.caseAlias}` : ""}` })),
        hasStamp: stamp > 0,
        directorName: p.organization.directorName,
        fieldSupervisor: p.fieldSupervisor?.user.fullName ?? null,
        academicSupervisor: p.academicSupervisor?.user.fullName ?? null,
        backHref,
        backLabel: user.role === "STUDENT" ? "السجل المهني" : backHref === "/queue" ? "قائمة الاعتماد" : "سجل الطالب",
      }}
    />
  );
}
