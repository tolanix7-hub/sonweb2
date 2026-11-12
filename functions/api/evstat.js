// 충전소별 지금 상태 (Cloudflare Pages Function)
// 주소: /api/evstat?ids=ME000001,PI123456  (최대 10곳)
// 공공데이터포털 키는 Cloudflare Pages 설정의 환경 변수 EV_KEY 에 넣습니다. 이 파일에는 넣지 않습니다.

const BASE = "https://apis.data.go.kr/B552584/EvCharger/getChargerInfo";

function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store" }
  });
}

async function one(id, key) {
  const url = `${BASE}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=100&dataType=JSON&statId=${encodeURIComponent(id)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const d = JSON.parse(await r.text());
  const body = d.response ? d.response.body || d.response : d;
  const raw = body.items && (body.items.item || body.items);
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // s: 1 통신이상 · 2 충전대기(비어 있음) · 3 충전 중 · 4 운영중지 · 5 점검중 · 9 상태미확인
  return items.filter((c) => c.statId === id && c.delYn !== "Y").map((c) => ({ c: c.chgerId, t: c.chgerType, s: String(c.stat || "9"), k: Number(c.output) || 0 }));
}

export async function onRequestGet({ request, env, waitUntil }) {
  const u = new URL(request.url);
  const ids = [...new Set(String(u.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{2,40}$/.test(s)))].slice(0, 10);
  if (!ids.length) return json({ error: "충전소 ID가 없어요" }, 400);
  if (!env.EV_KEY) return json({ error: "서버에 충전소 키가 설정되지 않았어요" }, 500);

  const cacheKey = new Request("https://cache.local/evstat?ids=" + ids.slice().sort().join(","));
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const st = {};
  await Promise.all(ids.map((id) => one(id, env.EV_KEY).then((L) => { st[id] = L; }, () => {})));
  if (!Object.keys(st).length) return json({ error: "충전소 상태를 받지 못했어요" }, 502);
  const res = json({ st, at: new Date().toISOString() }, 200, 120);
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
