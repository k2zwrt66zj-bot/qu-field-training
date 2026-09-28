import Link from "next/link";
import { ChevronLeft, UsersRound } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewMeetingButton } from "@/components/meetings/new-meeting-button";
import { listMeetingGroups } from "@/server/meetings";
import { MEETING_ATTENDANCE_LABELS, MEETING_STATUS_LABELS } from "@/lib/meetings";
import { WEEKDAY_LABELS } from "@/lib/forms/catalog";

export const metadata = { title: "الاجتماعات الإشرافية" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT = { DRAFT: "muted", SUBMITTED: "warning", REVIEWED: "success" } as const;
const arDate = (s: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`));

/** «سجل الاجتماعات الإشرافية الجماعية»: مجموعة لكل (مؤسسة × مشرف أكاديمي) */
export default async function MeetingsPage() {
  const user = await requirePageRole("STUDENT", "ACADEMIC_SUPERVISOR", "TRAINING_HEAD", "DEPARTMENT_HEAD");
  const { term, groups } = await listMeetingGroups(user);
  const isSupervisor = user.role === "ACADEMIC_SUPERVISOR";
  return (
    <>
      <PageHeader
        title="سجل الاجتماعات الإشرافية الجماعية"
        description={`${term?.name ?? ""} — ${isSupervisor ? "أنت رئيس الاجتماع لكل مجموعة، ويكتب المحضرَ أمينٌ تختاره من المتدربين الحاضرين" : user.role === "STUDENT" ? "اجتماعات مجموعتك الإشرافية وحضورك فيها" : "كل المجموعات الإشرافية في الفصل"}`}
      />
      {groups.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد مجموعات إشرافية.</CardContent></Card>}
      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={`${g.organizationId}:${g.academicSupervisorId}`} data-group={g.organizationId}>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><UsersRound className="size-4 text-qu-teal-700" /> {g.organization}</CardTitle>
                <CardDescription>{g.field} · المشرف/ـة الأكاديمي: {g.academicSupervisor} · المتدربون: <span className="tabular-nums">{g.members}</span> · الاجتماعات: <span className="tabular-nums">{g.meetings.length}</span></CardDescription>
              </div>
              {g.canCreate && <NewMeetingButton organizationId={g.organizationId} />}
            </CardHeader>
            <CardContent className="space-y-2">
              {g.meetings.length === 0 && <p className="text-sm text-muted-foreground">لم يُعقد اجتماع بعد.</p>}
              {g.meetings.map((m) => (
                <Link key={m.id} href={`/meetings/${m.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-qu-navy-50/50">
                  <span className="min-w-[10rem] flex-1 font-medium text-qu-navy-800">الاجتماع الإشرافي الجماعي رقم ({m.number})</span>
                  {m.meetingDate && <span className="text-xs text-muted-foreground">{WEEKDAY_LABELS[new Date(`${m.meetingDate}T12:00:00Z`).getUTCDay()]} {arDate(m.meetingDate)}</span>}
                  <span className="text-xs text-muted-foreground">حضور <b className="tabular-nums text-foreground">{m.present}</b> · غياب <b className="tabular-nums text-foreground">{m.absent}</b></span>
                  {m.myAttendance && <Badge variant={m.myAttendance === "PRESENT" ? "success" : "warning"}>{MEETING_ATTENDANCE_LABELS[m.myAttendance]}</Badge>}
                  {m.iAmSecretary && <Badge variant="teal">أنت الأمين</Badge>}
                  <Badge variant={STATUS_VARIANT[m.status as keyof typeof STATUS_VARIANT] ?? "muted"}>{MEETING_STATUS_LABELS[m.status] ?? m.status}</Badge>
                  <ChevronLeft className="hidden size-4 text-muted-foreground sm:block" />
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
