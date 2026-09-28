"use client";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// ألوان الفئات (هوية الجامعة) - تم التحقق من تمايزها لعمى الألوان
const CAT = { green: "#0f6b45", gold: "#b8963e" };
// ألوان الحالة محجوزة للحالة فقط (حاضر/متأخر/غائب) وتظهر دائماً مع وسيلة إيضاح
const STATUS = { PRESENT: "#15803d", LATE: "#d97706", ABSENT: "#dc2626" };
const AXIS = { fontSize: 12, fill: "hsl(150 3% 42%)" };
const GRID = "hsl(150 5% 90%)";

const tooltipStyle = {
  contentStyle: { direction: "rtl" as const, borderRadius: 8, border: "1px solid hsl(150 5% 86%)", fontSize: 12 },
  cursor: { fill: "hsl(150 5% 93%)" },
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });

/** اتجاه الحضور اليومي (أعمدة مكدسة بالحالة) */
export function AttendanceTrendChart({ data }: { data: { date: string; PRESENT: number; LATE: number; ABSENT: number }[] }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={dayLabel} tick={AXIS} axisLine={false} tickLine={false} reversed />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} orientation="right" width={32} />
        <Tooltip {...tooltipStyle} labelFormatter={(l) => dayLabel(String(l))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="PRESENT" name="حاضر" stackId="a" fill={STATUS.PRESENT} stroke="#fff" strokeWidth={1} />
        <Bar dataKey="LATE" name="متأخر" stackId="a" fill={STATUS.LATE} stroke="#fff" strokeWidth={1} />
        <Bar dataKey="ABSENT" name="غائب" stackId="a" fill={STATUS.ABSENT} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** توزيع المتدربين حسب التخصص والجنس (سلسلتان + تسميات مباشرة) */
export function MajorGenderChart({ data }: { data: { major: string; طلاب: number; طالبات: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="major" tick={AXIS} axisLine={false} tickLine={false} reversed />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} orientation="right" width={32} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="طلاب" fill={CAT.green} radius={[4, 4, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="طلاب" position="top" style={{ fontSize: 12, fill: "hsl(150 6% 13%)" }} />
        </Bar>
        <Bar dataKey="طالبات" fill={CAT.gold} radius={[4, 4, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="طالبات" position="top" style={{ fontSize: 12, fill: "hsl(150 6% 13%)" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** أعمدة أفقية لسلسلة واحدة (التصنيفات) — HTML خالص ليتوافق تماماً مع اتجاه RTL */
export function HorizontalBarChart({ data, dataKey, labelKey }: { data: Record<string, string | number>[]; dataKey: string; labelKey: string }) {
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((d) => Number(d[dataKey])));
  return (
    <ul className="space-y-2.5" aria-label="عدد المتدربين حسب التصنيف">
      {data.map((d) => {
        const v = Number(d[dataKey]);
        return (
          <li key={String(d[labelKey])} className="group grid grid-cols-[110px_1fr_28px] items-center gap-2 text-xs" title={`${d[labelKey]}: ${v}`}>
            <span className="truncate text-muted-foreground">{d[labelKey]}</span>
            <span className="h-5 rounded-s-none rounded-e bg-muted/60">
              <span className="block h-full rounded-e transition-opacity group-hover:opacity-80" style={{ width: `${(v / max) * 100}%`, background: CAT.green }} />
            </span>
            <span className="font-semibold tabular-nums">{v}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** توزيع التقديرات */
export function GradeDistributionChart({ data }: { data: { grade: string; count: number }[] }) {
  if (!data.some((d) => d.count)) return <Empty text="لم تُحتسب الدرجات بعد" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="grade" tick={{ ...AXIS, direction: "ltr" }} axisLine={false} tickLine={false} reversed />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} orientation="right" width={32} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="عدد الطلاب" fill={CAT.green} radius={[4, 4, 0, 0]} maxBarSize={40}>
          <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: "hsl(150 6% 13%)" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ text = "لا توجد بيانات بعد" }: { text?: string }) {
  return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{text}</div>;
}
