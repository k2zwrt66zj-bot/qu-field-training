// إعادة التوجيه بعد الدخول والخروج: مسار نسبي على نطاق الطلب الحالي، ولا خروج إلى نطاق آخر
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRelativePath } from "../src/lib/auth/redirect.ts";

test("auth redirect: المسارات النسبية تبقى كما هي", () => {
  assert.equal(safeRelativePath("/login"), "/login");
  assert.equal(safeRelativePath("/forms/abc?tab=2#sig"), "/forms/abc?tab=2#sig");
  assert.equal(safeRelativePath("/portfolio"), "/portfolio");
});

test("auth redirect: الرابط المطلق يتحول إلى مساره على النطاق الحالي (لا localhost)", () => {
  assert.equal(safeRelativePath("http://localhost:3000/login"), "/login");
  assert.equal(safeRelativePath("https://training.qu.edu.sa/queue?kind=LEGACY"), "/queue?kind=LEGACY");
  assert.equal(safeRelativePath("http://localhost:3000"), "/");
});

test("auth redirect: لا إعادة توجيه مفتوحة إلى موقع خارجي", () => {
  assert.equal(safeRelativePath("https://evil.example/phish"), "/phish");
  assert.equal(safeRelativePath("//evil.example/x"), "/x");
  assert.equal(safeRelativePath("/\\evil.example"), "/");
  assert.equal(safeRelativePath("https://ok.sa//evil.example/x"), "/evil.example/x");
  assert.ok(!safeRelativePath("///evil.example").startsWith("//"));
  assert.equal(safeRelativePath("javascript:alert(1)"), "/");
  assert.equal(safeRelativePath("data:text/html,x", "/login"), "/login");
});

test("auth redirect: القيم الفارغة تعيد البديل", () => {
  assert.equal(safeRelativePath(null, "/login"), "/login");
  assert.equal(safeRelativePath(undefined), "/");
  assert.equal(safeRelativePath(""), "/");
});
