"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheck, FileDown, CloudUpload, ListChecks, LoaderCircle, Printer, Send, Trash2, TriangleAlert, Undo2, PenLine, BadgeCheck } from "lucide-react";
import type { SignatureSlot } from "@prisma/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FormRenderer } from "./form-renderer";
import { StatusStepper } from "./status-stepper";
import { FormStatusBadge } from "./form-status-badge";
import { Evidence } from "./evidence";
import { Comments } from "./comments";
import { SignaturesView } from "./signatures-view";
import { ActionDialog, type TransitionPayload } from "./action-dialog";
import { specFor } from "@/lib/forms/ui/specs";
import { customSpec } from "@/lib/forms/ui/custom";
import { checkSubmit } from "@/lib/forms/ui/requirements";
import { formatApa, type ApaInput, type ApaSourceType } from "@/lib/forms/apa";
import { ACTION_LABELS, type FormAction } from "@/lib/forms/workflow";
import type { Option } from "@/lib/forms/ui/types";
import type { PresentedForm } from "@/server/forms/service";
import { cn } from "@/lib/utils";

export interface WorkspaceContext {
  caseStudies: Option[];
  hasStamp: boolean;
  directorName: string | null;
  fieldSupervisor: string | null;
  academicSupervisor: string | null;
  backHref: string;
  backLabel: string;
}

const ACTION_ICONS: Record<FormAction, React.ReactNode> = {
  SUBMIT: <Send />, FIELD_SIGN: <PenLine />, FIELD_RETURN: <Undo2 />, ACADEMIC_APPROVE: <BadgeCheck />, ACADEMIC_RETURN: <Undo2 />,
};
const TRANSITIONS: FormAction[] = ["SUBMIT", "FIELD_SIGN", "ACADEMIC_APPROVE", "FIELD_RETURN", "ACADEMIC_RETURN"];
const AUTOSAVE_MS = 2500;

export function FormWorkspace({ initial, context }: { initial: PresentedForm; context: WorkspaceContext }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [data, setData] = useState<Record<string, unknown>>(initial.data);
  const dirty = useRef<Set<string>>(new Set());
  const version = useRef(0);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [serverIssues, setServerIssues] = useState<Record<string, string[]>>({});
  const [showIssues, setShowIssues] = useState(false);
  const [dialog, setDialog] = useState<FormAction | null>(null);

  // تحديث الحالة عند وصول نسخة أحدث من الخادم (بعد router.refresh)
  useEffect(() => {
    setForm(initial);
    if (dirty.current.size === 0) setData(initial.data);
  }, [initial]);

  const official = form.kind !== "CUSTOM";
  const spec = useMemo(() => (official ? specFor(form.kind as never, form.domain) : customSpec(form.templateKey)), [official, form.kind, form.domain, form.templateKey]);
  const readonlyKeys = useMemo(() => new Set(spec.sections.flatMap((s) => s.fields).filter((f) => f.widget.type === "readonly").map((f) => f.key)), [spec]);
  const editable = form.allowedActions.includes("EDIT");

  // المتطلبات لحظياً من قواعد الرفع نفسها
  const stripReadonly = useCallback((d: Record<string, unknown>) => Object.fromEntries(Object.entries(d).filter(([k]) => !readonlyKeys.has(k))), [readonlyKeys]);
  const check = useMemo(() => (official ? checkSubmit(form.kind as never, stripReadonly(data), form.domain) : null), [official, form.kind, form.domain, data, stripReadonly]);
  const totalRequired = useMemo(() => (official ? Object.keys(checkSubmit(form.kind as never, {}, form.domain).byField).length : 0), [official, form.kind, form.domain]);
  const remaining = check ? Object.keys(check.byField).length : 0;
  const progress = totalRequired ? Math.max(0, Math.min(100, ((totalRequired - Math.min(remaining, totalRequired)) / totalRequired) * 100)) : 100;

  // ------------------------------------------------------------ الحفظ
  const save = useCallback(async () => {
    if (dirty.current.size === 0) return true;
    const keys = [...dirty.current];
    const startedAt = version.current;
    const payload = Object.fromEntries(keys.map((k) => [k, data[k]]));
    setSaveState("saving");
    const res = await fetch(`/api/forms/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: payload }) });
    const json = await res.json();
    if (!res.ok) {
      const issues: Record<string, string[]> = {};
      for (const d of json.details ?? []) (issues[(d.path as string).split(".")[0] || "_"] ??= []).push(d.message);
      setServerIssues(issues);
      setSaveState("error");
      return false;
    }
    keys.forEach((k) => dirty.current.delete(k));
    setServerIssues({});
    setForm(json.form);
    // إن لم يعدّل المستخدم أثناء الحفظ نأخذ نسخة الخادم (مثل توثيق APA المولَّد)
    if (version.current === startedAt) setData(json.form.data);
    setSaveState(dirty.current.size ? "dirty" : "saved");
    return true;
  }, [data, form.id]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [saveState, data, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current.size) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const onChange = (key: string, value: unknown) => {
    version.current++;
    dirty.current.add(key);
    setData((d) => ({ ...d, [key]: value }));
    setSaveState("dirty");
  };

  // ------------------------------------------------------------ الإجراءات
  const focusField = (key: string) => {
    const el = document.querySelector(`[data-field="${key}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el?.querySelector("input,textarea,button") as HTMLElement | null)?.focus({ preventScroll: true });
  };

  const openAction = async (action: FormAction) => {
    if (action === "SUBMIT") {
      if (!(await save())) return;
      if (check && !check.ready) {
        setShowIssues(true);
        focusField(Object.keys(check.byField)[0]);
        return;
      }
    }
    setDialog(action);
  };

  const runTransition = async (p: TransitionPayload): Promise<string | null> => {
    const res = await fetch(`/api/forms/${form.id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    const json = await res.json();
    if (!res.ok) return [json.error, ...(json.details ?? []).map((d: { message: string }) => d.message)].filter(Boolean).slice(0, 6).join(" — ");
    setForm(json.form);
    setData(json.form.data);
    setDialog(null);
    router.refresh();
    return null;
  };

  const slotsFor = (a: FormAction): SignatureSlot[] => (a === "SUBMIT" ? form.policy.slotsOnSubmit : a === "FIELD_SIGN" ? form.policy.slotsOnFieldSign : []);
  const expectedSlots = [...form.policy.slotsOnSubmit, ...form.policy.slotsOnFieldSign];
  const issuesShown = showIssues && check ? { ...check.byField, ...serverIssues } : serverIssues;
  const actions = TRANSITIONS.filter((a) => form.allowedActions.includes(a));

  const apaPreview =
    form.kind === "READING" && data.title
      ? formatApa({ ...(data as Partial<ApaInput>), sourceType: (data.sourceType as ApaSourceType) ?? "JOURNAL_ARTICLE", authors: (data.authors as string[]) ?? [], title: data.title as string }).html
      : null;

  return (
    <div className="space-y-4">
      {/* الترويسة */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link href={context.backHref} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="size-4" /> {context.backLabel}</Link>
        <StatusStepper status={form.status} fieldApproval={form.policy.fieldApproval} locked={form.locked} />
      </div>
      <header className="rounded-xl border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {form.templateTitle && <div className="text-xs text-qu-teal-700">{form.templateTitle}</div>}
            <h1 className="text-xl font-bold text-qu-navy-800 md:text-2xl">{form.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {form.mode === "SIMULATION" && <Badge variant="teal">{form.modeLabel}</Badge>}
            <FormStatusBadge status={form.status} fieldApproval={form.policy.fieldApproval} />
            {form.academicScore != null && <Badge variant="success">الدرجة {form.academicScore}/100</Badge>}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-qu-gray-100 p-3 text-xs md:grid-cols-5">
          <div><dt className="text-muted-foreground">الطالب/ـة</dt><dd className="font-medium">{form.placement.student}</dd></div>
          <div><dt className="text-muted-foreground">الرقم الجامعي</dt><dd className="font-medium tabular-nums">{form.placement.universityId}</dd></div>
          <div><dt className="text-muted-foreground">{form.mode === "SIMULATION" ? "مقر التدريب" : "مؤسسة التدريب"}</dt><dd className="font-medium">{form.placement.organization}</dd></div>
          {form.mode === "FIELD" && <div><dt className="text-muted-foreground">المشرف المؤسسي</dt><dd className="font-medium">{context.fieldSupervisor ?? "—"}</dd></div>}
          <div><dt className="text-muted-foreground">المشرف الأكاديمي</dt><dd className="font-medium">{context.academicSupervisor ?? "—"}</dd></div>
        </dl>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <FormRenderer spec={spec} data={data} onChange={onChange} readOnly={!editable} issues={issuesShown} context={{ caseStudies: context.caseStudies }} />
          {apaPreview && (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-1 text-xs font-semibold text-qu-teal-700">معاينة التوثيق وفق APA</div>
              <p className="text-sm leading-7" dir="auto" dangerouslySetInnerHTML={{ __html: apaPreview }} />
            </div>
          )}
          <Evidence formId={form.id} title={spec.evidenceTitle ?? "المرفقات والشواهد"} attachments={form.attachments} canUpload={form.allowedActions.includes("UPLOAD")} />
          <SignaturesView signatures={form.signatures} expected={expectedSlots} />
          <Comments formId={form.id} comments={form.comments} canComment={form.allowedActions.includes("COMMENT")} />
        </div>

        {/* الشريط الجانبي */}
        <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start print:hidden">
          {editable && (
            <div className="rounded-xl border bg-card p-4">
              {official && (
                <>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">اكتمال المتطلبات</span>
                    <span className="font-semibold tabular-nums">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} indicatorClassName={progress === 100 ? "bg-emerald-600" : undefined} />
                </>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                {saveState === "saving" && <><LoaderCircle className="size-3.5 animate-spin" /> جارٍ الحفظ…</>}
                {saveState === "saved" && <><CircleCheck className="size-3.5 text-emerald-600" /> حُفظت كل التعديلات</>}
                {saveState === "dirty" && <><CloudUpload className="size-3.5" /> تعديلات بانتظار الحفظ التلقائي</>}
                {saveState === "error" && <span className="text-red-700">تعذر الحفظ — راجع الحقول المعلَّمة</span>}
                {saveState === "idle" && "يُحفظ تلقائياً أثناء الكتابة"}
              </p>
              {check && !check.ready && (
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowIssues((v) => !v)}><ListChecks /> {showIssues ? "إخفاء النواقص" : `النواقص (${remaining})`}</Button>
              )}
              {showIssues && check && !check.ready && (
                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
                  {Object.entries(check.byField).map(([k, msgs]) => (
                    <li key={k}>
                      <button className="flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-start text-red-700 hover:bg-red-50" onClick={() => focusField(k)}>
                        <TriangleAlert className="mt-0.5 size-3 shrink-0" /> {msgs[0]}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(actions.length > 0 || form.allowedActions.includes("DELETE")) && (
            <div className="space-y-2 rounded-xl border bg-card p-4">
              {actions.map((a) => (
                <Button key={a} className="w-full" variant={a.endsWith("RETURN") ? "outline" : "default"} onClick={() => openAction(a)}>
                  {ACTION_ICONS[a]} {ACTION_LABELS[a]}
                </Button>
              ))}
              {form.allowedActions.includes("DELETE") && (
                <Button variant="ghost" className="w-full text-red-700" onClick={async () => {
                  if (!window.confirm("حذف المسودة نهائياً؟")) return;
                  await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
                  router.push(context.backHref);
                  router.refresh();
                }}><Trash2 /> حذف المسودة</Button>
              )}
            </div>
          )}

          {form.allowedActions.includes("EXPORT") && (
            <a href={`/api/forms/${form.id}/pdf`} target="_blank" rel="noopener" className={buttonVariants({ variant: "default", className: "w-full" })}><FileDown /> تنزيل PDF الرسمي</a>
          )}
          <Button variant="outline" className="w-full" onClick={() => window.print()}><Printer /> طباعة</Button>
          {form.locked && <p className={cn("rounded-lg bg-qu-teal-50 p-3 text-xs text-qu-teal-800")}>النموذج مقفل بعد اعتماد النتيجة النهائية.</p>}
        </aside>
      </div>

      {dialog && (
        <ActionDialog
          action={dialog}
          slots={slotsFor(dialog)}
          withScore={dialog === "ACADEMIC_APPROVE" && form.policy.academicScore}
          directorDefault={context.directorName}
          hasStamp={context.hasStamp}
          onClose={() => setDialog(null)}
          onConfirm={runTransition}
        />
      )}
    </div>
  );
}
