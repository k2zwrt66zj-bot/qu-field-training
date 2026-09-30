// صفحة «عن المنصة والمطور»: نص حقوق الملكية وسطر التذييل بنصهما المعتمد، وقنوات التواصل من البيئة
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEVELOPER, DEVELOPER_CREDIT, IP_NOTICE, developerContacts } from "../src/lib/developer.ts";

test("developer: النصوص المعتمدة حرفياً", () => {
  assert.equal(IP_NOTICE, "هذا النظام مصنف ومحمي. جميع حقوق الملكية الفكرية، التصميم، والكود المصدري محفوظة للمطور عبدالملك عواض العتيبي © 2026");
  assert.equal(DEVELOPER_CREDIT, "تم التطوير بواسطة عبدالملك العتيبي © 2026");
  assert.equal(DEVELOPER.nameEn, "Abdalmalik Awad Al-Otaibi");
  assert.ok(IP_NOTICE.includes(DEVELOPER.nameAr) && DEVELOPER_CREDIT.includes(DEVELOPER.shortNameAr));
});

test("developer: قنوات التواصل المضبوطة تُعرض", () => {
  const c = developerContacts({ DEVELOPER_EMAIL: " dev@example.com ", DEVELOPER_LINKEDIN_URL: "https://www.linkedin.com/in/someone" });
  assert.deepEqual(c, { email: "dev@example.com", linkedin: "https://www.linkedin.com/in/someone" });
  assert.equal(developerContacts({ DEVELOPER_LINKEDIN_URL: "https://sa.linkedin.com/in/x" }).linkedin, "https://sa.linkedin.com/in/x");
});

test("developer: غير المضبوط أو غير الصالح يعطّل الزر بدل رابط خاطئ", () => {
  assert.deepEqual(developerContacts({}), { email: null, linkedin: null });
  assert.equal(developerContacts({ DEVELOPER_EMAIL: "not-an-email" }).email, null);
  assert.equal(developerContacts({ DEVELOPER_LINKEDIN_URL: "javascript:alert(1)" }).linkedin, null);
  assert.equal(developerContacts({ DEVELOPER_LINKEDIN_URL: "https://evil.example/linkedin.com/" }).linkedin, null);
  assert.equal(developerContacts({ DEVELOPER_LINKEDIN_URL: "http://linkedin.com/in/x" }).linkedin, null);
});
