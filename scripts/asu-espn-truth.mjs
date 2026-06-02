// For each of the 17 null-team games carrying team_id=59 rows, fetch ESPN truth
// and classify each participation row: correctly ASU(59) vs mislabeled opponent.
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

// rows tagged 59 whose game has NULL teams
const { data: part59 } = await supabase
  .from("cbb_pitcher_participation")
  .select("game_id,pitcher_id,pitcher_name,team_id,stats")
  .eq("team_id", "59");
const gameIds = [...new Set(part59.map((r) => r.game_id))];
const { data: games } = await supabase
  .from("cbb_games")
  .select("game_id,home_team_id,away_team_id")
  .in("game_id", gameIds);
const gmap = Object.fromEntries(games.map((g) => [g.game_id, g]));
const nullGameIds = gameIds; // AUDIT ALL games that carry a team_id=59 row

async function espnTeams(gid) {
  const r = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gid}`,
  );
  const j = await r.json();
  const comp = j.header?.competitions?.[0];
  const competitors = (comp?.competitors || []).map((c) => ({
    id: c.team?.id,
    name: c.team?.displayName,
    homeAway: c.homeAway,
  }));
  const pitcherTeam = {}; // pitcher_id -> team_id per ESPN boxscore
  const nameTeam = {}; // normalized pitcher name -> team_id
  for (const tb of j.boxscore?.players || []) {
    for (const sg of tb.statistics || []) {
      if (sg.type === "pitching")
        for (const a of sg.athletes || []) {
          if (a.athlete?.id)
            pitcherTeam[String(a.athlete.id)] = String(tb.team?.id);
          const nm = norm(a.athlete?.displayName || "");
          if (nm) nameTeam[nm] = String(tb.team?.id);
        }
    }
  }
  return { competitors, pitcherTeam, nameTeam, date: comp?.date };
}

function norm(s) {
  return String(s)
    .replace(/\s+-\s+[A-Za-z0-9]{1,3}\s+/g, " ")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

let totalMis = 0,
  totalAsu = 0,
  totalUnknown = 0;
const fixPlan = []; // {game_id, pitcher_id, correct_team_id}
const gameTeamFix = []; // {game_id, home_team_id, away_team_id}
for (const gid of nullGameIds) {
  const t = await espnTeams(gid);
  const home = t.competitors.find((c) => c.homeAway === "home");
  const away = t.competitors.find((c) => c.homeAway === "away");
  const hasASU = t.competitors.some((c) => String(c.id) === "59");
  gameTeamFix.push({
    game_id: gid,
    home_team_id: home?.id,
    away_team_id: away?.id,
    hasASU,
  });
  const rows = part59.filter((r) => r.game_id === gid);
  let mis = 0,
    asu = 0,
    unk = 0;
  for (const r of rows) {
    let correct = t.pitcherTeam[String(r.pitcher_id)];
    if (!correct) correct = t.nameTeam[norm(r.pitcher_name)]; // fall back to name match
    if (!correct) {
      unk++;
      continue;
    }
    if (correct === "59") asu++;
    else {
      mis++;
      fixPlan.push({
        game_id: gid,
        pitcher_id: r.pitcher_id,
        correct_team_id: correct,
        name: r.pitcher_name,
      });
    }
  }
  totalMis += mis;
  totalAsu += asu;
  totalUnknown += unk;
  console.log(
    `${gid}  ESPN: ${away?.name}(${away?.id}) @ ${home?.name}(${home?.id})  rows=${rows.length} asu59ok=${asu} mislabeled=${mis} unknown=${unk}`,
  );
}
console.log("\n=== TOTALS across", nullGameIds.length, "null-team games ===");
console.log(
  "rows correctly ASU(59):",
  totalAsu,
  " mislabeled(opponent tagged 59):",
  totalMis,
  " not-in-ESPN-box:",
  totalUnknown,
);
console.log(
  "\nAll",
  gameTeamFix.length,
  "games have ASU:",
  gameTeamFix.every((g) => g.hasASU),
);
console.log("\nMislabeled fix plan (sample 25):");
for (const f of fixPlan.slice(0, 25))
  console.log(
    `  ${f.game_id} pid=${f.pitcher_id} "${f.name}" -> team ${f.correct_team_id}`,
  );
fs.writeFileSync(
  new URL("../scripts/asu-fix-plan.json", import.meta.url),
  JSON.stringify({ gameTeamFix, fixPlan, nullGameIds }, null, 2),
);
console.log("\nwrote scripts/asu-fix-plan.json");
