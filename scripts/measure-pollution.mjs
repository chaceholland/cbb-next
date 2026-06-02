// Read-only: size NCAA/D1 synthetic-id pollution across ALL games.
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
const norm = (s) =>
  String(s)
    .replace(/\s+-\s+[A-Za-z0-9]{1,3}\s+/g, " ")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

async function all(table, sel, build) {
  const out = [];
  let from = 0;
  for (;;) {
    let q = sb
      .from(table)
      .select(sel)
      .range(from, from + 999);
    if (build) q = build(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

// roster ground truth
const ros = await all("cbb_pitchers", "name,team_id");
const byName = {};
for (const r of ros)
  (byName[norm(r.name)] = byName[norm(r.name)] || new Set()).add(
    String(r.team_id),
  );

// all synthetic-id participation rows (NCAA- / D1-)
const part = await all(
  "cbb_pitcher_participation",
  "game_id,team_id,pitcher_id,pitcher_name,stats",
);
const synth = part.filter((r) => /^(NCAA|D1)-/.test(String(r.pitcher_id)));
console.log(
  "total participation rows:",
  part.length,
  "| synthetic NCAA/D1 rows:",
  synth.length,
);

// games map
const gids = [...new Set(synth.map((r) => r.game_id))];
const gmap = {};
for (let i = 0; i < gids.length; i += 200) {
  const { data } = await sb
    .from("cbb_games")
    .select("game_id,home_team_id,away_team_id")
    .in("game_id", gids.slice(i, i + 200));
  for (const g of data) gmap[g.game_id] = g;
}

let nameMismatch = 0,
  foreignToGame = 0,
  ok = 0,
  unverif = 0;
const affectedGames = new Set();
const byTeamMismatch = {};
for (const r of synth) {
  const g = gmap[r.game_id];
  const got = String(r.team_id);
  // foreign-to-game: team_id is neither of the game's two teams (wrong-contest import)
  if (g && got !== String(g.home_team_id) && got !== String(g.away_team_id)) {
    foreignToGame++;
    affectedGames.add(r.game_id);
  }
  const real = byName[norm(r.pitcher_name)];
  if (!real) {
    unverif++;
    continue;
  }
  if (real.has(got)) ok++;
  else {
    nameMismatch++;
    affectedGames.add(r.game_id);
    byTeamMismatch[got] = (byTeamMismatch[got] || 0) + 1;
  }
}
console.log("\n=== synthetic-row classification (vs roster ground truth) ===");
console.log("correct (name matches assigned team):", ok);
console.log(
  "NAME-MISMATCH (name belongs to another rostered team):",
  nameMismatch,
);
console.log("FOREIGN-TO-GAME (team_id not even in this game):", foreignToGame);
console.log("unverifiable (name in no roster):", unverif);
console.log(
  "distinct affected games:",
  affectedGames.size,
  "of",
  gids.length,
  "games with synthetic rows",
);
console.log("\nmislabel rows by (wrongly) assigned team_id [top 15]:");
for (const [t, n] of Object.entries(byTeamMismatch)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15))
  console.log(`  team ${t}: ${n}`);
fs.writeFileSync(
  new URL("./pollution-affected-games.json", import.meta.url),
  JSON.stringify([...affectedGames], null, 2),
);
console.log(
  "\nwrote scripts/pollution-affected-games.json (",
  affectedGames.size,
  "games )",
);
