// VERIFICATION: replay the real NCAA pipeline on polluted ASU games and check
// whether assignTeamIds assigns each pitcher to the correct team.
// Ground truth = full cbb_pitchers roster (name -> team). Read-only; writes nothing.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import {
  findNcaaContest,
  fetchNcaaBoxScore,
  assignTeamIds,
  validateContestTeams,
  closeBrowser,
} from "../archive/scripts/ncaa-fallback-scraper.mjs";

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
const norm = (s) =>
  String(s)
    .replace(/\s+-\s+[A-Za-z0-9]{1,3}\s+/g, " ")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

// roster ground truth: normalized name -> Set(team_id)
let ros = [],
  from = 0;
for (;;) {
  const { data } = await supabase
    .from("cbb_pitchers")
    .select("name,team_id")
    .range(from, from + 999);
  ros.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}
const byName = {};
for (const r of ros)
  (byName[norm(r.name)] = byName[norm(r.name)] || new Set()).add(
    String(r.team_id),
  );

// Sample of polluted ASU games (mix of ASU-home and ASU-away), known opponents.
const SAMPLE = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "401848436",
      "401848425",
      "401848441",
      "401848445",
      "401848442",
      "401848434",
    ];

const { data: games } = await supabase
  .from("cbb_games")
  .select("game_id,home_team_id,away_team_id,home_name,away_name,date")
  .in("game_id", SAMPLE);
const gmap = Object.fromEntries(games.map((g) => [g.game_id, g]));

let totalRows = 0,
  correct = 0,
  mislabeled = 0,
  skipped = 0,
  unverifiable = 0;
for (const gid of SAMPLE) {
  const game = gmap[gid];
  if (!game) {
    console.log(`\n${gid}: not in cbb_games`);
    continue;
  }
  console.log(
    `\n=== ${gid}  ${game.away_name}(${game.away_team_id}) @ ${game.home_name}(${game.home_team_id})  ${game.date} ===`,
  );
  let contestId;
  try {
    contestId = await findNcaaContest(game);
  } catch (e) {
    console.log("  contest lookup failed:", e.message);
    continue;
  }
  if (!contestId) {
    console.log("  NCAA contest not found");
    continue;
  }
  let pitchers;
  try {
    pitchers = await fetchNcaaBoxScore(contestId);
  } catch (e) {
    console.log("  box fetch failed:", e.message);
    continue;
  }
  if (!pitchers || !pitchers.length) {
    console.log(`  contest ${contestId}: box empty/blocked`);
    continue;
  }
  // Production gate: reject contests whose teams don't match this game.
  if (!validateContestTeams(pitchers, game)) {
    const labels = [...new Set(pitchers.map((p) => p.teamLabel))];
    console.log(
      `  REJECTED contest ${contestId} (labels: ${labels.join(", ")}) — teams don't match game ✓`,
    );
    continue;
  }
  const assigned = assignTeamIds(pitchers, game); // logic under test
  for (const r of assigned) {
    totalRows++;
    const real = byName[norm(r.pitcher_name)];
    const got = String(r.team_id);
    if (got === "null" || r.team_id == null) {
      skipped++;
      continue;
    }
    if (!real) {
      unverifiable++;
      console.log(
        `  ? "${r.pitcher_name}" -> ${got} (label="${pitchers.find((p) => p.pitcherName === r.pitcher_name)?.teamLabel}") [name not in any roster]`,
      );
      continue;
    }
    if (real.has(got)) {
      correct++;
    } else {
      mislabeled++;
      console.log(
        `  ✗ MISLABEL "${r.pitcher_name}" -> ${got} (label="${pitchers.find((p) => p.pitcherName === r.pitcher_name)?.teamLabel}") but really ${[...real].join(",")}`,
      );
    }
  }
  console.log(`  contest ${contestId}: ${assigned.length} pitchers parsed`);
}
console.log(`\n===== SUMMARY (current assignTeamIds) =====`);
console.log(
  `rows=${totalRows} correct=${correct} mislabeled=${mislabeled} skipped(null)=${skipped} unverifiable(name not rostered)=${unverifiable}`,
);
await closeBrowser();
