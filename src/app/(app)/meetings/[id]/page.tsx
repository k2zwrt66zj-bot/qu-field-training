import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/session";
import { ApiError } from "@/lib/api";
import { loadMeetingFor, presentMeeting } from "@/server/meetings";
import { MeetingWorkspace } from "@/components/meetings/meeting-workspace";

export const metadata = { title: "الاجتماع الإشرافي الجماعي" };
export const dynamic = "force-dynamic";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole();
  const loaded = await loadMeetingFor(user, (await params).id).catch((e) => {
    if (e instanceof ApiError) return null;
    throw e;
  });
  if (!loaded) notFound();
  return <MeetingWorkspace initial={await presentMeeting(loaded.meeting, loaded.access)} />;
}
