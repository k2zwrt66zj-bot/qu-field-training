"use client";
import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ORG_CATEGORY_LABELS } from "@/lib/labels";
import { EMPTY_ORG, OrganizationEditor, type OrgFormValues } from "./organization-editor";

const OverviewMap = dynamic(() => import("./organizations-overview-map"), {
  ssr: false,
  loading: () => <div className="h-72 rounded-lg bg-muted" />,
});

export interface OrgRow extends OrgFormValues {
  id: string;
  trainees: number;
  supervisors: { id: string; fullName: string; email: string; phone: string | null; isActive: boolean }[];
}

export function OrganizationsManager({ orgs }: { orgs: OrgRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<OrgRow | "new" | null>(null);
  const [supFor, setSupFor] = useState<OrgRow | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      orgs.filter(
        (o) =>
          (!q || o.name.includes(q) || o.city.includes(q)) &&
          (!cat || o.category === cat) &&
          (status === "all" || (status === "active") === o.isApproved)
      ),
    [orgs, q, cat, status]
  );

  const done = (msg: string) => {
    setEditing(null);
    setFlash(msg);
    router.refresh();
  };

  const current = editing === "new" ? null : editing;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3 space-y-0">
          <div>
            <CardTitle>خريطة الجهات</CardTitle>
            <CardDescription>انقر على أي جهة لتعديلها — الدائرة الخضراء هي نطاق التحضير</CardDescription>
          </div>
          <Button onClick={() => setEditing("new")}><Plus /> إضافة جهة</Button>
        </CardHeader>
        <CardContent>
          <OverviewMap orgs={filtered} onSelect={(id) => setEditing(orgs.find((o) => o.id === id) ?? null)} />
        </CardContent>
      </Card>

      {flash && <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{flash}</p>}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-2 space-y-0">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute right-3 top-3 size-4 text-muted-foreground" />
            <Input className="pr-9" placeholder="بحث بالاسم أو المدينة" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" />
          </div>
          <Select className="w-44" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="التصنيف">
            <option value="">كل التصنيفات</option>
            {Object.entries(ORG_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="الحالة">
            <option value="all">كل الحالات</option>
            <option value="active">المعتمدة</option>
            <option value="inactive">الموقوفة</option>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>الجهة</TH><TH>التصنيف</TH><TH>النطاق</TH><TH>الإحداثيات</TH><TH>الطاقة (ط/ط)</TH><TH>المتدربون</TH><TH>المشرفون</TH><TH>الحالة</TH><TH></TH></TR>
            </THead>
            <TBody>
              {filtered.length === 0 && <TR><TD colSpan={9} className="py-8 text-center text-muted-foreground">لا توجد جهات مطابقة</TD></TR>}
              {filtered.map((o) => (
                <TR key={o.id}>
                  <TD><div className="font-medium">{o.name}</div><div className="text-xs text-muted-foreground">{o.city} · {o.workStartTime}–{o.workEndTime}</div></TD>
                  <TD className="text-xs">{ORG_CATEGORY_LABELS[o.category]}</TD>
                  <TD className="whitespace-nowrap tabular-nums">{o.geofenceRadius} م</TD>
                  <TD dir="ltr" className="whitespace-nowrap text-right font-mono text-xs">{o.latitude.toFixed(5)}, {o.longitude.toFixed(5)}</TD>
                  <TD className="whitespace-nowrap tabular-nums">{o.capacityMale} / {o.capacityFemale}</TD>
                  <TD className="tabular-nums">{o.trainees}</TD>
                  <TD>
                    <button onClick={() => setSupFor(o)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      {o.supervisors.filter((s) => s.isActive).length === 0 ? <Badge variant="warning">لا يوجد</Badge> : `${o.supervisors.filter((s) => s.isActive).length} مشرف`}
                      <UserPlus className="size-3.5" />
                    </button>
                  </TD>
                  <TD><Badge variant={o.isApproved ? "success" : "muted"}>{o.isApproved ? "معتمدة" : "موقوفة"}</Badge></TD>
                  <TD>
                    <Button size="sm" variant="outline" onClick={() => setEditing(o)} aria-label={`تعديل ${o.name}`}><Pencil /> تعديل</Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? `تعديل: ${current.name}` : "إضافة جهة تدريب"}
        description={current ? undefined : "حدد موقع المدخل الرئيسي بدقة؛ منه يُحسب نطاق التحضير"}
      >
        {editing !== null && (
          <OrganizationEditor
            key={current?.id ?? "new"}
            orgId={current?.id ?? null}
            initial={current ?? EMPTY_ORG}
            activeTrainees={current?.trainees ?? 0}
            onSaved={done}
            onDeleted={() => done("تم حذف الجهة")}
          />
        )}
      </Dialog>

      <Dialog open={supFor !== null} onClose={() => setSupFor(null)} title={`المشرفون المؤسسيون — ${supFor?.name ?? ""}`} className="max-w-2xl">
        {supFor && <SupervisorsPanel org={supFor} />}
      </Dialog>
    </div>
  );
}

function SupervisorsPanel({ org }: { org: OrgRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string; password?: string } | null>(null);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {org.supervisors.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد مشرفون لهذه الجهة بعد.</p>}
        {org.supervisors.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div><div className="font-medium">{s.fullName}</div><div dir="ltr" className="text-right text-xs text-muted-foreground">{s.email}{s.phone ? ` · ${s.phone}` : ""}</div></div>
            <Badge variant={s.isActive ? "success" : "muted"}>{s.isActive ? "نشط" : "معطل"}</Badge>
          </div>
        ))}
      </div>
      <form
        className="grid gap-3 rounded-lg bg-muted/50 p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          start(async () => {
            const res = await fetch(`/api/organizations/${org.id}/supervisors`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Object.fromEntries(fd)),
            });
            const json = await res.json();
            if (!res.ok) return setResult({ ok: false, text: json.details?.[0]?.message ?? json.error });
            setResult({ ok: true, text: "تم إنشاء الحساب. سلّم كلمة المرور المؤقتة للمشرف — لن تظهر مرة أخرى:", password: json.tempPassword });
            form.reset();
            router.refresh();
          });
        }}
      >
        <h4 className="font-semibold md:col-span-2">إضافة مشرف مؤسسي</h4>
        <div className="space-y-1"><Label htmlFor="sup-name">الاسم</Label><Input id="sup-name" name="fullName" required minLength={3} /></div>
        <div className="space-y-1"><Label htmlFor="sup-email">البريد الإلكتروني</Label><Input id="sup-email" name="email" type="email" dir="ltr" required /></div>
        <div className="space-y-1"><Label htmlFor="sup-phone">الجوال</Label><Input id="sup-phone" name="phone" dir="ltr" /></div>
        <div className="space-y-1">
          <Label htmlFor="sup-gender">الجنس</Label>
          <Select id="sup-gender" name="gender"><option value="MALE">ذكر</option><option value="FEMALE">أنثى</option></Select>
        </div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="sup-title">المسمى الوظيفي</Label><Input id="sup-title" name="jobTitle" placeholder="أخصائي اجتماعي" /></div>
        <Button type="submit" disabled={pending} className="md:col-span-2"><UserPlus /> إنشاء الحساب</Button>
        {result && (
          <div className={`rounded-md p-3 text-sm md:col-span-2 ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {result.text}
            {result.password && <div dir="ltr" className="mt-2 select-all rounded bg-white p-2 text-center font-mono text-base">{result.password}</div>}
          </div>
        )}
      </form>
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> يعتمد المشرف الحضور ويقيّم الطلاب المسندين إليه في هذه الجهة فقط.</p>
    </div>
  );
}
