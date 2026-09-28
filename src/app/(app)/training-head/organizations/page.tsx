import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerm } from "@/server/stats";
import { PageHeader } from "@/components/layout/page-header";
import { OrganizationsManager, type OrgRow } from "@/components/organizations/organizations-manager";

export const metadata = { title: "جهات التدريب" };
export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  await requirePageRole("TRAINING_HEAD");
  const term = await getActiveTerm();
  const orgs = await prisma.organization.findMany({
    orderBy: [{ isApproved: "desc" }, { name: "asc" }],
    include: {
      supervisors: { include: { user: true } },
      _count: { select: { placements: { where: { termId: term?.id, status: { in: ["ASSIGNED", "ACTIVE"] } } } } },
    },
  });

  const rows: OrgRow[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    category: o.category,
    city: o.city,
    address: o.address ?? "",
    latitude: o.latitude,
    longitude: o.longitude,
    geofenceRadius: o.geofenceRadius,
    genderScope: o.genderScope,
    acceptedMajors: o.acceptedMajors,
    capacityMale: o.capacityMale,
    capacityFemale: o.capacityFemale,
    contactName: o.contactName ?? "",
    contactTitle: o.contactTitle ?? "سعادة مدير",
    contactPhone: o.contactPhone ?? "",
    contactEmail: o.contactEmail ?? "",
    workStartTime: o.workStartTime,
    workEndTime: o.workEndTime,
    isApproved: o.isApproved,
    notes: o.notes ?? "",
    trainees: o._count.placements,
    supervisors: o.supervisors.map((s) => ({ id: s.id, fullName: s.user.fullName, email: s.user.email, phone: s.user.phone, isActive: s.user.isActive })),
  }));

  return (
    <>
      <PageHeader title="دليل جهات التدريب" description={`${rows.length} جهة · ${rows.filter((r) => r.isApproved).length} معتمدة`} />
      <OrganizationsManager orgs={rows} />
    </>
  );
}
