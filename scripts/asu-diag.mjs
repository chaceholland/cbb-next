// Diagnostic: characterize team_id=59 participation pollution. READ ONLY.
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
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

async function all(table, sel, build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from(table)
      .select(sel)
      .range(from, from + 999);
    if (build) q = build(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// 1. team_id=59 participation rows
const part59 = await all(
  "cbb_pitcher_participation",
  "game_id,pitcher_id,pitcher_name,stats",
  (q) => q.eq("team_id", "59"),
);
const bySource = {};
for (const r of part59) {
  const s = (r.stats && r.stats.source) || "(null)";
  bySource[s] = (bySource[s] || 0) + 1;
}
console.log(
  "team_id=59 participation rows:",
  part59.length,
  "distinct pitcher_id:",
  new Set(part59.map((r) => r.pitcher_id)).size,
);
console.log("by source:", bySource);

// 2. Join to games: is 59 actually one of the game's teams?
const gameIds = [...new Set(part59.map((r) => r.game_id))];
const games = [];
for (let i = 0; i < gameIds.length; i += 200) {
  const { data, error } = await supabase
    .from("cbb_games")
    .select(
      "game_id,home_team_id,away_team_id,home_name,away_name,date,completed",
    )
    .in("game_id", gameIds.slice(i, i + 200));
  if (error) throw error;
  games.push(...data);
}
const gmap = Object.fromEntries(games.map((g) => [g.game_id, g]));

let cat = {
  real_asu_game: 0,
  placeholder_or_null: 0,
  other_team_game: 0,
  game_missing: 0,
};
const placeholderGames = new Set();
const otherTeamGames = new Set();
for (const r of part59) {
  const g = gmap[r.game_id];
  if (!g) {
    cat.game_missing++;
    continue;
  }
  const ids = [String(g.home_team_id), String(g.away_team_id)];
  const ph = ["1153", "1154", "null", "", null].some(
    (x) =>
      ids.includes(String(x)) ||
      g.home_team_id == null ||
      g.away_team_id == null,
  );
  if (ids.includes("59")) cat.real_asu_game++;
  else if (
    ids.includes("1153") ||
    ids.includes("1154") ||
    g.home_team_id == null ||
    g.away_team_id == null
  ) {
    cat.placeholder_or_null++;
    placeholderGames.add(r.game_id);
  } else {
    cat.other_team_game++;
    otherTeamGames.add(r.game_id);
  }
}
console.log("\nrow categorization by the game's team ids:", cat);

console.log("\n-- placeholder/null games (sample up to 15) --");
for (const gid of [...placeholderGames].slice(0, 15)) {
  const g = gmap[gid];
  console.log(
    `  ${gid}  ${g.away_name}(${g.away_team_id}) @ ${g.home_name}(${g.home_team_id})  ${g.date} completed=${g.completed}`,
  );
}
console.log("placeholder/null distinct games:", placeholderGames.size);

console.log(
  "\n-- other-team games (NOT 59, NOT placeholder) (sample up to 15) --",
);
for (const gid of [...otherTeamGames].slice(0, 15)) {
  const g = gmap[gid];
  console.log(
    `  ${gid}  ${g.away_name}(${g.away_team_id}) @ ${g.home_name}(${g.home_team_id})  ${g.date} completed=${g.completed}`,
  );
}
console.log("other-team distinct games:", otherTeamGames.size);

// 3. Drill into null-team (polluted) rows: source + pitcher_id prefix + names
const nullRows = part59.filter((r) => placeholderGames.has(r.game_id));
const srcBreak = {};
const prefixBreak = {};
for (const r of nullRows) {
  const s = (r.stats && r.stats.source) || "(null)";
  srcBreak[s] = (srcBreak[s] || 0) + 1;
  const pid = String(r.pitcher_id || "");
  const pref = pid.startsWith("NCAA-")
    ? "NCAA-"
    : pid.startsWith("D1-")
      ? "D1-"
      : /^\d+$/.test(pid)
        ? "espn-numeric"
        : "other";
  prefixBreak[pref] = (prefixBreak[pref] || 0) + 1;
}
console.log("\n=== NULL-team (polluted) rows ===");
console.log(
  "count:",
  nullRows.length,
  "by source:",
  srcBreak,
  "by pid prefix:",
  prefixBreak,
);
console.log("sample pitchers:");
for (const r of nullRows.slice(0, 20))
  console.log(
    `  game=${r.game_id} src=${r.stats?.source} pid=${r.pitcher_id} name="${r.pitcher_name}"`,
  );

// 4. Real ASU roster
const { data: oneRow } = await supabase
  .from("cbb_pitchers")
  .select("*")
  .eq("team_id", "59")
  .limit(1);
console.log(
  "\ncbb_pitchers columns:",
  oneRow && oneRow[0] ? Object.keys(oneRow[0]) : "(none)",
);
const roster = await all("cbb_pitchers", "*", (q) => q.eq("team_id", "59"));
console.log("ASU roster in cbb_pitchers (team_id=59):", roster.length);
