// =====================================================================
//  تشغيل العرض التوضيحي بأمر واحد (ويندوز وماك ولينكس): npm run demo
//   1) ترحيلات القاعدة  2) بيانات تجريبية + ترحيل السجلات القديمة  3) البناء (أول مرة)
//   4) تشغيل الخادم  5) بيانات العرض (رحلة طالب كاملة)  — ثم يبقى الخادم يعمل حتى Ctrl+C
//  خيارات: --keep (دون إعادة تهيئة البيانات)   --rebuild (إعادة البناء)
// =====================================================================
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PORT = process.env.PORT ?? "3000";
const BASE = `http://localhost:${PORT}`;
const args = new Set(process.argv.slice(2));

const run = (cmd) =>
  new Promise((resolve, reject) => {
    console.log(`\n▶ ${cmd}`);
    const p = spawn(cmd, { shell: true, stdio: "inherit", env: process.env });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`فشل: ${cmd} (${code})`))));
  });

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(`${BASE}/login`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("لم يبدأ الخادم خلال 90 ثانية");
}

try {
  if (!process.env.DATABASE_URL) throw new Error("لم يُعثر على DATABASE_URL — انسخ .env.example إلى .env أولاً");
  await run("npx prisma generate");
  await run("npx prisma migrate deploy");
  if (!args.has("--keep")) await run("npm run demo:reset");
  if (args.has("--rebuild") || !existsSync(".next/BUILD_ID")) await run("npm run build");

  console.log(`\n▶ تشغيل الخادم على ${BASE}`);
  const server = spawn(`npx next start -p ${PORT}`, { shell: true, stdio: "inherit", env: process.env });
  const stop = () => { server.kill(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await waitForServer();
  if (!args.has("--keep")) await run(`node --env-file=.env scripts/demo-data.mjs`);

  console.log(`
═══════════════════════════════════════════════════════════════
  المنصة جاهزة للعرض:  ${BASE}
  كلمة المرور لكل الحسابات: Qu@12345
  • طالب ميداني (السجل المهني الكامل):   441100001@qu.edu.sa
  • طالب محاكاة:                         441100025@qu.edu.sa
  • مشرف مؤسسي (كشوف الحضور والتوقيع):   field1@example.sa
  • مشرف أكاديمي (الاعتماد والاجتماعات): academic1@qu.edu.sa
  • رئيس وحدة التدريب:                   abdullah.altijani@qu.edu.sa
  • رئيس القسم:                          omar.alnamlah@qu.edu.sa
  للإيقاف: Ctrl+C
═══════════════════════════════════════════════════════════════`);
} catch (e) {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
}
