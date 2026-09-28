import { redirect } from "next/navigation";

/** ما ينتظر توقيع المشرف المؤسسي أصبح في «قائمة الاعتماد» */
export default function LegacyFieldSupervisorLogbooks() {
  redirect("/queue");
}
