import { MessageSquareText } from "lucide-react";

/** ملاحظات المشرفين على التقرير */
export function ReportComments({ field, academic, score }: { field?: string | null; academic?: string | null; score?: number | null }) {
  if (!field && !academic && score == null) return null;
  return (
    <div className="space-y-2 print:hidden">
      {field && <Note who="المشرف الميداني" text={field} />}
      {academic && <Note who="المشرف الأكاديمي" text={academic} />}
      {score != null && <p className="rounded-lg bg-qu-gold-50 p-3 text-sm">الدرجة الاسترشادية من المشرف الأكاديمي: <b>{score} / 100</b></p>}
    </div>
  );
}

function Note({ who, text }: { who: string; text: string }) {
  return (
    <div className="flex gap-2 rounded-lg border-s-4 border-qu-gold-500 bg-muted/60 p-3 text-sm">
      <MessageSquareText className="mt-0.5 size-4 shrink-0 text-qu-gold-600" />
      <div><div className="text-xs font-semibold text-qu-gold-600">ملاحظة {who}</div><p className="whitespace-pre-line">{text}</p></div>
    </div>
  );
}
