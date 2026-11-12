// 내 주변 주유소 최저가 (Cloudflare Pages Function)
// 주소: /api/fuel?lat=37.56&lon=126.97&prod=B027
// 오피넷 API 키는 Cloudflare Pages 설정의 환경 변수 OPINET_KEY 에 넣습니다. 이 파일에는 넣지 않습니다.

const PROD = { B027: "휘발유", D047: "경유", K015: "LPG", B034: "고급휘발유" };
const BRAND = {
  SKE: "SK에너지", GSC: "GS칼텍스", HDO: "HD현대오일뱅크", SOL: "S-OIL",
  RTE: "자영알뜰", RTX: "고속도로알뜰", NHO: "농협알뜰", ETC: "자가상표", E1G: "E1", SKG: "SK가스"
};

// WGS84 위경도 → 오피넷이 쓰는 KATEC 좌표 (Bessel 타원체, 3변수 이동으로 근사: 오차 수 m)
function toKatec(lat, lon) {
  const rad = Math.PI / 180;
  // 1) WGS84 위경도 → 지구중심 좌표
  const aW = 6378137, fW = 1 / 298.257223563, e2W = 2 * fW - fW * fW;
  const sp = Math.sin(lat * rad), cp = Math.cos(lat * rad);
  const nW = aW / Math.sqrt(1 - e2W * sp * sp);
  let X = nW * cp * Math.cos(lon * rad), Y = nW * cp * Math.sin(lon * rad), Z = nW * (1 - e2W) * sp;
  // 2) WGS84 → Bessel (한국 동경측지계 이동량)
  X -= -146.43; Y -= 507.89; Z -= 681.46;
  // 3) 지구중심 좌표 → Bessel 위경도
  const a = 6377397.155, f = 1 / 299.1528128, e2 = 2 * f - f * f;
  const p = Math.sqrt(X * X + Y * Y), lam = Math.atan2(Y, X);
  let phi = Math.atan2(Z, p * (1 - e2));
  for (let i = 0; i < 6; i++) {
    const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    phi = Math.atan2(Z + e2 * n * Math.sin(phi), p);
  }
  // 4) 횡메르카토르 (원점 38N 128E, 축척 0.9999, 가산 400000 / 600000)
  const k0 = 0.9999, lam0 = 128 * rad, phi0 = 38 * rad, ep2 = e2 / (1 - e2);
  const M = (ph) => a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * ph
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * ph)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * ph)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * ph));
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = (lam - lam0) * Math.cos(phi);
  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = k0 * (M(phi) - M(phi0) + N * Math.tan(phi) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return { x: 400000 + x, y: 600000 + y };
}

function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store" }
  });
}

export async function onRequestGet({ request, env, waitUntil }) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat")), lon = Number(u.searchParams.get("lon"));
  const prod = PROD[u.searchParams.get("prod")] ? u.searchParams.get("prod") : "B027";
  if (!isFinite(lat) || !isFinite(lon) || lat < 33 || lat > 39 || lon < 124 || lon > 132) return json({ error: "위치가 국내 범위가 아니에요" }, 400);
  if (!env.OPINET_KEY) return json({ error: "서버에 오피넷 키가 설정되지 않았어요" }, 500);

  // 약 1km 단위로 묶어 10분 동안 같은 결과를 씁니다 (오피넷 호출 횟수 절약)
  const rl = Math.round(lat * 100) / 100, ro = Math.round(lon * 100) / 100;
  const cacheKey = new Request(`https://cache.local/fuel?lat=${rl}&lon=${ro}&prod=${prod}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const k = toKatec(lat, lon);
  const api = `https://www.opinet.co.kr/api/aroundAll.do?code=${encodeURIComponent(env.OPINET_KEY)}&x=${k.x.toFixed(1)}&y=${k.y.toFixed(1)}&radius=5000&sort=1&prodcd=${prod}&out=json`;
  let data;
  try {
    const r = await fetch(api, { cf: { cacheTtl: 0 } });
    if (!r.ok) return json({ error: "오피넷 응답 오류 " + r.status }, 502);
    data = await r.json();
  } catch (e) {
    return json({ error: "오피넷에 연결하지 못했어요" }, 502);
  }
  const list = (data && data.RESULT && data.RESULT.OIL) || [];
  const items = list
    .map((o) => ({ id: o.UNI_ID, name: o.OS_NM, brand: BRAND[o.POLL_DIV_CD] || "", price: Number(o.PRICE), dist: Math.round(Number(o.DISTANCE)) }))
    .filter((o) => o.price > 0)
    .sort((a, b) => a.price - b.price || a.dist - b.dist)
    .slice(0, 10);

  const res = json({ prod, prodName: PROD[prod], items, at: new Date().toISOString() }, 200, 600);
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
