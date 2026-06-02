// Authoritatively reconcile cbb_games home/away team_id+name against ESPN's
// summary header (the source of truth). Fixes the team_id<->name scramble.
// Read-only with --dry. Processes completed games (paginated).
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
const DRY = process.argv.includes("--dry");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let games = [],
  gf = 0;
for (;;) {
  const { data, error } = await sb
    .from("cbb_games")
    .select("game_id,home_team_id,away_team_id,home_name,away_name")
    .eq("completed", true)
    .range(gf, gf + 999);
  if (error) throw error;
  games.push(...data);
  if (data.length < 1000) break;
  gf += 1000;
}
console.log("completed games:", games.length, DRY ? "(DRY)" : "");

async function espn(gid) {
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gid}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const comp = j.header?.competitions?.[0];
    const c = comp?.competitors || [];
    const home = c.find((x) => x.homeAway === "home")?.team;
    const away = c.find((x) => x.homeAway === "away")?.team;
    if (!home?.id || !away?.id) return null;
    return {
      homeId: String(home.id),
      awayId: String(away.id),
      homeName: home.displayName || "",
      awayName: away.displayName || "",
    };
  } catch {
    return null;
  }
}

let conc = 10,
  idx = 0,
  fixed = 0,
  checked = 0,
  nodata = 0;
const fixes = [];
async function worker() {
  while (idx < games.length) {
    const g = games[idx++];
    const t = await espn(g.game_id);
    checked++;
    if (!t) {
      nodata++;
      continue;
    }
    const idMismatch =
      String(g.home_team_id) !== t.homeId ||
      String(g.away_team_id) !== t.awayId;
    if (idMismatch) {
      fixes.push({
        game_id: g.game_id,
        was: `${g.away_name}(${g.away_team_id})@${g.home_name}(${g.home_team_id})`,
        now: `${t.awayName}(${t.awayId})@${t.homeName}(${t.homeId})`,
      });
      if (!DRY) {
        await sb
          .from("cbb_games")
          .update({
            home_team_id: t.homeId,
            away_team_id: t.awayId,
            home_name: t.homeName,
            away_name: t.awayName,
          })
          .eq("game_id", g.game_id);
      }
      fixed++;
    }
    if (checked % 200 === 0)
      process.stdout.write(
        `\r  checked ${checked}/${games.length} fixed ${fixed} nodata ${nodata}`,
      );
  }
}
await Promise.all(Array.from({ length: conc }, worker));
console.log(`\nchecked=${checked} fixed=${fixed} no-espn-data=${nodata}`);
console.log("sample fixes:");
for (const f of fixes.slice(0, 30))
  console.log(`  ${f.game_id}: ${f.was}  ->  ${f.now}`);
fs.writeFileSync(
  new URL("./game-id-fixes.json", import.meta.url),
  JSON.stringify(fixes, null, 2),
);
