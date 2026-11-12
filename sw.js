// 홈 화면 앱용: 한 번 연 화면은 인터넷이 끊겨도 열리게 합니다. 가격·충전소·날씨(api, ev)는 늘 새로 받습니다.
const CACHE = "carhelp-v1";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin || req.mode !== "navigate") return;
  e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); return res; })
    .catch(() => caches.match("./index.html")));
});
