// =====================================================================
//  مستندات PDF الرسمية: النموذج، ومحضر الاجتماع، وكشف الحضور، والسجل المهني الكامل
//  البيانات تمر بالصلاحيات والإخفاء نفسها التي تحكم الواجهة (رقم الملف الطبي مثلاً)
// =====================================================================
import type { Attachment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/api";
import { policyFor, TRAINING_MODE_LABELS } from "@/lib/forms/catalog";
import { can } from "@/lib/forms/permissions";
import { specFor } from "@/lib/forms/ui/specs";
import { customSpec } from "@/lib/forms/ui/custom";
import type { Option } from "@/lib/forms/ui/types";
import { MEETING_ATTENDANCE_LABELS } from "@/lib/meetings";
import { WEEKDAY_LABELS } from "@/lib/forms/catalog";
import { ATTENDANCE_STATUS_LABELS, INSTITUTION, MAJOR_LABELS } from "@/lib/labels";
import { formStatusLabel } from "@/components/forms/form-status-badge";
import { FORM_INCLUDE, type LoadedForm } from "@/server/forms/include";
import { actorFor, formContentHash, modeOf, presentForm } from "@/server/forms/service";
import type { PresentedMeeting } from "@/server/meetings";
import type { LoadedSheet } from "@/server/attendance-sheets";
import { storage } from "@/server/storage";
import { formatTimeAr } from "@/lib/time";
import { renderSpecHtml } from "./spec-html";
import { esc, paras, pdfDate, pdfDateTime, pdfDay, signatureBoxes, slotRole, type DocPart, type SigBox } from "./layout";
import { logoDataUri } from "./engine";

const MAX_PHOTOS = 9;

async function fileDataUri(a: Pick<Attachment, "storageKey" | "mimeType">): Promise<string | null> {
  try {
    const bytes = await storage().get(a.storageKey);
    return `data:${a.mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

async function orgStamp(organizationId: string): Promise<string | null> {
  const a = await prisma.attachment.findFirst({ where: { organizationId, kind: "STAMP" }, orderBy: { createdAt: "desc" } });
  return a ? fileDataUri(a) : null;
}

const metaTable = (rows: [string, unknown][], cols = 2) => {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += cols) {
    const chunk = rows.slice(i, i + cols);
    out.push(`<tr>${chunk.map(([k, v], j) => `<th>${esc(k)}</th><td${j === chunk.length - 1 && chunk.length < cols ? ` colspan="${(cols - chunk.length) * 2 + 1}"` : ""}>${esc(v ?? "—")}</td>`).join("")}</tr>`);
  }
  return `<table class="meta">${out.join("")}</table>`;
};

// ------------------------------------------------------------------ النموذج

export async function formDocPart(user: SessionUser, form: LoadedForm, baseUrl: string): Promise<DocPart> {
  const actor = actorFor(user, form);
  const f = presentForm(form, actor);
  const p = form.placement;
  const mode = modeOf(p);
  const spec = form.kind === "CUSTOM" ? customSpec(form.templateKey) : specFor(form.kind as never, f.domain);

  let caseStudies: Option[] = [];
  if (form.kind === "INTERVIEW") {
    const cs = await prisma.fieldForm.findMany({ where: { placementId: p.id, kind: "CASE_STUDY" }, select: { id: true, sequence: true, caseStudy: { select: { caseAlias: true } } } });
    caseStudies = cs.map((c) => ({ value: c.id, label: `دراسة الحالة ${c.sequence}${c.caseStudy?.caseAlias ? ` — ${c.caseStudy.caseAlias}` : ""}` }));
  }

  // الصور والشواهد: الصور مضمّنة (بعد إزالة بيانات الموقع عند الرفع)، وبقية الملفات بأسمائها
  const photos = form.attachments.filter((a) => a.mimeType.startsWith("image/")).slice(0, MAX_PHOTOS);
  const photoUris = await Promise.all(photos.map(fileDataUri));
  const others = form.attachments.filter((a) => !photos.includes(a));
  const evidence = form.attachments.length
    ? `<h2 class="sec">${esc(spec.evidenceTitle ?? "المرفقات والشواهد")}</h2>
       ${photos.length ? `<div class="photos">${photos.map((a, i) => (photoUris[i] ? `<figure><img src="${photoUris[i]}" alt=""/><figcaption>${esc(a.caption ?? a.fileName)}</figcaption></figure>` : "")).join("")}</div>` : ""}
       ${others.length ? `<ol class="list sans" style="font-size:9pt">${others.map((a) => `<li>${esc(a.fileName)}${a.caption ? ` — ${esc(a.caption)}` : ""}</li>`).join("")}</ol>` : ""}`
    : "";

  // خانات التوقيع حسب سياسة النموذج + اعتماد المشرف الأكاديمي
  const expected = [...f.policy.slotsOnSubmit, ...f.policy.slotsOnFieldSign];
  const stamp = expected.includes("ORG_DIRECTOR") ? await orgStamp(p.organizationId) : null;
  const boxes: SigBox[] = expected.map((slot) => {
    const s = f.signatures.find((x) => x.slot === slot);
    return {
      role: slotRole(slot),
      name: s?.signerName,
      imageData: s?.imageData,
      signedAt: s?.signedAt,
      ...(slot === "ORG_DIRECTOR" ? { stamp: { image: s?.withStamp ? stamp : null } } : {}),
    };
  });
  boxes.push({
    role: "اعتماد المشرف الأكاديمي",
    name: f.academicApprovedAt ? p.academicSupervisor?.user.fullName : null,
    note: f.academicApprovedAt ? `معتمد إلكترونياً${f.academicScore != null ? ` — الدرجة ${f.academicScore}/100` : ""}` : null,
    signedAt: f.academicApprovedAt,
  });

  const status = formStatusLabel(f.status, f.policy.fieldApproval);
  const hash = formContentHash(form);
  const body = `
    <h1 class="title">${esc(f.title)}</h1>
    <div class="subtitle">${esc(f.templateTitle ?? TRAINING_MODE_LABELS[mode])}${form.submittedAt ? ` · رُفع ${pdfDate(form.submittedAt)}` : ""} · <span class="badge ${f.status === "REVIEWED" ? "ok" : f.status === "RETURNED" ? "bad" : "warn"}">${esc(status.label)}</span></div>
    ${metaTable([
      ["الطالب/ـة", p.student.user.fullName],
      ["الرقم الجامعي", p.student.universityId],
      [mode === "SIMULATION" ? "مقر التدريب" : "مؤسسة التدريب", p.organization.name],
      ...(mode === "FIELD" ? ([["المشرف المؤسسي", p.fieldSupervisor?.user.fullName]] as [string, unknown][]) : []),
      ["المشرف الأكاديمي", p.academicSupervisor?.user.fullName],
      ...(p.section ? ([["الشعبة", `${p.section.sectionNumber} — تدريب ميداني رقم (${p.section.trainingNumber})`]] as [string, unknown][]) : []),
    ])}
    ${renderSpecHtml(spec, f.data as Record<string, unknown>, { caseStudies })}
    ${f.apaHtml ? `<div class="field"><div class="lbl">التوثيق وفق APA</div><div class="prose" dir="auto">${f.apaHtml}</div></div>` : ""}
    ${evidence}
    ${signatureBoxes(boxes)}`;
  return { body, label: `${f.title} — ${p.student.user.fullName}`, hash, verifyUrl: `${baseUrl}/verify/f/${form.id}?h=${hash.slice(0, 16)}` };
}

// ------------------------------------------------------------------ محضر الاجتماع

export function meetingDocPart(m: PresentedMeeting): DocPart {
  const sig = (slot: string) => m.signatures.find((s) => s.slot === slot);
  const sec = m.signatures.find((s) => s.slot === "MEETING_SECRETARY");
  const chair = sig("MEETING_CHAIR");
  const body = `
    <h1 class="title">سجل الاجتماعات الإشرافية الجماعية</h1>
    ${metaTable([
      ["مؤسسة التدريب", m.header.organization],
      ["مجال التدريب", m.header.field],
      ["المشرف/ـة الأكاديمي", m.header.academicSupervisor],
      ["إجمالي عدد المتدربين/ المتدربات بالمؤسسة", m.header.trainees],
      ["إجمالي عدد الاجتماعات الإشرافية الجماعية", m.header.meetingsCount],
    ], 1)}
    <h1 class="title" style="font-size:15pt">الاجتماع الإشرافي الجماعي رقم (${m.number})</h1>
    <h2 class="sec">أولاً / الجزء الإحصائي</h2>
    ${metaTable([
      ["اليوم", m.meetingDate ? WEEKDAY_LABELS[new Date(`${m.meetingDate}T12:00:00Z`).getUTCDay()] : "—"],
      ["التاريخ", m.meetingDate ? pdfDay(m.meetingDate) : "—"],
      ["توقيت الاجتماع", m.startTime],
      ["مدة الاجتماع", m.durationMinutes ? `${m.durationMinutes} دقيقة` : "—"],
      ["مكان الاجتماع", m.location],
      ["عدد الحضور", m.counts.present],
      ["عدد الغياب", m.counts.absent],
      ["أمين الاجتماع", m.secretaryName],
      ["أسماء الغياب بعذر", m.counts.excusedNames.join("، ") || "—"],
      ["أسماء الغياب بدون عذر", m.counts.unexcusedNames.join("، ") || "—"],
    ])}
    <h2 class="sec">ثانيًا / جدول الأعمال</h2>
    <div class="prose"><ol class="list">${m.printedAgenda.map((a) => `<li>${esc(a)}</li>`).join("")}</ol></div>
    <h2 class="sec">ثالثًا / محضر الاجتماع</h2>
    <p class="desc">(يتم تسجيل ما تم مناقشته في كل جزئية من جدول الأعمال).</p>
    <div class="prose">${paras(m.minutes)}</div>
    <h2 class="sec">رابعًا / القرارات والتوصيات</h2>
    <div class="prose">${m.decisions.length ? `<ol class="list">${m.decisions.map((d) => `<li>${esc(d)}</li>`).join("")}</ol>` : `<p class="empty">—</p>`}</div>
    <table class="grid" style="margin-top:12px"><thead><tr><th>الأعضاء</th><th>أمين الاجتماع</th><th>رئيس الاجتماع</th></tr></thead>
      <tbody><tr>
        <td style="width:40%">${m.attendance.filter((a) => a.status === "PRESENT").map((a) => esc(a.name)).join("<br/>") || "—"}</td>
        <td style="text-align:center">${sec ? `<img src="${sec.imageData}" style="max-height:50px" alt=""/><br/>${esc(sec.signerName)}<br/><small>${pdfDateTime(sec.signedAt)}</small>` : "<br/><br/>..................."}</td>
        <td style="text-align:center">${chair ? `<img src="${chair.imageData}" style="max-height:50px" alt=""/><br/>${esc(chair.signerName)}<br/><small>${pdfDateTime(chair.signedAt)}</small>` : "<br/><br/>..................."}</td>
      </tr></tbody></table>
    <table class="grid"><thead><tr><th>م</th><th>المتدرب/ـة</th><th>الرقم الجامعي</th><th>الحضور</th></tr></thead><tbody>
      ${m.attendance.map((a, i) => `<tr><td class="num">${i + 1}</td><td>${esc(a.name)}</td><td class="num">${esc(a.universityId)}</td><td>${esc(MEETING_ATTENDANCE_LABELS[a.status])}${a.excuse ? ` (${esc(a.excuse)})` : ""}</td></tr>`).join("")}
    </tbody></table>`;
  return { body, label: `محضر الاجتماع الإشرافي الجماعي رقم (${m.number}) — ${m.header.organization}` };
}

// ------------------------------------------------------------------ كشف الحضور والانصراف

export function sheetDocPart(s: LoadedSheet): DocPart {
  const h = s.header;
  const present = (r: LoadedSheet["rows"][number]) => !!r.record && ["PRESENT", "LATE"].includes(r.record.status);
  const sigCell = (r: LoadedSheet["rows"][number]) => (present(r) ? (r.record!.geo ? "✓ تحضير جغرافي" : "يدوي") : "");
  const body = `
    <h1 class="title" style="font-size:14.5pt">سجل الحضور والانصراف لمتدربين قسم الاجتماع والخدمة الاجتماعية بجامعة القصيم</h1>
    <table class="meta">
      <tr><th>اسم المؤسسة</th><td>${esc(h.organization)}</td><th>رقم هاتف المؤسسة</th><td class="ltr">${esc(h.phone ?? "—")}</td></tr>
      <tr><th>اسم مدير المؤسسة</th><td>${esc(h.director ?? "—")}</td><th>البريد الالكتروني للمؤسسة</th><td class="ltr">${esc(h.email ?? "—")}</td></tr>
      <tr><th>اسم المشرف المؤسسي</th><td>${esc(h.fieldSupervisors ?? "—")}</td><th>إجمالي عدد المتدربين بالمؤسسة</th><td class="num">${h.trainees}</td></tr>
      <tr><th>اسم المشرف الأكاديمي</th><td>${esc(h.academicSupervisors ?? "—")}</td><th>تاريخ بدء التدريب</th><td>${h.startDate ? pdfDay(h.startDate) : "—"}</td></tr>
      <tr><th>عنوان المؤسسة</th><td>${esc(h.address ?? "—")}</td><th>تاريخ إنتهاء التدريب</th><td>${h.endDate ? pdfDay(h.endDate) : "—"}</td></tr>
    </table>
    <p class="sans" style="font-weight:600;font-size:10.5pt">الأسبوع / ${s.weekNumber ?? "—"} &nbsp;&nbsp;&nbsp; اليوم / ${WEEKDAY_LABELS[s.weekday]} &nbsp;&nbsp;&nbsp; التاريخ / ${pdfDay(s.date)}</p>
    <table class="grid"><thead><tr><th style="width:28px">م</th><th>اسم الطالب/ـة</th><th>وقت الحضور</th><th>التوقيع</th><th>وقت الانصراف</th><th>التوقيع</th></tr></thead><tbody>
      ${s.rows.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${esc(r.name)}${r.record && !present(r) ? ` — <span class="badge ${r.record.status === "ABSENT" ? "bad" : ""}">${esc(ATTENDANCE_STATUS_LABELS[r.record.status])}</span>` : !r.record ? ` — <span class="badge warn">لم يُسجَّل</span>` : ""}</td>
        <td class="num">${r.record?.checkInAt ? formatTimeAr(r.record.checkInAt) : ""}</td><td>${sigCell(r)}</td>
        <td class="num">${r.record?.checkOutAt ? formatTimeAr(r.record.checkOutAt) : ""}</td><td>${r.record?.checkOutAt ? sigCell(r) : ""}</td></tr>`).join("")}
      ${Array.from({ length: Math.max(0, 6 - s.rows.length) }, (_, i) => `<tr><td class="num">${s.rows.length + i + 1}</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`).join("")}
    </tbody></table>
    ${s.sheet ? `<p class="sans" style="font-size:9pt"><span class="badge ${s.sheet.intact ? "ok" : "bad"}">${s.sheet.intact ? "سجلات اليوم مطابقة لما وُقّع عليه" : "تغيّرت سجلات اليوم بعد التوقيع"}</span></p>` : ""}
    <div style="display:flex;justify-content:flex-end">${signatureBoxes([{ role: "توقيع المشرف المؤسسي", name: s.sheet?.signerName, imageData: s.sheet?.imageData, signedAt: s.sheet?.signedAt }]).replace('grid-template-columns: repeat(1, 1fr)', "grid-template-columns: 240px")}</div>`;
  return { body, label: `سجل الحضور والانصراف — ${h.organization} — ${s.date}`, hash: s.sheet?.recordsHash ?? null };
}

// ------------------------------------------------------------------ السجل المهني الكامل

export async function portfolioParts(user: SessionUser, placementId: string, baseUrl: string): Promise<{ title: string; parts: DocPart[] }> {
  const p = await prisma.placement.findUniqueOrThrow({
    where: { id: placementId },
    include: {
      student: { include: { user: true } },
      organization: true,
      term: true,
      section: true,
      fieldSupervisor: { include: { user: true } },
      academicSupervisor: { include: { user: true } },
    },
  });
  const mode = modeOf(p);
  const coverTitle = mode === "FIELD" ? "السجل المهني للتدريب الميداني" : "السجل المهني للتدريب الميداني بالمحاكاة";
  const logo = await logoDataUri();

  // النماذج بترتيب الدليل: غير المسودات فقط (السجل المهني وثيقة ما رُفع واعتُمد)
  const forms = await prisma.fieldForm.findMany({ where: { placementId, status: { not: "DRAFT" } }, include: FORM_INCLUDE });
  const visible = forms
    .filter((f) => can(actorFor(user, f), policyFor(f.kind, mode), { status: f.status, locked: !!f.lockedAt, everSubmitted: !!f.submittedAt }, "EXPORT"))
    .sort((a, b) => policyFor(a.kind).portfolioOrder - policyFor(b.kind).portfolioOrder || a.sequence - b.sequence);
  const formParts: DocPart[] = [];
  for (const f of visible) formParts.push(await formDocPart(user, f, baseUrl));

  // الاجتماعات الإشرافية (المرفوعة والمعتمدة) التي حضرها الطالب أو غاب عنها
  const meetingRows = await prisma.meetingAttendance.findMany({
    where: { placementId, meeting: { status: { not: "DRAFT" } } },
    select: { status: true, meeting: { select: { number: true, meetingDate: true, status: true, organization: { select: { name: true } } } } },
    orderBy: { meeting: { number: "asc" } },
  });

  // سجل حضور الطالب من الكشوف اليومية الموقّعة (سطره فقط — خصوصية بقية المتدربين)
  const records = mode === "FIELD"
    ? await prisma.attendanceRecord.findMany({ where: { placementId }, include: { sheet: { include: { signatures: true } } }, orderBy: { date: "asc" } })
    : [];

  const cover: DocPart = {
    label: coverTitle,
    body: `<div class="cover">
      <img class="logo" src="${logo}" alt=""/>
      <div class="sans" style="color:#0F486E;font-weight:600">${INSTITUTION.university} — ${INSTITUTION.college}<br/>${INSTITUTION.department} — ${INSTITUTION.unit}</div>
      <h1>${coverTitle}</h1>
      <div class="band"></div>
      ${metaTable([
        ["اسم الطالب/ـة", p.student.user.fullName],
        ["الرقم الجامعي", p.student.universityId],
        ["التخصص", MAJOR_LABELS[p.student.major]],
        ["الفصل الدراسي", p.term.name],
        ["اسم المقرر", p.section ? `${p.section.courseName}${p.section.courseCode ? ` (${p.section.courseCode})` : ""}` : "—"],
        ["رقم الشعبة", p.section?.sectionNumber ?? "—"],
        ["تدريب ميداني رقم", p.section?.trainingNumber ?? "—"],
        ["المسار", p.section?.track ?? "—"],
        [mode === "SIMULATION" ? "مقر التدريب" : "مؤسسة التدريب", p.organization.name],
        ...(mode === "FIELD" ? ([["المشرف المؤسسي", p.fieldSupervisor?.user.fullName ?? "—"]] as [string, unknown][]) : []),
        ["المشرف الأكاديمي", p.academicSupervisor?.user.fullName ?? "—"],
        ["مدة التدريب", `${pdfDate(p.startDate)} — ${pdfDate(p.endDate)}`],
      ], 1)}
      <div class="sans" style="font-size:9pt;color:#4a4f57">${INSTITUTION.formsEdition}</div>
    </div>`,
  };

  const toc: DocPart = {
    label: `${coverTitle} — المحتويات`,
    body: `<h1 class="title">محتويات السجل المهني</h1>
      <ol class="toc">
        ${visible.map((f, i) => `<li>${esc(formParts[i].label.split(" — ")[0])} — <span class="badge">${esc(formStatusLabel(f.status, policyFor(f.kind, mode).fieldApproval).label)}</span></li>`).join("")}
        <li>سجل الاجتماعات الإشرافية الجماعية (${meetingRows.length})</li>
        ${mode === "FIELD" ? `<li>سجل الحضور والانصراف (${records.length} يوماً)</li>` : ""}
      </ol>
      <p class="desc">يتضمن السجل النماذج المرفوعة والمعتمدة فقط، لكل نموذج بصمة محتوى ورمز تحقق في تذييله. ${mode === "SIMULATION" ? "التدريب بالمحاكاة: لا يتضمن نموذج المباشرة ولا التقرير التعريفي ولا سجل الحضور الجغرافي." : ""}</p>`,
  };

  const meetingsPart: DocPart = {
    label: "سجل الاجتماعات الإشرافية الجماعية",
    body: `<h1 class="title">سجل الاجتماعات الإشرافية الجماعية</h1>
      <table class="grid"><thead><tr><th>رقم الاجتماع</th><th>التاريخ</th><th>المؤسسة</th><th>حضور المتدرب/ـة</th><th>حالة المحضر</th></tr></thead><tbody>
      ${meetingRows.length ? meetingRows.map((r) => `<tr><td class="num">(${r.meeting.number})</td><td>${pdfDate(r.meeting.meetingDate)}</td><td>${esc(r.meeting.organization.name)}</td><td>${esc(MEETING_ATTENDANCE_LABELS[r.status])}</td><td>${r.meeting.status === "REVIEWED" ? "معتمد" : "بانتظار الاعتماد"}</td></tr>`).join("") : `<tr><td colspan="5" class="empty">لم يُعقد اجتماع بعد</td></tr>`}
      </tbody></table><p class="desc">المحاضر الكاملة تُصدَّر من صفحة كل اجتماع.</p>`,
  };

  const attendancePart: DocPart | null = mode === "FIELD"
    ? {
        label: "سجل الحضور والانصراف",
        body: `<h1 class="title">سجل الحضور والانصراف</h1>
          ${metaTable([["الساعات المعتمدة", `${Math.round((p.approvedMinutes / 60) * 10) / 10} من ${p.requiredHours} ساعة`], ["أيام الحضور", records.filter((r) => ["PRESENT", "LATE"].includes(r.status)).length], ["أيام الغياب", records.filter((r) => r.status === "ABSENT").length], ["أيام في كشوف موقّعة", records.filter((r) => r.sheet?.signedAt).length]])}
          <table class="grid"><thead><tr><th>م</th><th>اليوم</th><th>الحالة</th><th>وقت الحضور</th><th>وقت الانصراف</th><th>الكشف اليومي</th></tr></thead><tbody>
          ${records.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${pdfDay(r.date.toISOString().slice(0, 10))}</td><td>${esc(ATTENDANCE_STATUS_LABELS[r.status])}</td><td class="num">${r.checkInAt ? formatTimeAr(r.checkInAt) : ""}</td><td class="num">${r.checkOutAt ? formatTimeAr(r.checkOutAt) : ""}</td><td>${r.sheet?.signedAt ? `موقّع — ${esc(r.sheet.signatures[0]?.signerName ?? "")}` : "لم يُوقَّع"}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">لا توجد سجلات</td></tr>`}
          </tbody></table>`,
      }
    : null;

  return {
    title: `${coverTitle} — ${p.student.user.fullName}`,
    parts: [cover, toc, ...formParts, meetingsPart, ...(attendancePart ? [attendancePart] : [])],
  };
}
