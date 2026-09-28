/** المحتوى الذي تُحسب عليه بصمة توقيع التقرير (مشترك بين الخادم والبيانات التجريبية) */
export const signedPayload = (r: { id: string; template: string; title: string; content: unknown; submittedAt: Date | null }) => ({
  id: r.id,
  template: r.template,
  title: r.title,
  content: r.content,
  submittedAt: r.submittedAt?.toISOString() ?? null,
});
