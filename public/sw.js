// Service Worker بسيط: تخزين الواجهة (App Shell) للعمل بشبكة ضعيفة.
// لا تُخزَّن طلبات الـ API إطلاقاً حتى لا يُعرض حضور قديم أو يُعاد إرسال تحضير.
const CACHE = "qu-ft-v2";
const SHELL = ["/", "/login", "/brand/emblem-192.png", "/brand/qu-logo.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // الصفحات: الشبكة أولاً ثم الذاكرة المؤقتة
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
    return;
  }
  // الملفات الثابتة: الذاكرة أولاً
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) => hit || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      )
    );
  }
});
