"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Lock, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Major = "SOCIOLOGY" | "SOCIAL_WORK";
interface Row { key: string; id?: string; section: string; label: string; maxScore: number; major: Major | null }

let tmp = 0;
const newKey = () => `new-${++tmp}`;

/** محرر بنود استمارة التقييم (الميداني أو الأكاديمي) مع مجاميع لحظية لكل تخصص */
export function CriteriaEditor({ termId, type }: { termId: string; type: "FIELD" | "ACADEMIC" }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [original, setOriginal] = useState<Row[]>([]);
  const [locked, setLocked] = useState(0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    fetch(`/api/terms/${termId}/criteria?type=${type}`)
      .then((r) => r.json())
      .then((j: { criteria: (Omit<Row, "key"> & { id: string })[]; locked: number }) => {
        const r = j.criteria.map((c) => ({ key: c.id, id: c.id, section: c.section, label: c.label, maxScore: c.maxScore, major: c.major }));
        setRows(r);
        setOriginal(r);
        setLocked(j.locked);
      });

  useEffect(() => {
    setRows(null);
    setMsg(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId, type]);

  const totals = useMemo(() => {
    const sum = (m: Major) => (rows ?? []).filter((r) => r.major === null || r.major === m).reduce((s, r) => s + (r.maxScore || 0), 0);
    return { SOCIAL_WORK: sum("SOCIAL_WORK"), SOCIOLOGY: sum("SOCIOLOGY") };
  }, [rows]);
  const sections = useMemo(() => [...new Set((rows ?? []).map((r) => r.section).filter(Boolean))], [rows]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(original);

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs!];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  function save() {
    setMsg(null);
    start(async () => {
      const res = await fetch(`/api/terms/${termId}/criteria`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, criteria: rows!.map(({ id, section, label, maxScore, major }) => ({ id, section, label, maxScore, major })) }),
      });
      const json = await res.json();
      if (!res.ok) {
        const d = json.details?.[0];
        return setMsg({ ok: false, text: d ? `البند ${Number(d.path.split(".")[1]) + 1}: ${d.message}` : json.error });
      }
      setMsg({ ok: true, text: "تم حفظ الاستمارة" });
      await load();
    });
  }

  if (!rows) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      {locked > 0 && (
        <p className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <Lock className="size-4 shrink-0" /> الاستمارة مقفلة لهذا الفصل لأنه رُصد بها {locked} تقييم نهائي — لضمان تقييم جميع الطلاب بالمقياس نفسه.
        </p>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        {(["SOCIAL_WORK", "SOCIOLOGY"] as const).map((m) => (
          <Badge key={m} variant={totals[m] === 100 ? "success" : "warning"} className="text-sm">
            {m === "SOCIAL_WORK" ? "الخدمة الاجتماعية" : "علم الاجتماع"}: {totals[m]} درجة{totals[m] !== 100 && " (يُنصح بـ 100)"}
          </Badge>
        ))}
      </div>

      <datalist id={`sections-${type}`}>{sections.map((s) => <option key={s} value={s} />)}</datalist>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-10 p-2">#</th>
              <th className="w-44 p-2 text-start">المحور</th>
              <th className="p-2 text-start">نص البند</th>
              <th className="w-24 p-2 text-start">الدرجة</th>
              <th className="w-40 p-2 text-start">ينطبق على</th>
              <th className="w-28 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const newSection = i === 0 || rows[i - 1].section !== r.section;
              return (
                <tr key={r.key} className={cn("border-t", newSection && i > 0 && "border-t-2 border-t-qu-gold-100")}>
                  <td className="p-2 text-center text-xs text-muted-foreground">{i + 1}</td>
                  <td className="p-1.5"><Input disabled={!!locked} list={`sections-${type}`} value={r.section} onChange={(e) => update(r.key, { section: e.target.value })} aria-label={`محور البند ${i + 1}`} /></td>
                  <td className="p-1.5"><Input disabled={!!locked} value={r.label} onChange={(e) => update(r.key, { label: e.target.value })} aria-label={`نص البند ${i + 1}`} /></td>
                  <td className="p-1.5"><Input disabled={!!locked} type="number" min={1} max={100} value={r.maxScore || ""} onChange={(e) => update(r.key, { maxScore: Number(e.target.value) })} aria-label={`درجة البند ${i + 1}`} /></td>
                  <td className="p-1.5">
                    <Select disabled={!!locked} value={r.major ?? ""} onChange={(e) => update(r.key, { major: (e.target.value || null) as Major | null })} aria-label={`تخصص البند ${i + 1}`}>
                      <option value="">التخصصان</option>
                      <option value="SOCIAL_WORK">الخدمة الاجتماعية</option>
                      <option value="SOCIOLOGY">علم الاجتماع</option>
                    </Select>
                  </td>
                  <td className="p-1.5">
                    <div className="flex justify-end gap-0.5">
                      <Button size="icon" variant="ghost" className="size-8" disabled={!!locked || i === 0} onClick={() => move(i, -1)} aria-label="تحريك لأعلى"><ArrowUp /></Button>
                      <Button size="icon" variant="ghost" className="size-8" disabled={!!locked || i === rows.length - 1} onClick={() => move(i, 1)} aria-label="تحريك لأسفل"><ArrowDown /></Button>
                      <Button size="icon" variant="ghost" className="size-8 text-red-700" disabled={!!locked} onClick={() => setRows(rows.filter((x) => x.key !== r.key))} aria-label="حذف البند"><Trash2 /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!locked && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setRows([...rows, { key: newKey(), section: rows.at(-1)?.section ?? "", label: "", maxScore: 5, major: null }])}>
            <Plus /> إضافة بند
          </Button>
          <Button onClick={save} disabled={pending || !dirty}>{pending ? <LoaderCircle className="animate-spin" /> : <Save />} حفظ الاستمارة</Button>
          {dirty && <Button variant="ghost" onClick={() => { setRows(original); setMsg(null); }}><RotateCcw /> تراجع</Button>}
          {dirty && <span className="text-xs text-amber-700">توجد تعديلات غير محفوظة</span>}
        </div>
      )}
      {msg && <p role="status" className={cn("rounded-md p-2 text-sm", msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>{msg.text}</p>}
    </div>
  );
}
