// 전국 전기차 충전소 목록을 받아 0.1도 칸(약 11km)별 파일로 나눠 ev/ 폴더에 저장합니다.
// GitHub Actions가 하루 한 번 실행합니다(.github/workflows/ev-data.yml). 키는 GitHub Secrets의 EV_KEY에서 읽습니다.
// 직접 실행: EV_KEY=발급키 node scripts/build-ev.mjs
import { mkdir, writeFile, rm } from "node:fs/promises";

const KEY = process.env.EV_KEY;
if (!KEY) { console.error("EV_KEY 환경 변수가 없습니다."); process.exit(1); }
const BASE = "https://apis.data.go.kr/B552584/EvCharger/getChargerInfo";
const ROWS = 9999;
const SLOW = new Set(["02", "08"]); // AC완속, DC콤보(완속)

async function page(no) {
  const url = `${BASE}?serviceKey=${encodeURIComponent(KEY)}&pageNo=${no}&numOfRows=${ROWS}&dataType=JSON`;
  for (let t = 1; t <= 4; t++) {
    try {
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
      let d;
      try { d = JSON.parse(text); } catch { throw new Error("JSON이 아닌 응답: " + text.slice(0, 200)); }
      const body = d.response ? d.response.body || d.response : d;
      const raw = body.items && (body.items.item || body.items);
      const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return { items, total: Number(body.totalCount || 0), code: d.resultCode || (d.response && d.response.header && d.response.header.resultCode) };
    } catch (e) {
      console.error(`${no}쪽 ${t}번째 시도 실패:`, e.message);
      if (t === 4) throw e;
      await new Promise((ok) => setTimeout(ok, 3000 * t));
    }
  }
}

const first = await page(1);
if (!first.total) { console.error("받은 충전기가 없습니다. 키 승인 여부를 확인하세요. 결과코드:", first.code); process.exit(1); }
const pages = Math.ceil(first.total / ROWS);
console.log(`충전기 ${first.total}대, ${pages}쪽`);
let all = first.items;
for (let no = 2; no <= pages; no++) { all = all.concat((await page(no)).items); console.log(`${no}/${pages}쪽`); }

// 충전기 → 충전소로 묶기
const st = new Map();
for (const c of all) {
  const la = Number(c.lat), lo = Number(c.lng);
  if (!c.statId || !isFinite(la) || !isFinite(lo) || la < 32 || la > 39.5 || lo < 124 || lo > 132.5) continue;
  if (c.delYn === "Y") continue;
  let s = st.get(c.statId);
  if (!s) {
    s = { i: c.statId, n: c.statNm || "", a: c.addr || "", la: Math.round(la * 1e5) / 1e5, lo: Math.round(lo * 1e5) / 1e5,
      b: c.busiNm || "", t: c.busiCall || "", u: c.useTime || "", p: c.parkingFree === "Y" ? 1 : 0, x: c.limitYn === "Y" ? (c.limitDetail || "이용 제한 있음") : "", f: 0, s: 0, k: 0, g: [] };
    st.set(c.statId, s);
  }
  if (SLOW.has(c.chgerType)) s.s++; else s.f++;
  const kw = Number(c.output) || 0;
  if (kw > s.k) s.k = kw;
  if (c.chgerType && !s.g.includes(c.chgerType)) s.g.push(c.chgerType);
}

// 0.1도 칸별 파일
const cells = new Map();
for (const s of st.values()) {
  const key = Math.floor(s.la * 10) + "_" + Math.floor(s.lo * 10);
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(s);
}
await rm("ev", { recursive: true, force: true });
await mkdir("ev", { recursive: true });
for (const [key, list] of cells) {
  list.sort((a, b) => (a.i < b.i ? -1 : 1));
  await writeFile(`ev/${key}.json`, JSON.stringify(list));
}
const at = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
await writeFile("ev/_info.json", JSON.stringify({ at, stations: st.size, chargers: all.length }));
console.log(`충전소 ${st.size}곳, 칸 파일 ${cells.size}개, 기준일 ${at}`);
