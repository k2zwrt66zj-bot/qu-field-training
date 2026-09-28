import { redirect } from "next/navigation";

/** ما ينتظر اعتماد المشرف الأكاديمي أصبح في «قائمة الاعتماد» */
export default function LegacyAcademicReports() {
  redirect("/queue");
}
