// التحضير اليدوي الاستثنائي من المشرف المؤسسي — اختبار شامل
import { execFileSync } from "node:child_process";
const B=process.env.E2E_BASE_URL??"http://127.0.0.1:3000"; const DB=process.env.DATABASE_URL??"postgresql://postgres:postgres@localhost:5432/qu_field_training";
const sql=(q)=>execFileSync("psql",[DB,"-Atc",q]).toString().trim();
let pass=0,fail=0; const chk=(c,l,e)=>{if(c){pass++;console.log("  ✓ "+l);}else{fail++;console.log("  ✗ "+l,e!==undefined?JSON.stringify(e).slice(0,200):"");}};
const sec=(t)=>console.log("\n"+t);
function jar(){const c=new Map();return{header:()=>[...c].map(([k,v])=>`${k}=${v}`).join("; "),store:(r)=>{for(const s of r.headers.getSetCookie?.()??[]){const[p]=s.split(";");const i=p.indexOf("=");c.set(p.slice(0,i).trim(),p.slice(i+1));}}};}
const S={};async function as(email){if(S[email])return S[email];const j=jar();const r1=await fetch(`${B}/api/auth/csrf`);j.store(r1);const{csrfToken}=await r1.json();const r2=await fetch(`${B}/api/auth/callback/credentials`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Cookie:j.header()},body:new URLSearchParams({csrfToken,email,password:"Qu@12345",json:"true"})});j.store(r2);return S[email]=j;}
async function api(email,method,url,body){const j=await as(email);const h={Cookie:j.header()};let b;if(body!==undefined){b=JSON.stringify(body);h["Content-Type"]="application/json";}const r=await fetch(B+url,{method,headers:h,body:b});const t=await r.text();let json;try{json=JSON.parse(t);}catch{json=null;}return{status:r.status,json};}

const FS="field1@example.sa", OTHER="field2@example.sa";
// متدرب فعّال لـ field1، وضبط أيامه كل الأسبوع وتصفير سجل اليوم
const P=sql(`select p.id from "Placement" p join "FieldSupervisorProfile" f on f.id=p."fieldSupervisorId" join "User" u on u.id=f."userId" where u.email='field1@example.sa' and p.status='ACTIVE' limit 1`);
sql(`update "Placement" set "workDays"='{0,1,2,3,4,5,6}' where id='${P}'`);
const TODAY=sql(`select to_char((now() at time zone 'Asia/Riyadh')::date,'YYYY-MM-DD')`);
const FSUID=sql(`select f."userId" from "FieldSupervisorProfile" f join "User" u on u.id=f."userId" where u.email='field1@example.sa'`);
sql(`delete from "AttendanceRecord" where "placementId"='${P}' and date='${TODAY}'`);
console.log(`المتدرب ${P} · اليوم ${TODAY}`);

sec("أ) الصلاحيات والتحقق");
let r=await api("441100001@qu.edu.sa","POST","/api/attendance/override",{placementId:P,date:TODAY,reason:"محاولة طالب"});
chk(r.status===401||r.status===403,"الطالب لا يملك صلاحية التحضير اليدوي",r.status);
r=await api(OTHER,"POST","/api/attendance/override",{placementId:P,date:TODAY,reason:"محاولة مشرف آخر على طالب ليس له"});
chk(r.status===404,"مشرف مؤسسي آخر لا يحضّر طالباً ليس مسنداً إليه",r.status);
r=await api(FS,"POST","/api/attendance/override",{placementId:P,date:TODAY,reason:"قصير"});
chk(r.status===422||r.status===400,"رفض سبب أقل من 5 أحرف",r.status);
r=await api(FS,"POST","/api/attendance/override",{placementId:P,date:"2099-01-01",reason:"يوم في المستقبل البعيد"});
chk(r.status===422,"رفض تاريخ مستقبلي",r.status);

sec("ب) تنفيذ التحضير اليدوي");
r=await api(FS,"POST","/api/attendance/override",{placementId:P,date:TODAY,reason:"عطل في جهاز الطالب ونفاد البطارية"});
chk(r.status===200&&r.json?.ok,"تم التحضير اليدوي",r.json);
chk(sql(`select "isManualOverride" from "AttendanceRecord" where "placementId"='${P}' and date='${TODAY}'`)==="t","العلامة isManualOverride=true");
chk(sql(`select "overriddenById" from "AttendanceRecord" where "placementId"='${P}' and date='${TODAY}'`)===FSUID,"overriddenById = المشرف المؤسسي");
chk(sql(`select status||'|'||"approvalStatus" from "AttendanceRecord" where "placementId"='${P}' and date='${TODAY}'`)==="PRESENT|APPROVED","حاضر ومعتمد");
chk(Number(sql(`select "workedMinutes" from "AttendanceRecord" where "placementId"='${P}' and date='${TODAY}'`))>0,"ساعات محتسبة");
chk(sql(`select "overrideReason" from "AttendanceRecord" where "placementId"='${P}' and date='${TODAY}'`)==="عطل في جهاز الطالب ونفاد البطارية","سبب التجاوز محفوظ");

sec("ج) سجل التدقيق");
chk(sql(`select count(*) from "AuditLog" where action='attendance.override' and "actorId"='${FSUID}'`)>="1","مسجّل في سجل التدقيق");

sec("د) منع التجاوز على حضور جغرافي فعلي");
sql(`update "AttendanceRecord" set "checkInAt"=now(), "isManualOverride"=false, "overriddenById"=null where "placementId"='${P}' and date='${TODAY}'`);
r=await api(FS,"POST","/api/attendance/override",{placementId:P,date:TODAY,reason:"محاولة تجاوز حضور جغرافي قائم"});
chk(r.status===409,"لا تجاوز على يوم سجّل فيه الطالب حضوره جغرافياً",r.json);

console.log(`\n${fail===0?"✅":"❌"} ${pass} نجح، ${fail} فشل`);
process.exit(fail===0?0:1);
