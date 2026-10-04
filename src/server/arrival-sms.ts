// =====================================================================
//  رسالة وصول المتدرب للمشرف المؤسسي (اختيارية: يفعّلها المشرف من صفحته)
//  تُرسل مرة واحدة عند أول تحضير ناجح في اليوم، بعد إرسال الرد للطالب (لا تؤخر التحضير)
// =====================================================================
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/api";
import { arrivalMessage, maskMobile, normalizeSaudiMobile } from "@/lib/sms-format";
import { sendSms } from "./sms";

export async function notifyArrival(recordId: string): Promise<void> {
  try {
    const rec = await prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      select: {
        checkInAt: true,
        status: true,
        placement: {
          select: {
            organization: { select: { name: true } },
            student: { select: { gender: true, user: { select: { fullName: true } } } },
            fieldSupervisor: { select: { smsOnArrival: true, user: { select: { id: true, phone: true, isActive: true } } } },
          },
        },
      },
    });
    const sup = rec?.placement.fieldSupervisor;
    if (!rec?.checkInAt || !sup?.smsOnArrival || !sup.user.isActive) return;

    const to = normalizeSaudiMobile(sup.user.phone);
    if (!to) {
      await audit(null, "sms.arrival", "AttendanceRecord", recordId, { sent: false, reason: "لا يوجد رقم جوال صالح للمشرف" });
      return;
    }
    const p = rec.placement;
    const body = arrivalMessage({
      studentName: p.student.user.fullName,
      female: p.student.gender === "FEMALE",
      organization: p.organization.name,
      at: rec.checkInAt,
      late: rec.status === "LATE",
    });
    const result = await sendSms(to, body);
    await audit(null, "sms.arrival", "AttendanceRecord", recordId, { ...result, to: maskMobile(to), supervisorId: sup.user.id });
  } catch (e) {
    // لا يؤثر فشل الرسالة على التحضير نفسه
    console.error("[sms.arrival]", e);
  }
}
