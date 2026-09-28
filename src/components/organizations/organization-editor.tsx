"use client";
import dynamic from "next/dynamic";
import { useCallback, useState, useTransition } from "react";
import { ClipboardPaste, LoaderCircle, LocateFixed, Save, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ORG_CATEGORY_LABELS } from "@/lib/labels";
import { parseCoordinates } from "@/lib/geo/parse-coords";
import type { OrganizationInput } from "@/lib/validation/organization";
import { cn } from "@/lib/utils";

const LocationPickerMap = dynamic(() => import("./location-picker-map"), {
  ssr: false,
  loading: () => <div className="flex h-80 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground md:h-[420px]">جارٍ تحميل الخريطة...</div>,
});

export type OrgFormValues = Required<{ [K in keyof OrganizationInput]: NonNullable<OrganizationInput[K]> }>;

export const EMPTY_ORG: OrgFormValues = {
  name: "", category: "MEDICAL", city: "بريدة", address: "", latitude: 26.3292, longitude: 43.975, geofenceRadius: 100,
  genderScope: "BOTH", acceptedMajors: [], capacityMale: 0, capacityFemale: 0, contactName: "", contactTitle: "سعادة مدير",
  contactPhone: "", contactEmail: "", workStartTime: "08:00", workEndTime: "13:00", isApproved: true, notes: "",
};

type Errors = Partial<Record<keyof OrgFormValues | "form", string>>;

/**
 * نموذج إضافة/تعديل جهة تدريب مع منتقي الموقع:
 * النقر على الخريطة أو سحب الدبوس، لصق رابط خرائط Google، أو "موقعي الحالي" عند زيارة الجهة.
 */
export function OrganizationEditor({
  orgId,
  initial,
  activeTrainees,
  onSaved,
  onDeleted,
}: {
  orgId: string | null;
  initial: OrgFormValues;
  activeTrainees: number;
  onSaved: (message: string) => void;
  onDeleted: () => void;
}) {
  const [v, setV] = useState<OrgFormValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [link, setLink] = useState("");
  const [locMsg, setLocMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [locating, setLocating] = useState(false);

  const set = <K extends keyof OrgFormValues>(k: K, val: OrgFormValues[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const setCoords = useCallback((latitude: number, longitude: number) => setV((s) => ({ ...s, latitude, longitude })), []);
  const moved = orgId != null && (Math.abs(v.latitude - initial.latitude) > 1e-6 || Math.abs(v.longitude - initial.longitude) > 1e-6 || v.geofenceRadius !== initial.geofenceRadius);

  async function applyLink() {
    setLocMsg(null);
    const local = parseCoordinates(link);
    if (local) {
      setCoords(local.latitude, local.longitude);
      return setLocMsg({ ok: true, text: "تم تحديد الموقع من الرابط — تحقق من مكان الدبوس على الخريطة" });
    }
    const res = await fetch(`/api/geo/resolve?url=${encodeURIComponent(link)}`);
    const json = await res.json();
    if (!res.ok) return setLocMsg({ ok: false, text: json.error });
    setCoords(json.latitude, json.longitude);
    setLocMsg({ ok: true, text: "تم فك الرابط المختصر وتحديد الموقع" });
  }

  function useMyLocation() {
    setLocating(true);
    setLocMsg(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setCoords(Math.round(p.coords.latitude * 1e6) / 1e6, Math.round(p.coords.longitude * 1e6) / 1e6);
        setLocMsg(
          p.coords.accuracy > 30
            ? { ok: false, text: `الدقة الحالية ±${Math.round(p.coords.accuracy)} م فقط — اخرج لمكان مكشوف أو صحّح الدبوس يدوياً` }
            : { ok: true, text: `تم التحديد بدقة ±${Math.round(p.coords.accuracy)} م` }
        );
      },
      () => {
        setLocating(false);
        setLocMsg({ ok: false, text: "تعذر تحديد موقعك — تأكد من منح صلاحية الموقع" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function save() {
    setErrors({});
    start(async () => {
      const res = await fetch(orgId ? `/api/organizations/${orgId}` : "/api/organizations", {
        method: orgId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const json = await res.json();
      if (!res.ok) {
        const errs: Errors = { form: json.error };
        for (const d of json.details ?? []) errs[d.path as keyof Errors] = d.message;
        return setErrors(errs);
      }
      onSaved(orgId ? (json.movedMeters > 0 ? `تم الحفظ — نُقل موقع الجهة ${json.movedMeters} م` : "تم حفظ التعديلات") : "تمت إضافة الجهة");
    });
  }

  function remove() {
    if (!orgId || !confirm("حذف الجهة نهائياً؟ سيتم تعطيل حسابات مشرفيها الميدانيين.")) return;
    start(async () => {
      const res = await fetch(`/api/organizations/${orgId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) return setErrors({ form: json.error });
      onDeleted();
    });
  }

  const field = (k: keyof OrgFormValues, label: string, input: React.ReactNode, className?: string) => (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={k}>{label}</Label>
      {input}
      {errors[k] && <p className="text-xs text-red-700">{errors[k]}</p>}
    </div>
  );
  const num = (s: string) => (s === "" ? 0 : Number(s));

  return (
    <div className="space-y-6">
      {/* الموقع والنطاق */}
      <section className="space-y-3">
        <h3 className="font-semibold text-qu-navy-700">الموقع الجغرافي ونطاق التحضير</h3>
        <p className="text-xs text-muted-foreground">انقر على الخريطة أو اسحب الدبوس إلى مدخل المبنى. استخدم طبقة «قمر صناعي» من زر الطبقات لرؤية المباني بدقة.</p>
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <Input value={link} onChange={(e) => setLink(e.target.value)} dir="ltr" placeholder="الصق رابط خرائط Google أو الإحداثيات: 26.3415, 43.9632" aria-label="رابط الخرائط" />
          <Button type="button" variant="outline" onClick={applyLink} disabled={!link.trim()}><ClipboardPaste /> تطبيق الرابط</Button>
          <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
            {locating ? <LoaderCircle className="animate-spin" /> : <LocateFixed />} موقعي الحالي
          </Button>
        </div>
        {locMsg && <p className={cn("rounded-md p-2 text-sm", locMsg.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>{locMsg.text}</p>}
        <LocationPickerMap latitude={v.latitude} longitude={v.longitude} radius={v.geofenceRadius} onChange={setCoords} />
        <div className="grid gap-3 md:grid-cols-3">
          {field("latitude", "خط العرض", <Input id="latitude" type="number" step="0.000001" value={v.latitude} onChange={(e) => set("latitude", num(e.target.value))} />)}
          {field("longitude", "خط الطول", <Input id="longitude" type="number" step="0.000001" value={v.longitude} onChange={(e) => set("longitude", num(e.target.value))} />)}
          {field(
            "geofenceRadius",
            `نصف قطر النطاق: ${v.geofenceRadius} م`,
            <input id="geofenceRadius" type="range" min={30} max={500} step={10} value={v.geofenceRadius} onChange={(e) => set("geofenceRadius", Number(e.target.value))} className="w-full accent-[#0f486e]" />
          )}
        </div>
        {moved && activeTrainees > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            لدى هذه الجهة {activeTrainees} متدرب/ة في الفصل الحالي؛ تغيير الموقع أو النطاق يسري على تحضيرهم فوراً ويُوثَّق في سجل التدقيق.
          </p>
        )}
      </section>

      {/* البيانات الأساسية */}
      <section className="grid gap-3 md:grid-cols-2">
        <h3 className="font-semibold text-qu-navy-700 md:col-span-2">بيانات الجهة</h3>
        {field("name", "اسم الجهة *", <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} />, "md:col-span-2")}
        {field("category", "التصنيف", (
          <Select id="category" value={v.category} onChange={(e) => set("category", e.target.value as OrgFormValues["category"])}>
            {Object.entries(ORG_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        ))}
        {field("city", "المدينة *", <Input id="city" value={v.city} onChange={(e) => set("city", e.target.value)} />)}
        {field("address", "العنوان التفصيلي", <Input id="address" value={v.address} onChange={(e) => set("address", e.target.value)} />, "md:col-span-2")}
        {field("workStartTime", "بداية الدوام", <Input id="workStartTime" type="time" value={v.workStartTime} onChange={(e) => set("workStartTime", e.target.value)} />)}
        {field("workEndTime", "نهاية الدوام", <Input id="workEndTime" type="time" value={v.workEndTime} onChange={(e) => set("workEndTime", e.target.value)} />)}
      </section>

      {/* الاستيعاب */}
      <section className="grid gap-3 md:grid-cols-4">
        <h3 className="font-semibold text-qu-navy-700 md:col-span-4">الاستيعاب والتخصصات</h3>
        {field("genderScope", "تستقبل", (
          <Select id="genderScope" value={v.genderScope} onChange={(e) => {
            const g = e.target.value as OrgFormValues["genderScope"];
            setV((s) => ({ ...s, genderScope: g, capacityMale: g === "FEMALE_ONLY" ? 0 : s.capacityMale, capacityFemale: g === "MALE_ONLY" ? 0 : s.capacityFemale }));
          }}>
            <option value="BOTH">طلاب وطالبات</option>
            <option value="MALE_ONLY">طلاب فقط</option>
            <option value="FEMALE_ONLY">طالبات فقط</option>
          </Select>
        ))}
        {field("capacityMale", "طاقة الطلاب", <Input id="capacityMale" type="number" min={0} disabled={v.genderScope === "FEMALE_ONLY"} value={v.capacityMale} onChange={(e) => set("capacityMale", num(e.target.value))} />)}
        {field("capacityFemale", "طاقة الطالبات", <Input id="capacityFemale" type="number" min={0} disabled={v.genderScope === "MALE_ONLY"} value={v.capacityFemale} onChange={(e) => set("capacityFemale", num(e.target.value))} />)}
        <div className="space-y-1.5">
          <Label>التخصصات المقبولة</Label>
          <div className="flex h-10 items-center gap-4 text-sm">
            {(["SOCIAL_WORK", "SOCIOLOGY"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={v.acceptedMajors.includes(m)}
                  onChange={(e) => set("acceptedMajors", e.target.checked ? [...v.acceptedMajors, m] : v.acceptedMajors.filter((x) => x !== m))}
                />
                {m === "SOCIAL_WORK" ? "خدمة اجتماعية" : "علم اجتماع"}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">بدون تحديد = التخصصان</p>
        </div>
      </section>

      {/* التواصل */}
      <section className="grid gap-3 md:grid-cols-2">
        <h3 className="font-semibold text-qu-navy-700 md:col-span-2">التواصل والخطابات</h3>
        {field("contactTitle", "صيغة المخاطبة في الخطاب", (
          <Select id="contactTitle" value={v.contactTitle} onChange={(e) => set("contactTitle", e.target.value)}>
            {["سعادة مدير", "سعادة مديرة", "سعادة رئيس", "سعادة رئيسة", "سعادة المدير العام", "سعادة المشرف على"].map((t) => <option key={t}>{t}</option>)}
          </Select>
        ))}
        {field("contactName", "اسم المسؤول", <Input id="contactName" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} />)}
        {field("contactPhone", "الهاتف", <Input id="contactPhone" dir="ltr" value={v.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />)}
        {field("contactEmail", "البريد الإلكتروني", <Input id="contactEmail" dir="ltr" type="email" value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />)}
        {field("notes", "ملاحظات داخلية", <Textarea id="notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} />, "md:col-span-2")}
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={v.isApproved} onChange={(e) => set("isApproved", e.target.checked)} />
          جهة معتمدة ومتاحة للتوزيع
        </label>
      </section>

      {errors.form && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{errors.form}</p>}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t bg-card px-4 py-3 md:-mx-5 md:px-5">
        <Button onClick={save} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Save />} {orgId ? "حفظ التعديلات" : "إضافة الجهة"}</Button>
        {orgId && (
          <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={remove} disabled={pending}>
            <Trash2 /> حذف الجهة
          </Button>
        )}
      </div>
    </div>
  );
}
