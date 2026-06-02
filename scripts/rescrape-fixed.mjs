// Re-scrape NCAA participation for games reset during pollution cleanup, using
// the FIXED pipeline (strict contest match + validation gate + strict assign).
// Writes only validated, correctly-attributed rows. Bounded by --max.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import {
  findNcaaContest,
  fetchNcaaBoxScore,
  validateContestTeams,
  assignTeamIds,
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
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const MAX =
  Number(
    (process.argv.find((a) => a.startsWith("--max=")) || "").split("=")[1] || 0,
  ) || Infinity;
const SKIP = Number(
  (process.argv.find((a) => a.startsWith("--skip=")) || "").split("=")[1] || 0,
);

// tracked teams = teams with a roster
let ros = [],
  from = 0;
for (;;) {
  const { data } = await sb
    .from("cbb_pitchers")
    .select("team_id")
    .range(from, from + 999);
  ros.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}
const tracked = new Set(ros.map((r) => String(r.team_id)));

// reset games: completed, status NULL, involving a tracked team
let games = [],
  gf = 0;
for (;;) {
  const { data } = await sb
    .from("cbb_games")
    .select("game_id,home_team_id,away_team_id,home_name,away_name,date")
    .eq("completed", true)
    .is("scrape_status", null)
    .order("date", { ascending: false })
    .range(gf, gf + 999);
  games.push(...data);
  if (data.length < 1000) break;
  gf += 1000;
}
games = games.filter(
  (g) =>
    tracked.has(String(g.home_team_id)) || tracked.has(String(g.away_team_id)),
);
games = games.slice(SKIP, SKIP + MAX);
console.log(`re-scraping ${games.length} games (NCAA fixed pipeline)`);

let ok = 0,
  rejected = 0,
  notfound = 0,
  empty = 0,
  errors = 0,
  wrote = 0;
for (let i = 0; i < games.length; i++) {
  const g = games[i];
  const tag = `[${i + 1}/${games.length}] ${g.away_name} @ ${g.home_name}`;
  try {
    const contestId = await findNcaaContest(g);
    if (!contestId) {
      notfound++;
      await sb
        .from("cbb_games")
        .update({ scrape_status: "ncaa_no_data", scrape_attempts: 1 })
        .eq("game_id", g.game_id);
      console.log(`${tag} — not found`);
      await sleep(700);
      continue;
    }
    await sleep(400);
    const pitchers = await fetchNcaaBoxScore(contestId);
    if (!pitchers.length) {
      empty++;
      await sb
        .from("cbb_games")
        .update({ scrape_status: "ncaa_no_data", scrape_attempts: 1 })
        .eq("game_id", g.game_id);
      console.log(`${tag} — box empty`);
      await sleep(700);
      continue;
    }
    if (!validateContestTeams(pitchers, g)) {
      rejected++;
      await sb
        .from("cbb_games")
        .update({ scrape_status: "ncaa_no_data", scrape_attempts: 1 })
        .eq("game_id", g.game_id);
      console.log(`${tag} — REJECTED (team mismatch)`);
      await sleep(700);
      continue;
    }
    const rows = assignTeamIds(pitchers, g);
    if (rows.length) {
      const { error } = await sb
        .from("cbb_pitcher_participation")
        .upsert(rows, {
          onConflict: "game_id,pitcher_id",
          ignoreDuplicates: false,
        });
      if (error) throw error;
      wrote += rows.length;
    }
    await sb
      .from("cbb_games")
      .update({ scrape_status: "ncaa_has_data", scrape_attempts: 1 })
      .eq("game_id", g.game_id);
    ok++;
    console.log(
      `${tag} — ✅ ${rows.length}/${pitchers.length} saved (contest ${contestId})`,
    );
  } catch (e) {
    errors++;
    console.log(`${tag} — ❌ ${e.message}`);
  }
  await sleep(700);
}
console.log(
  `\nDONE: ok=${ok} wrote=${wrote} notfound=${notfound} rejected=${rejected} empty=${empty} errors=${errors}`,
);
await closeBrowser();
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
