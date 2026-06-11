// Verify SIDEARM schedule availability for teams not yet in TEAM_SITES (Wave 3).
// Usage: D1_PROXY_SECRET=... node scripts/wave3-verify.mjs
import { readFileSync } from "fs";

const WORKER = "https://d1-proxy.chace-holland.workers.dev";
const secret = process.env.D1_PROXY_SECRET;
if (!secret) throw new Error("D1_PROXY_SECRET required");

// Parse existing TEAM_SITES ids out of route.ts
const route = readFileSync("app/api/update/route.ts", "utf8");
const block = route.slice(
  route.indexOf("const TEAM_SITES"),
  route.indexOf("const SIDEARM_WORKER_URL"),
);
const existing = new Set(
  [...block.matchAll(/"(\d+)":\s*\{/g)].map((m) => m[1]),
);

const rosterUrls = JSON.parse(
  readFileSync("scripts/roster-urls.json", "utf8"),
);

const candidates = rosterUrls
  .filter((t) => !existing.has(String(t.team_id)))
  .map((t) => ({
    team_id: String(t.team_id),
    name: t.name,
    domain: new URL(t.url).host,
  }));

console.log(`Existing TEAM_SITES: ${existing.size}; candidates: ${candidates.length}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const verified = [];

for (const c of candidates) {
  try {
    const res = await fetch(`${WORKER}/sidearm/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        domain: c.domain,
        sportPath: "/sports/baseball",
        season: "2026",
      }),
    });
    const json = res.ok ? await res.json() : { games: [], error: `HTTP ${res.status}` };
    const n = (json.games || []).length;
    console.log(`${c.team_id} ${c.domain} -> ${n} games${json.error ? " (" + json.error + ")" : ""}`);
    if (n > 5) verified.push(c);
  } catch (e) {
    console.log(`${c.team_id} ${c.domain} -> ERROR ${e.message}`);
  }
  await sleep(3000);
}

console.log("\n// Wave 3 — verified " + verified.length + " teams " + new Date().toISOString().slice(0, 10));
for (const v of verified) {
  console.log(`  "${v.team_id}": { domain: "${v.domain}", sportPath: "/sports/baseball" }, // ${v.name}`);
}
