// =====================================================================
//  نقل الطالب وإعادة التوزيع (Placement Transfer) — اختبار شامل
//  يتطلب خادماً عاملاً وقاعدة بيانات مبذورة: npm run db:seed
//  التشغيل: npm run test:e2e:transfer
// =====================================================================
import { execFileSync } from "node:child_process";

const B = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/qu_field_training";
const sql = (q) => execFileSync("psql", [DB, "-Atc", q]).toString().trim();

let pass = 0, fail = 0;
const check = (cond, label, extra) => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); } };
const section = (t) => console.log(`\n${t}`);

function jar(){const c=new Map();return{header:()=>[...c].map(([k,v])=>`${k}=${v}`).join("; "),store:(r)=>{for(const s of r.headers.getSetCookie?.()??[]){const[p]=s.split(";");const i=p.indexOf("=");c.set(p.slice(0,i).trim(),p.slice(i+1));}}};}
const sessions = {};
async function as(email){ if(sessions[email]) return sessions[email]; const j=jar();
  const r1=await fetch(`${B}/api/auth/csrf`);j.store(r1);const{csrfToken}=await r1.json();
  const r2=await fetch(`${B}/api/auth/callback/credentials`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Cookie:j.header()},body:new URLSearchParams({csrfToken,email,password:"Qu@12345",json:"true"})});j.store(r2);
  return (sessions[email]=j); }
async function api(email, method, url, body){ const j=await as(email); const h={Cookie:j.header()}; let b; if(body!==undefined){b=JSON.stringify(body);h["Content-Type"]="application/json";}
  const r=await fetch(B+url,{method,headers:h,body:b}); const t=await r.text(); let json; try{json=JSON.parse(t);}catch{json=null;} return {status:r.status,json}; }

const TH = "bushra.aldubaikhi@qu.edu.sa", OLD_FS = "field2@example.sa", NEW_FS = "field1@example.sa", STUDENT = "441100002@qu.edu.sa";

// معرّفات من البذرة (ديناميكياً)
const P_OLD = sql(`select p.id from "Placement" p join "StudentProfile" s on s.id=p."studentId" join "User" u on u.id=s."userId" where u.email like '441100002%' and p.status='ACTIVE'`);
const toOrg = sql(`select f."organizationId" from "FieldSupervisorProfile" f join "User" u on u.id=f."userId" where u.email='field1@example.sa'`);
const toFs = sql(`select f.id from "FieldSupervisorProfile" f join "User" u on u.id=f."userId" where u.email='field1@example.sa'`);
const fromOrg = sql(`select "organizationId" from "Placement" where id='${P_OLD}'`);
const fromFs = sql(`select coalesce("fieldSupervisorId",'') from "Placement" where id='${P_OLD}'`);
// ضمان أن المقر الهدف يختلف
console.log(`الإسناد القديم ${P_OLD}  من مقر ${fromOrg} → إلى ${toOrg}`);

section("أ) التحقق من المدخلات (Validation) — لا تُغيّر بيانات عند الرفض");
let r = await api(TH, "POST", `/api/placements/${P_OLD}/transfer`, { toOrganizationId: toOrg, toFieldSupervisorId: toFs, reason: "قصير", effectiveDate: "2026-10-10", carryOverHours: true });
check(r.status === 422, "رفض سبب أقل من 5 أحرف", r.json);
r = await api(TH, "POST", `/api/placements/${P_OLD}/transfer`, { toOrganizationId: fromOrg, toFieldSupervisorId: fromFs || null, reason: "نفس المقر ونفس المشرف بلا تغيير", effectiveDate: "2026-10-10", carryOverHours: true });
check(r.status === 422 && String(r.json?.error).includes("لا تغيير"), "رفض النقل بلا تغيير (نفس المقر والمشرف)", r.json);
r = await api(TH, "POST", `/api/placements/${P_OLD}/transfer`, { toOrganizationId: toOrg, toFieldSupervisorId: toFs, reason: "تاريخ غير صحيح", effectiveDate: "2026-13-40", carryOverHours: true });
check(r.status === 422, "رفض تاريخ غير صحيح", r.json);

section("ب) صلاحية الدور (RBAC)");
r = await api(STUDENT, "POST", `/api/placements/${P_OLD}/transfer`, { toOrganizationId: toOrg, toFieldSupervisorId: toFs, reason: "محاولة طالب غير مصرّحة", effectiveDate: "2026-10-10", carryOverHours: true });
check(r.status === 401 || r.status === 403, "الطالب لا يملك صلاحية النقل", r.status);
r = await api(OLD_FS, "POST", `/api/placements/${P_OLD}/transfer`, { toOrganizationId: toOrg, toFieldSupervisorId: toFs, reason: "محاولة مشرف غير مصرّحة", effectiveDate: "2026-10-10", carryOverHours: true });
check(r.status === 401 || r.status === 403, "المشرف المؤسسي لا يملك صلاحية النقل", r.status);

section("ج) تنفيذ النقل من رئيسة الوحدة");
const oldHours = Number(sql(`select round("approvedMinutes"/60.0) from "Placement" where id='${P_OLD}'`));
r = await api(TH, "POST", `/api/placements/${P_OLD}/transfer`, { toOrganizationId: toOrg, toFieldSupervisorId: toFs, reason: "إغلاق قسم الخدمة الاجتماعية بالمؤسسة القديمة", effectiveDate: "2026-10-10", carryOverHours: false });
check(r.status === 200 && r.json?.ok && r.json?.toPlacementId, "تم النقل بنجاح", r.json);
const P_NEW = r.json?.toPlacementId;

section("د) أرشفة الإسناد القديم وإنشاء الجديد");
check(sql(`select status from "Placement" where id='${P_OLD}'`) === "TRANSFERRED", "الإسناد القديم صار «منقول»");
const nrow = sql(`select status || '|' || "organizationId" || '|' || coalesce("fieldSupervisorId",'-') from "Placement" where id='${P_NEW}'`).split("|");
check(nrow[0] === "ASSIGNED", "الإسناد الجديد «مسند» (يتطلب مباشرة جديدة)", nrow[0]);
check(nrow[1] === toOrg, "الإسناد الجديد في المقر الجديد", nrow[1]);
check(nrow[2] === toFs, "المشرف المؤسسي الجديد مُسند", nrow[2]);
check(sql(`select "studentId" from "Placement" where id='${P_NEW}'`) === sql(`select "studentId" from "Placement" where id='${P_OLD}'`), "نفس الطالب في الإسناد الجديد");
check(sql(`select coalesce("academicSupervisorId",'-') from "Placement" where id='${P_NEW}'`) === sql(`select coalesce("academicSupervisorId",'-') from "Placement" where id='${P_OLD}'`), "المشرف الأكاديمي لم يتغيّر");
check(sql(`select "approvedMinutes" from "Placement" where id='${P_NEW}'`) === "0", "ساعات الإسناد الجديد تبدأ من الصفر");

section("هـ) سجل النقل وسجل التدقيق");
check(sql(`select count(*) from "PlacementTransfer" where "fromPlacementId"='${P_OLD}' and "toPlacementId"='${P_NEW}'`) === "1", "صف واحد في سجل النقل (PlacementTransfer)");
check(sql(`select "carryOverHours" from "PlacementTransfer" where "fromPlacementId"='${P_OLD}'`) === "f", "خيار «لا تُحتسب الساعات» محفوظ");
check(sql(`select count(*) from "AuditLog" where action='placement.transfer' and "entityId"='${P_OLD}'`) === "1", "العملية مسجّلة في سجل التدقيق");

section("و) إعادة ضبط الصلاحيات");
r = await api(NEW_FS, "GET", `/api/forms?placementId=${P_NEW}`);
check(r.status === 200, "المشرف المؤسسي الجديد يصل للإسناد الجديد", r.status);
r = await api(OLD_FS, "GET", `/api/forms?placementId=${P_NEW}`);
check(r.status === 200 && Array.isArray(r.json?.forms) && r.json.forms.length === 0, "المشرف القديم لا يرى بيانات الإسناد الجديد", r.json);
// المشرف القديم يبقى على بيانات الإسناد القديم (تاريخه)
r = await api(OLD_FS, "GET", `/api/forms?placementId=${P_OLD}`);
check(r.status === 200, "المشرف القديم يحتفظ بالوصول لأرشيف الإسناد القديم", r.status);

section("ز) منع تكرار النقل والتحضير قبل المباشرة");
r = await api(TH, "POST", `/api/placements/${P_OLD}/transfer`, { toOrganizationId: toOrg, toFieldSupervisorId: toFs, reason: "محاولة نقل إسناد منقول مسبقاً", effectiveDate: "2026-10-10", carryOverHours: true });
check(r.status === 409, "لا يمكن نقل إسناد مؤرشف (منقول) مرة أخرى", r.json);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} نجح، ${fail} فشل`);
process.exit(fail === 0 ? 0 : 1);
