// HTTP-verify every pitcher headshot for the 64 postseason teams resolve (200).
// sidearmdev returns 405 to HEAD but serves GET, so use GET (no body read).
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const field = JSON.parse(
  fs.readFileSync(new URL("./postseason-teams.json", import.meta.url), "utf8"),
);
const teamIds = field.filter((t) => t.rostered).map((t) => t.team_id);
const nameById = Object.fromEntries(field.map((t) => [t.team_id, t.name]));

const pitchers = [];
for (let i = 0; i < teamIds.length; i += 100) {
  const { data } = await sb
    .from("cbb_pitchers")
    .select("pitcher_id,team_id,name,headshot")
    .in("team_id", teamIds.slice(i, i + 100));
  pitchers.push(...data);
}
console.log("64-team field pitchers:", pitchers.length);

async function check(url) {
  if (!url) return "no-url";
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });
    return r.status;
  } catch (e) {
    return "ERR:" + (e.name || e.message);
  }
}

let conc = 12,
  idx = 0;
const bad = [];
const byTeamBad = {};
async function worker() {
  while (idx < pitchers.length) {
    const p = pitchers[idx++];
    const st = await check(p.headshot);
    if (st !== 200) {
      bad.push({ ...p, st });
      byTeamBad[p.team_id] = (byTeamBad[p.team_id] || 0) + 1;
    }
  }
}
await Promise.all(Array.from({ length: conc }, worker));

console.log(
  "\nheadshots checked:",
  pitchers.length,
  "| BAD (non-200):",
  bad.length,
);
if (bad.length) {
  console.log("\nbad by team:");
  for (const [t, n] of Object.entries(byTeamBad).sort((a, b) => b[1] - a[1]))
    console.log(`  ${t} ${nameById[t]}: ${n}`);
  console.log("\nsample bad URLs:");
  for (const b of bad.slice(0, 15))
    console.log(
      `  [${b.st}] ${b.team_id} ${nameById[b.team_id]} "${b.name}" ${String(b.headshot).slice(0, 90)}`,
    );
  fs.writeFileSync(
    new URL("./bad-headshots.json", import.meta.url),
    JSON.stringify(bad, null, 2),
  );
}
