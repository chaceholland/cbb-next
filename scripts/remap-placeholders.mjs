// Remap bracket-slot placeholder team ids (1153/1154) in cbb_games + participation
// to the real team id, resolved by the slot's NAME (handles reuse across teams).
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
const PLACEHOLDERS = ["1153", "1154"];
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

// Build name -> real team_id from NON-placeholder cbb_games rows (majority vote)
let games = [],
  gf = 0;
for (;;) {
  const { data } = await sb
    .from("cbb_games")
    .select("home_team_id,away_team_id,home_name,away_name")
    .range(gf, gf + 999);
  games.push(...data);
  if (data.length < 1000) break;
  gf += 1000;
}
const votes = {};
for (const g of games) {
  for (const [id, nm] of [
    [g.home_team_id, g.home_name],
    [g.away_team_id, g.away_name],
  ]) {
    if (!id || PLACEHOLDERS.includes(String(id)) || !nm) continue;
    const k = norm(nm);
    votes[k] = votes[k] || {};
    votes[k][String(id)] = (votes[k][String(id)] || 0) + 1;
  }
}
const nameToId = {};
for (const k in votes) {
  nameToId[k] = Object.entries(votes[k]).sort((a, b) => b[1] - a[1])[0][0];
}

// Find placeholder games and resolve
const fixes = []; // {game_id, field, from, to, name}
for (const g of games) {
  // need game_id — refetch with game_id
}
let pg = [],
  pf = 0;
for (;;) {
  const { data } = await sb
    .from("cbb_games")
    .select("game_id,home_team_id,away_team_id,home_name,away_name")
    .or(
      PLACEHOLDERS.map((p) => `home_team_id.eq.${p},away_team_id.eq.${p}`).join(
        ",",
      ),
    )
    .range(pf, pf + 999);
  pg.push(...data);
  if (data.length < 1000) break;
  pf += 1000;
}
console.log("placeholder games:", pg.length);
for (const g of pg) {
  if (PLACEHOLDERS.includes(String(g.home_team_id))) {
    const real = nameToId[norm(g.home_name)];
    if (real)
      fixes.push({
        game_id: g.game_id,
        field: "home_team_id",
        from: String(g.home_team_id),
        to: real,
        name: g.home_name,
      });
    else console.log("  UNRESOLVED home", g.game_id, g.home_name);
  }
  if (PLACEHOLDERS.includes(String(g.away_team_id))) {
    const real = nameToId[norm(g.away_name)];
    if (real)
      fixes.push({
        game_id: g.game_id,
        field: "away_team_id",
        from: String(g.away_team_id),
        to: real,
        name: g.away_name,
      });
    else console.log("  UNRESOLVED away", g.game_id, g.away_name);
  }
}
console.log("resolvable fixes:", fixes.length);
for (const f of fixes.slice(0, 30))
  console.log(`  ${f.game_id} ${f.field} ${f.from}->${f.to} (${f.name})`);

if (process.argv.includes("--dry")) {
  console.log("DRY RUN");
  process.exit(0);
}

// Apply: update cbb_games fields, and any participation rows on placeholders for that game
let gUpd = 0,
  pUpd = 0;
for (const f of fixes) {
  const { error } = await sb
    .from("cbb_games")
    .update({ [f.field]: f.to })
    .eq("game_id", f.game_id);
  if (error) throw error;
  gUpd++;
  // remap participation rows for this game currently on the placeholder team
  const { data: prows } = await sb
    .from("cbb_pitcher_participation")
    .select("pitcher_id")
    .eq("game_id", f.game_id)
    .eq("team_id", f.from);
  for (const r of prows || []) {
    const newPid = String(r.pitcher_id).replace(`-${f.from}-`, `-${f.to}-`);
    await sb
      .from("cbb_pitcher_participation")
      .update({ team_id: f.to, pitcher_id: newPid })
      .eq("game_id", f.game_id)
      .eq("pitcher_id", r.pitcher_id);
    pUpd++;
  }
}
console.log(
  `updated cbb_games fields: ${gUpd}, remapped participation rows: ${pUpd}`,
);
