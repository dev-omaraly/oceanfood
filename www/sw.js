const CACHE = "oceanfood-v3";
const CORE = ["./", "index.html", "app.css", "config.js", "manifest.json", "logo.png", "icon-192.png", "icon-512.png",
  "js/00-fallback.js","js/01-core.js","js/02-data.js","js/03-ui-main.js","js/04-voucher.js","js/05-returns-incoming.js","js/06-history.js","js/07-inventory.js","js/08-reports.js","js/09-admin.js","js/10-rep.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return;            // بيانات Supabase دايمًا من النت
  if (url.origin !== location.origin && !/cdn(js)?\./.test(url.hostname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try { const r = await fetch(req); if (r.ok) cache.put(req, r.clone()); return r; }
    catch (err) { return (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("index.html") : Response.error()); }
  })());
});
