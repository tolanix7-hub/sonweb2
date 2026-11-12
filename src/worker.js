// Cloudflare Worker 입구: /api/fuel, /api/evstat 는 서버 코드로, 나머지는 index.html·ev 파일을 그대로 보여 줍니다.
import { onRequestGet as fuel } from "../functions/api/fuel.js";
import { onRequestGet as evstat } from "../functions/api/evstat.js";

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    const ctxPages = { request, env, waitUntil: (p) => ctx.waitUntil(p) };
    if (request.method === "GET" && path === "/api/fuel") return fuel(ctxPages);
    if (request.method === "GET" && path === "/api/evstat") return evstat(ctxPages);
    return env.ASSETS.fetch(request);
  }
};
