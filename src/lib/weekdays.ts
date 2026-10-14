/** أيام الأسبوع بترقيم getUTCDay لتواريخ «اليوم فقط» (0=الأحد ... 6=السبت) */
export const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;

/** «الأحد» أو «الأحد، الثلاثاء» */
export const formatWorkDays = (days: number[]) =>
  days.length === 7 ? "كل أيام الأسبوع" : [...days].sort((a, b) => a - b).map((d) => WEEKDAYS_AR[d]).join("، ");
