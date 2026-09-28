import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, handler, parseBody, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { placementScope } from "@/server/access";
import { FORM_KINDS, FORM_POLICIES, formDisplayTitle, policyFor } from "@/lib/forms/catalog";
import { createForm } from "@/server/forms/service";

/**
 * GET /api/forms?placementId=&kind=&status=
 * النماذج ضمن نطاق المستخدم مرتبةً بترتيب «السجل المهني» — المسودات لصاحبها فقط
 */
export const GET = handler(async (req: Request) => {
  const user = await requireRole();
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status");
  const forms = await prisma.fieldForm.findMany({
    where: {
      placement: { ...placementScope(user), ...(url.searchParams.get("placementId") ? { id: url.searchParams.get("placementId")! } : {}) },
      ...(kind && (FORM_KINDS as readonly string[]).includes(kind) ? { kind: kind as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(user.role !== "STUDENT" ? { status: { not: "DRAFT" } } : {}),
    },
    select: {
      id: true, kind: true, sequence: true, status: true, submittedAt: true, updatedAt: true, lockedAt: true, placementId: true,
      quickSituation: { select: { domain: true } },
      placement: { select: { student: { select: { user: { select: { fullName: true } } } }, section: { select: { mode: true } } } },
    },
  });
  // القراءات لا يراها المشرف المؤسسي (لا تمرّ عليه)
  const visible = user.role === "FIELD_SUPERVISOR" ? forms.filter((f) => policyFor(f.kind, f.placement.section?.mode).fieldApproval) : forms;
  visible.sort((a, b) => FORM_POLICIES[a.kind].portfolioOrder - FORM_POLICIES[b.kind].portfolioOrder || a.sequence - b.sequence);
  return NextResponse.json({
    forms: visible.map((f) => ({
      id: f.id, kind: f.kind, sequence: f.sequence, status: f.status, locked: !!f.lockedAt, submittedAt: f.submittedAt, updatedAt: f.updatedAt,
      placementId: f.placementId, student: f.placement.student.user.fullName, domain: f.quickSituation?.domain ?? null,
      title: formDisplayTitle(f.kind, f.sequence, f.quickSituation?.domain),
    })),
  });
});

const createSchema = z.object({
  kind: z.enum(FORM_KINDS),
  domain: z.enum(["SCHOOL", "MEDICAL"]).optional(),
});

/** POST /api/forms — إنشاء نموذج (الطالب) مع تعبئة مسبقة */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("STUDENT");
  const body = await parseBody(req, createSchema);
  const form = await createForm(user, body);
  await audit(user.id, "form.create", "FieldForm", form.id, { kind: form.kind, sequence: form.sequence });
  return NextResponse.json({ ok: true, id: form.id, sequence: form.sequence }, { status: 201 });
});
