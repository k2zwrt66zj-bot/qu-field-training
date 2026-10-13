"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";

const HEADERS = ["fullName", "universityId", "major", "gender", "city", "phone", "district", "level", "gpa"] as const;
// أسماء أعمدة مقبولة (عربية ↔ المفتاح الإنجليزي)
const ALIASES: Record<string, (typeof HEADERS)[number]> = {
  "الاسم": "fullName", "الاسم الكامل": "fullName", fullname: "fullName", name: "fullName",
  "الرقم الجامعي": "universityId", universityid: "universityId", id: "universityId",
  "التخصص": "major", major: "major",
  "الجنس": "gender", gender: "gender",
  "المدينة": "city", city: "city",
  "الجوال": "phone", phone: "phone", mobile: "phone",
  "الحي": "district", district: "district",
  "المستوى": "level", level: "level",
  "المعدل": "gpa", gpa: "gpa",
};

/** محلّل CSV بسيط يدعم الحقول المقتبسة والفواصل والأسطر داخل الاقتباس */
function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, ""); // إزالة BOM
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((x) => x.trim() !== "")) rows.push(row); }
  return rows;
}

function toObjects(text: string): Record<string, string>[] {
  const grid = parseCSV(text);
  if (grid.length < 2) return [];
  const head = grid[0].map((h) => ALIASES[h.trim()] ?? ALIASES[h.trim().toLowerCase()] ?? h.trim());
  return grid.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    head.forEach((h, i) => { if (HEADERS.includes(h as never)) o[h] = (cells[i] ?? "").trim(); });
    return o;
  });
}

function downloadCSV(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Result = {
  createdCount: number; skippedCount: number; total: number;
  created: { fullName: string; universityId: string; email: string; tempPassword: string }[];
  skipped: { row: number; universityId?: string; reason: string }[];
};

/** زر ونافذة لاستيراد دفعة طلاب من ملف CSV/Excel */
export function ImportStudents() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setRows([]); setFileName(""); setErr(null); setResult(null); if (fileRef.current) fileRef.current.value = ""; };

  const onFile = async (f: File | undefined) => {
    setErr(null); setResult(null);
    if (!f) return;
    const text = await f.text();
    const objs = toObjects(text);
    if (objs.length === 0) { setErr("لم يُعثر على صفوف صالحة — تأكد من وجود صف الترويسة وصف واحد على الأقل."); setRows([]); return; }
    setRows(objs); setFileName(f.name);
  };

  const template = () => downloadCSV("قالب-استيراد-الطلاب.csv", [
    ["fullName", "universityId", "major", "gender", "city", "phone", "district", "level", "gpa"],
    ["محمد العنزي", "441100100", "الخدمة الاجتماعية", "طالب", "بريدة", "0551234567", "النهضة", "7", "4.25"],
    ["ريم الحربي", "441100101", "علم الاجتماع", "طالبة", "عنيزة", "", "", "7", ""],
  ]);

  const submit = () => start(async () => {
    setErr(null);
    const res = await fetch("/api/students/import", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(json.details?.[0]?.message ?? json.error ?? "تعذّر الاستيراد");
    setResult(json); router.refresh();
  });

  const exportCreated = () => {
    if (!result?.created.length) return;
    downloadCSV("حسابات-الطلاب-الجدد.csv", [
      ["الاسم", "الرقم الجامعي", "معرّف الدخول", "كلمة المرور المؤقتة"],
      ...result.created.map((c) => [c.fullName, c.universityId, c.email, c.tempPassword]),
    ]);
  };

  return (
    <>
      <Button variant="outline" onClick={() => { reset(); setOpen(true); }}><Upload /> استيراد من Excel</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="استيراد دفعة طلاب" className="max-w-2xl">
        {!result ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pe-5 text-sm text-muted-foreground">
              <li>نزّل القالب واملأه في Excel (أو أي جدول).</li>
              <li>احفظ الملف بصيغة <b>CSV</b> ثم ارفعه هنا.</li>
              <li>راجع العدد ثم اضغط «استيراد».</li>
            </ol>
            <Button variant="outline" size="sm" onClick={template}><FileDown /> تنزيل القالب (CSV)</Button>

            <div className="space-y-1">
              <Label htmlFor="imp-file">ملف الطلاب (CSV)</Label>
              <input ref={fileRef} id="imp-file" type="file" accept=".csv,text/csv"
                onChange={(e) => onFile(e.target.files?.[0])}
                className="block w-full rounded-lg border p-2 text-sm file:me-3 file:rounded-md file:border-0 file:bg-qu-navy-50 file:px-3 file:py-1.5 file:text-qu-navy-700" />
            </div>

            {rows.length > 0 && (
              <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
                تم قراءة <b>{rows.length.toLocaleString("ar-SA")}</b> صفاً من «{fileName}» — جاهزة للاستيراد.
              </div>
            )}
            {err && <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{err}</div>}

            <Button onClick={submit} disabled={pending || rows.length === 0} className="w-full">
              <Upload /> {pending ? "جارٍ الاستيراد…" : `استيراد ${rows.length ? rows.length.toLocaleString("ar-SA") + " طالب" : ""}`}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-emerald-50 p-4 text-center"><div className="text-2xl font-bold text-emerald-700 tabular-nums">{result.createdCount.toLocaleString("ar-SA")}</div><div className="text-xs text-emerald-800">حساب أُنشئ</div></div>
              <div className="rounded-lg bg-amber-50 p-4 text-center"><div className="text-2xl font-bold text-amber-700 tabular-nums">{result.skippedCount.toLocaleString("ar-SA")}</div><div className="text-xs text-amber-800">صف متجاوَز</div></div>
            </div>

            {result.createdCount > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="size-4 shrink-0" />
                <span className="flex-1">نزّل ملف الحسابات (يحوي كلمات المرور المؤقتة) لتسليمها للطلاب — لن تظهر مجدداً.</span>
                <Button size="sm" onClick={exportCreated}><FileDown /> تنزيل الحسابات</Button>
              </div>
            )}

            {result.skipped.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-md border text-sm">
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted text-xs"><tr><th className="p-2 text-start">الصف</th><th className="p-2 text-start">الرقم الجامعي</th><th className="p-2 text-start">سبب التجاوز</th></tr></thead>
                  <tbody>
                    {result.skipped.map((s, i) => (
                      <tr key={i} className="border-t"><td className="p-2 tabular-nums">{s.row}</td><td className="p-2 tabular-nums" dir="ltr">{s.universityId || "—"}</td><td className="p-2 text-amber-700">{s.reason}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>استيراد ملف آخر</Button>
              <Button className="flex-1" onClick={() => setOpen(false)}>تم</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
