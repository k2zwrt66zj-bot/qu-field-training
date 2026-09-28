"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeetingAttendanceStatus } from "@prisma/client";
import { ArrowRight, BadgeCheck, CircleCheck, CloudUpload, Info, LoaderCircle, PenLine, Printer, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { ListField, NarrativeField } from "@/components/forms/widgets";
import { SignDialog } from "@/components/forms/sign-dialog";
import { WEEKDAY_LABELS } from "@/lib/forms/catalog";
import {
  checkMeetingSubmit, meetingCounts, MEETING_ACTION_LABELS, MEETING_ATTENDANCE_LABELS, MEETING_STATUS_LABELS, MINUTES_MIN_WORDS,
  PREVIOUS_MINUTES_ITEM, STANDING_AGENDA_ITEM, type MeetingAction,
} from "@/lib/meetings";
import type { PresentedMeeting } from "@/server/meetings";
import { cn } from "@/lib/utils";

type Draft = Pick<PresentedMeeting, "meetingDate" | "startTime" | "durationMinutes" | "location" | "agendaItems" | "minutes" | "decisions" | "secretaryPlacementId" | "attendance">;
const pick = (m: PresentedMeeting): Draft => ({
  meetingDate: m.meetingDate, startTime: m.startTime, durationMinutes: m.durationMinutes, location: m.location,
  agendaItems: m.agendaItems, minutes: m.minutes, decisions: m.decisions, secretaryPlacementId: m.secretaryPlacementId, attendance: m.attendance,
});
const STATUS_VARIANT = { DRAFT: "muted", SUBMITTED: "warning", REVIEWED: "success" } as const;
const ATT_OPTIONS: MeetingAttendanceStatus[] = ["PRESENT", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED"];
const arDate = (s: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`));

export function MeetingWorkspace({ initial }: { initial: PresentedMeeting }) {
  const router = useRouter();
  const [m, setM] = useState(initial);
  const [d, setD] = useState<Draft>(pick(initial));
  const dirty = useRef<Set<keyof Draft>>(new Set());
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<MeetingAction | null>(null);

  useEffect(() => {
    setM(initial);
    if (!dirty.current.size) setD(pick(initial));
  }, [initial]);

  const a = m.actions;
  const editAll = a.editAll;
  const editMinutes = a.editMinutes;
  const counts = useMemo(() => meetingCounts(d.attendance), [d.attendance]);
  const issues = useMemo(
    () => (m.status === "DRAFT" ? checkMeetingSubmit({ number: m.number, ...d }) : []),
    [m.status, m.number, d]
  );

  const save = useCallback(async () => {
    if (!dirty.current.size) return true;
    const keys = [...dirty.current];
    setSaveState("saving");
    const res = await fetch(`/api/meetings/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(keys.map((k) => [k, k === "attendance" ? d.attendance.map((r) => ({ placementId: r.placementId, status: r.status, excuse: r.excuse ?? null })) : d[k]]))),
    });
    const json = await res.json();
    if (!res.ok) {
      setSaveState("error");
      setSaveError([json.error, ...(json.details ?? []).map((x: { message: string }) => x.message)].filter(Boolean).join(" — "));
      return false;
    }
    keys.forEach((k) => dirty.current.delete(k));
    setM(json.meeting);
    setSaveError(null);
    setSaveState(dirty.current.size ? "dirty" : "saved");
    return true;
  }, [d, m.id]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => void save(), 2000);
    return () => clearTimeout(t);
  }, [saveState, d, save]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    dirty.current.add(k);
    setD((x) => ({ ...x, [k]: v }));
    setSaveState("dirty");
  };
  const setAttendance = (placementId: string, patch: Partial<Draft["attendance"][number]>) =>
    set("attendance", d.attendance.map((r) => (r.placementId === placementId ? { ...r, ...patch } : r)));

  const transition = async (action: MeetingAction, p: { imageData?: string; comment?: string }) => {
    if (!(await save())) return "تعذر حفظ التعديلات قبل الإجراء";
    const res = await fetch(`/api/meetings/${m.id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...p }) });
    const json = await res.json();
    if (!res.ok) return [json.error, ...(json.details ?? []).map((x: { message: string }) => x.message)].filter(Boolean).join("\n");
    setM(json.meeting);
    setD(pick(json.meeting));
    setDialog(null);
    router.refresh();
    return null;
  };

  const sig = (slot: "MEETING_SECRETARY" | "MEETING_CHAIR") => m.signatures.find((s) => s.slot === slot);
  const presentNames = d.attendance.filter((r) => r.status === "PRESENT").map((r) => r.name);
  const hint = m.viewer.secretary && m.status === "DRAFT"
    ? "أنت أمين هذا الاجتماع: اكتب المحضر والقرارات ثم ارفعه بتوقيعك لرئيس الاجتماع."
    : m.viewer.chair && m.status === "DRAFT" && !d.secretaryPlacementId
      ? "حدد أمين الاجتماع من الحاضرين؛ هو من يكتب المحضر ويرفعه بتوقيعه."
      : m.viewer.chair && m.status === "SUBMITTED"
        ? "رفع أمين الاجتماع المحضر بتوقيعه: راجعه ثم اعتمده بتوقيعك أو أعده بملاحظة."
        : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/meetings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="size-4" /> الاجتماعات الإشرافية</Link>
        <Badge variant={STATUS_VARIANT[m.status as keyof typeof STATUS_VARIANT] ?? "muted"}>{MEETING_STATUS_LABELS[m.status] ?? m.status}</Badge>
      </div>

      <header className="rounded-xl border bg-card p-4 md:p-5">
        <div className="text-xs text-qu-teal-700">سجل الاجتماعات الإشرافية الجماعية · {m.term}</div>
        <h1 className="mt-1 text-xl font-bold text-qu-navy-800 md:text-2xl">الاجتماع الإشرافي الجماعي رقم ({m.number})</h1>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-qu-gray-100 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["مؤسسة التدريب", m.header.organization],
            ["مجال التدريب", m.header.field],
            ["المشرف/ـة الأكاديمي", m.header.academicSupervisor],
            ["إجمالي عدد المتدربين/المتدربات بالمؤسسة", m.header.trainees],
            ["إجمالي عدد الاجتماعات الإشرافية الجماعية", m.header.meetingsCount],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
          ))}
        </dl>
      </header>

      {m.returnNote && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <Undo2 className="mt-0.5 size-4 shrink-0" /> أعاده رئيس الاجتماع: {m.returnNote}
        </p>
      )}
      {hint && <p className="flex items-start gap-2 rounded-lg bg-qu-navy-50 p-3 text-sm text-qu-navy-800 print:hidden"><Info className="mt-0.5 size-4 shrink-0" /> {hint}</p>}

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          {/* أولاً / الجزء الإحصائي */}
          <Card>
            <CardHeader className="rounded-t-xl border-b bg-qu-navy-50/60 pb-3"><CardTitle className="text-qu-navy-800">أولاً / الجزء الإحصائي</CardTitle></CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-date">التاريخ</Label>
                {editAll ? <Input id="m-date" type="date" value={d.meetingDate ?? ""} onChange={(e) => set("meetingDate", e.target.value || null)} /> : <p className="text-sm">{d.meetingDate ? arDate(d.meetingDate) : "—"}</p>}
                {d.meetingDate && <p className="text-xs text-muted-foreground">اليوم: {WEEKDAY_LABELS[new Date(`${d.meetingDate}T12:00:00Z`).getUTCDay()]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-time">توقيت الاجتماع</Label>
                {editAll ? <Input id="m-time" type="time" value={d.startTime ?? ""} onChange={(e) => set("startTime", e.target.value || null)} /> : <p className="text-sm tabular-nums">{d.startTime ?? "—"}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-duration">مدة الاجتماع (بالدقائق)</Label>
                {editAll ? <Input id="m-duration" type="number" min={10} max={480} value={d.durationMinutes ?? ""} onChange={(e) => set("durationMinutes", e.target.value === "" ? null : Number(e.target.value))} /> : <p className="text-sm tabular-nums">{d.durationMinutes ? `${d.durationMinutes} دقيقة` : "—"}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="m-location">مكان الاجتماع</Label>
                {editAll ? <Input id="m-location" value={d.location ?? ""} onChange={(e) => set("location", e.target.value || null)} placeholder="مثال: قاعة الاجتماعات بالمؤسسة" /> : <p className="text-sm">{d.location ?? "—"}</p>}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-center sm:col-span-2 lg:col-span-3">
                <div className="rounded-lg bg-emerald-50 p-2"><dd className="text-xl font-bold tabular-nums text-emerald-700">{counts.present}</dd><dt className="text-xs text-muted-foreground">عدد الحضور</dt></div>
                <div className="rounded-lg bg-red-50 p-2"><dd className="text-xl font-bold tabular-nums text-red-700">{counts.absent}</dd><dt className="text-xs text-muted-foreground">عدد الغياب</dt></div>
              </dl>
              <p className="text-sm sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">أسماء الغياب بعذر: </span>{counts.excusedNames.join("، ") || "—"}</p>
              <p className="text-sm sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">أسماء الغياب بدون عذر: </span>{counts.unexcusedNames.join("، ") || "—"}</p>
            </CardContent>
          </Card>

          {/* الحضور وأمين الاجتماع */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">سجل حضور المتدربين</CardTitle>
              <CardDescription>تُحسب منه أعداد الحضور والغياب وأسماؤهم أعلاه</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.attendance.map((r) => (
                <div key={r.placementId} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5" data-member={r.universityId}>
                  <div className="min-w-[10rem] flex-1">
                    <div className="text-sm font-medium">{r.name}{d.secretaryPlacementId === r.placementId && <Badge variant="teal" className="ms-2">أمين الاجتماع</Badge>}</div>
                    <div className="text-xs tabular-nums text-muted-foreground">{r.universityId}</div>
                  </div>
                  {editAll ? (
                    <div role="radiogroup" aria-label={`حضور ${r.name}`} className="flex gap-1 rounded-lg border bg-card p-1">
                      {ATT_OPTIONS.map((s) => (
                        <button key={s} type="button" role="radio" aria-checked={r.status === s} onClick={() => setAttendance(r.placementId, { status: s, ...(s === "PRESENT" ? { excuse: null } : {}) })}
                          className={cn("rounded-md px-2.5 py-1 text-xs transition-colors", r.status === s ? (s === "PRESENT" ? "bg-emerald-600 text-white" : s === "ABSENT_EXCUSED" ? "bg-amber-500 text-white" : "bg-red-600 text-white") : "text-muted-foreground hover:bg-muted")}>
                          {MEETING_ATTENDANCE_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Badge variant={r.status === "PRESENT" ? "success" : r.status === "ABSENT_EXCUSED" ? "warning" : "destructive"}>{MEETING_ATTENDANCE_LABELS[r.status]}</Badge>
                  )}
                  {r.status === "ABSENT_EXCUSED" && (editAll
                    ? <Input aria-label={`عذر ${r.name}`} className="h-8 w-full sm:w-56" placeholder="العذر (اختياري)" value={r.excuse ?? ""} onChange={(e) => setAttendance(r.placementId, { excuse: e.target.value || null })} />
                    : r.excuse && <span className="text-xs text-muted-foreground">({r.excuse})</span>)}
                </div>
              ))}
              <div className="space-y-1.5 pt-2">
                <Label htmlFor="m-secretary">أمين الاجتماع (أحد المتدربين الحاضرين)</Label>
                {editAll ? (
                  <Select id="m-secretary" value={d.secretaryPlacementId ?? ""} onChange={(e) => set("secretaryPlacementId", e.target.value || null)} className="max-w-sm">
                    <option value="">— اختر —</option>
                    {d.attendance.filter((r) => r.status === "PRESENT").map((r) => <option key={r.placementId} value={r.placementId}>{r.name}</option>)}
                  </Select>
                ) : <p className="text-sm">{m.secretaryName ?? "—"}</p>}
              </div>
            </CardContent>
          </Card>

          {/* ثانياً / جدول الأعمال */}
          <Card>
            <CardHeader className="rounded-t-xl border-b bg-qu-navy-50/60 pb-3"><CardTitle className="text-qu-navy-800">ثانيًا / جدول الأعمال</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-4">
              {m.number > 1 && <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">١. {PREVIOUS_MINUTES_ITEM} <span className="text-xs text-muted-foreground">(بند ثابت)</span></p>}
              {editAll ? (
                <ListField id="m-agenda" value={d.agendaItems} onChange={(v) => set("agendaItems", v)} max={20} addLabel="إضافة بند" itemPlaceholder="بند من بنود جدول الأعمال" />
              ) : (
                <ol className="list-inside list-decimal space-y-1 px-3 text-sm" start={m.number > 1 ? 2 : 1}>{d.agendaItems.map((x, i) => <li key={i}>{x}</li>)}</ol>
              )}
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">{STANDING_AGENDA_ITEM} <span className="text-xs text-muted-foreground">(بند ثابت)</span></p>
            </CardContent>
          </Card>

          {/* ثالثاً / محضر الاجتماع */}
          <Card>
            <CardHeader className="rounded-t-xl border-b bg-qu-navy-50/60 pb-3">
              <CardTitle className="text-qu-navy-800">ثالثًا / محضر الاجتماع</CardTitle>
              <CardDescription>يتم تسجيل ما تم مناقشته في كل جزئية من جدول الأعمال.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {editMinutes ? (
                <NarrativeField id="m-minutes" value={d.minutes ?? ""} onChange={(v) => set("minutes", v)} rule={{ minWords: MINUTES_MIN_WORDS }} rows={8} />
              ) : <div className="whitespace-pre-line rounded-md bg-muted/40 px-3 py-2 text-sm leading-7">{d.minutes || "—"}</div>}
            </CardContent>
          </Card>

          {/* رابعاً / القرارات والتوصيات */}
          <Card>
            <CardHeader className="rounded-t-xl border-b bg-qu-navy-50/60 pb-3"><CardTitle className="text-qu-navy-800">رابعًا / القرارات والتوصيات</CardTitle></CardHeader>
            <CardContent className="pt-4">
              {editMinutes ? (
                <ListField id="m-decisions" value={d.decisions} onChange={(v) => set("decisions", v)} max={20} addLabel="إضافة قرار أو توصية" />
              ) : <ol className="list-inside list-decimal space-y-1 text-sm">{d.decisions.map((x, i) => <li key={i}>{x}</li>)}</ol>}
            </CardContent>
          </Card>

          {/* التوقيعات: الأعضاء | أمين الاجتماع | رئيس الاجتماع */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-3">
              <div className="mb-2 text-center text-sm font-semibold text-qu-navy-800">الأعضاء</div>
              <ul className="space-y-0.5 text-center text-xs text-muted-foreground">{presentNames.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
            {(["MEETING_SECRETARY", "MEETING_CHAIR"] as const).map((slot) => {
              const s = sig(slot);
              return (
                <div key={slot} className="rounded-xl border bg-card p-3 text-center" data-slot={slot}>
                  <div className="mb-2 text-sm font-semibold text-qu-navy-800">{slot === "MEETING_SECRETARY" ? "أمين الاجتماع" : "رئيس الاجتماع"}</div>
                  {s ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageData} alt={`توقيع ${s.signerName}`} className="mx-auto h-16 object-contain" />
                      <div className="text-sm">{s.signerName}</div>
                    </>
                  ) : <div className="rounded-md border border-dashed py-6 text-xs text-muted-foreground">لم يوقَّع بعد</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* الشريط الجانبي */}
        <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start print:hidden">
          {(editAll || editMinutes) && (
            <div className="rounded-xl border bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                {saveState === "saving" && <><LoaderCircle className="size-3.5 animate-spin" /> جارٍ الحفظ…</>}
                {saveState === "saved" && <><CircleCheck className="size-3.5 text-emerald-600" /> حُفظت كل التعديلات</>}
                {saveState === "dirty" && <><CloudUpload className="size-3.5" /> تعديلات بانتظار الحفظ التلقائي</>}
                {saveState === "error" && <span className="text-red-700">{saveError ?? "تعذر الحفظ"}</span>}
                {saveState === "idle" && "يُحفظ تلقائياً أثناء الكتابة"}
              </p>
              {issues.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs" aria-label="نواقص المحضر">
                  {issues.map((x) => <li key={x} className="flex items-start gap-1.5 text-red-700"><TriangleAlert className="mt-0.5 size-3 shrink-0" /> {x}</li>)}
                </ul>
              )}
              {issues.length === 0 && m.status === "DRAFT" && <p className="mt-2 text-xs text-emerald-700">المحضر مكتمل وجاهز للرفع</p>}
            </div>
          )}
          {(a.submit || a.approve || a.return || a.delete) && (
            <div className="space-y-2 rounded-xl border bg-card p-4">
              {a.submit && <Button className="w-full" disabled={issues.length > 0} onClick={() => setDialog("SUBMIT")}><PenLine /> {MEETING_ACTION_LABELS.SUBMIT}</Button>}
              {a.approve && <Button className="w-full" onClick={() => setDialog("APPROVE")}><BadgeCheck /> {MEETING_ACTION_LABELS.APPROVE}</Button>}
              {a.return && <Button className="w-full" variant="outline" onClick={() => setDialog("RETURN")}><Undo2 /> {MEETING_ACTION_LABELS.RETURN}</Button>}
              {a.delete && (
                <Button variant="ghost" className="w-full text-red-700" onClick={async () => {
                  if (!window.confirm("حذف مسودة الاجتماع؟")) return;
                  const res = await fetch(`/api/meetings/${m.id}`, { method: "DELETE" });
                  if (res.ok) { router.push("/meetings"); router.refresh(); } else window.alert((await res.json()).error);
                }}><Trash2 /> حذف المسودة</Button>
              )}
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={() => window.print()}><Printer /> طباعة</Button>
        </aside>
      </div>

      {dialog && (
        <SignDialog
          title={MEETING_ACTION_LABELS[dialog]}
          description={dialog === "SUBMIT" ? "بتوقيعك تقر بأن المحضر يطابق ما دار في الاجتماع. تُحفظ مع التوقيع بصمة رقمية للمحتوى." : dialog === "APPROVE" ? "اعتماد المحضر نهائياً. لا يمكن تعديله بعد ذلك." : "يعود المحضر للأمين لتعديله، ويُلغى توقيعه."}
          confirmLabel={MEETING_ACTION_LABELS[dialog]}
          signerLabel={dialog === "SUBMIT" ? "توقيع أمين الاجتماع" : "توقيع رئيس الاجتماع"}
          mode={dialog === "RETURN" ? "comment" : "sign"}
          destructive={dialog === "RETURN"}
          onClose={() => setDialog(null)}
          onConfirm={(p) => transition(dialog, p)}
        />
      )}
    </div>
  );
}
