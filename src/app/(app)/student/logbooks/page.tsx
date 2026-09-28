import { redirect } from "next/navigation";

/** السجلات القديمة أصبحت ضمن «السجل المهني» (نموذج تسجيل المهارات والمعارف + الأرشيف) */
export default function LegacyStudentLogbooks() {
  redirect("/portfolio");
}
