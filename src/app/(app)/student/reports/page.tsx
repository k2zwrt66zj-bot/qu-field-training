import { redirect } from "next/navigation";

/** التقارير القديمة أصبحت ضمن «السجل المهني» (النماذج الإضافية + الأرشيف) */
export default function LegacyStudentReports() {
  redirect("/portfolio");
}
