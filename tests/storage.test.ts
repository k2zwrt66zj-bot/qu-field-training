// تخزين المرفقات: Supabase تلقائياً على الاستضافة متى ضُبط رابطه ومفتاحه
import { test } from "node:test";
import assert from "node:assert/strict";
import { storageDriver } from "../src/lib/storage-driver.ts";

test("storage: المحلي افتراضياً، وSupabase متى ضُبط الرابط والمفتاح معاً", () => {
  assert.equal(storageDriver({}), "local");
  assert.equal(storageDriver({ SUPABASE_URL: "https://x.supabase.co" }), "local");
  assert.equal(storageDriver({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }), "supabase");
});

test("storage: STORAGE_DRIVER الصريح يتقدّم على الاكتشاف التلقائي", () => {
  assert.equal(storageDriver({ STORAGE_DRIVER: "local", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }), "local");
  assert.equal(storageDriver({ STORAGE_DRIVER: "supabase" }), "supabase");
});
