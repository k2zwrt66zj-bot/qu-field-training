// سياسة كلمات المرور والقفل المؤقت بعد تكرار المحاولات الخاطئة
import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCK_MINUTES, MAX_FAILED_LOGINS, afterFailedLogin, passwordProblem } from "../src/lib/auth/password-policy.ts";

test("كلمة المرور: الطول والحروف والأرقام والشائعة", () => {
  assert.match(passwordProblem("Ab1") ?? "", /8 أحرف/);
  assert.match(passwordProblem("abcdefgh") ?? "", /حروف وأرقام/);
  assert.match(passwordProblem("12345678") ?? "", /حروف وأرقام|شائعة/);
  assert.match(passwordProblem("Qu@12345") ?? "", /شائعة/);
  assert.match(passwordProblem("Training2026", { current: "Training2026" }) ?? "", /مختلفة/);
  assert.match(passwordProblem("x441100100y", { email: "441100100@qu.edu.sa" }) ?? "", /بريدك/);
  assert.equal(passwordProblem("Buraidah#2026"), null);
  assert.equal(passwordProblem("تدريب2026ميداني"), null);
});

test("القفل: بعد المحاولة الخاطئة الخامسة لمدة 15 دقيقة، والعدّاد يُصفَّر", () => {
  const now = new Date("2026-10-08T08:00:00Z");
  let state = { failedLogins: 0, lockedUntil: null as Date | null };
  for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
    state = afterFailedLogin(state.failedLogins, now);
    assert.equal(state.failedLogins, i);
    assert.equal(state.lockedUntil, null);
  }
  state = afterFailedLogin(state.failedLogins, now);
  assert.equal(state.failedLogins, 0);
  assert.equal(state.lockedUntil?.getTime(), now.getTime() + LOCK_MINUTES * 60_000);
});
