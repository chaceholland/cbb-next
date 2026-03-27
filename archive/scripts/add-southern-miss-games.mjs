#!/usr/bin/env node
/**
 * Insert Southern Miss (team_id: 192) games from schedule.json into cbb_games,
 * then mark past games as completed and scrape pitcher participation.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const SCHEDULE_PATH = join(__dirname, "../CBB/data/schedule.json");
const USM_TEAM_ID = "192";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 1. Load Southern Miss games from schedule.json ───────────────────────────

function loadUsmGames() {
  const raw = JSON.parse(readFileSync(SCHEDULE_PATH, "utf8"));
  const games = raw.games || raw;
  return games.filter(
    (g) =>
      String(g.home_team_id || g.home || "") === USM_TEAM_ID ||
      String(g.away_team_id || g.away || "") === USM_TEAM_ID,
  );
}

// ─── 2. ESPN helpers ───────────────────────────────────────────────────────────

async function fetchEspnSummary(gameId) {
  const resp = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`,
  );
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function extractPitchers(data, gameId) {
  const records = [];
  try {
    for (const teamData of data?.boxscore?.players || []) {
      const teamId = String(teamData.team?.id || "");
      const pitching = teamData.statistics?.find(
        (s) => s.name === "pitching" || s.type === "pitching",
      );
      if (!pitching?.athletes) continue;
      const labels = pitching.labels || [];
      for (const athlete of pitching.athletes) {
        const pitcherId = String(athlete.athlete?.id || "");
        if (!pitcherId) continue;
        const stats = {};
        (athlete.stats || []).forEach((v, i) => {
          if (labels[i]) stats[labels[i]] = v;
        });
        records.push({
          game_id: gameId,
          team_id: teamId,
          pitcher_id: pitcherId,
          pitcher_name: athlete.athlete?.displayName || "",
          stats,
        });
      }
    }
  } catch (e) {}
  return records;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("⚾ Adding Southern Miss games to cbb_games");
  console.log("=".repeat(60));

  // Step 1: Load + insert games
  const usmGames = loadUsmGames();
  console.log(
    `\n📋 Found ${usmGames.length} Southern Miss games in schedule.json\n`,
  );

  const records = usmGames
    .map((g) => ({
      game_id: String(g.id || g.espn_game_id || ""),
      week: g.week || 1,
      home_team_id: String(g.home_team_id || g.home || ""),
      away_team_id: String(g.away_team_id || g.away || ""),
      home_name: g.home_team_name || null,
      away_name: g.away_team_name || null,
      date: g.date,
      venue: g.venue || null,
      completed: false,
      status: g.status || "scheduled",
    }))
    .filter((r) => r.game_id);

  const { error: insertError } = await supabase
    .from("cbb_games")
    .upsert(records, { onConflict: "game_id" });

  if (insertError) {
    console.error("❌ Failed to insert games:", insertError.message);
    process.exit(1);
  }
  console.log(`✅ Upserted ${records.length} games into cbb_games\n`);

  // Step 2: Mark past games as completed via ESPN
  const now = new Date();
  const pastGames = records.filter((g) => new Date(g.date) < now);
  console.log(`🔍 Checking ESPN for ${pastGames.length} past games...\n`);

  let marked = 0;
  const completedIds = [];

  for (const game of pastGames) {
    await sleep(300);
    try {
      const data = await fetchEspnSummary(game.game_id);
      const comp = data?.header?.competitions?.[0];
      const isComplete = comp?.status?.type?.completed === true;

      if (isComplete) {
        const homeScore = comp?.competitors?.find(
          (t) => t.homeAway === "home",
        )?.score;
        const awayScore = comp?.competitors?.find(
          (t) => t.homeAway === "away",
        )?.score;
        const homeName = comp?.competitors?.find((t) => t.homeAway === "home")
          ?.team?.displayName;
        const awayName = comp?.competitors?.find((t) => t.homeAway === "away")
          ?.team?.displayName;
        const venue = comp?.venue?.fullName;

        await supabase
          .from("cbb_games")
          .update({
            completed: true,
            status: "final",
            home_score: homeScore,
            away_score: awayScore,
            home_name: homeName,
            away_name: awayName,
            venue,
          })
          .eq("game_id", game.game_id);

        console.log(
          `  ✅ ${awayName} @ ${homeName} (${game.date.slice(0, 10)}) — ${awayScore}-${homeScore}`,
        );
        completedIds.push(game.game_id);
        marked++;
      } else {
        const status = comp?.status?.type?.name || "unknown";
        console.log(
          `  ⏳ ${game.away_name || "?"} @ ${game.home_name || "?"} (${game.date.slice(0, 10)}) — ${status}`,
        );
      }
    } catch (e) {
      console.log(`  ❌ ${game.game_id}: ${e.message}`);
    }
  }

  console.log(`\n✅ Marked ${marked} games as completed\n`);

  if (completedIds.length === 0) {
    console.log("ℹ️  No completed games to scrape participation for.");
    return;
  }

  // Step 3: Scrape pitcher participation for completed games
  console.log(
    `🎯 Scraping pitcher participation for ${completedIds.length} completed games...\n`,
  );

  let scraped = 0,
    totalPitchers = 0;

  for (const gameId of completedIds) {
    await sleep(300);
    try {
      const data = await fetchEspnSummary(gameId);
      const pitchers = extractPitchers(data, gameId);

      if (pitchers.length > 0) {
        const { error } = await supabase
          .from("cbb_pitcher_participation")
          .upsert(pitchers, { onConflict: "game_id,pitcher_id" });

        if (error) {
          console.log(
            `  ❌ ${gameId}: participation insert failed — ${error.message}`,
          );
        } else {
          console.log(`  ✅ ${gameId}: ${pitchers.length} pitchers`);
          totalPitchers += pitchers.length;
          scraped++;
        }
      } else {
        console.log(`  ⚠️  ${gameId}: no pitcher data yet`);
      }
    } catch (e) {
      console.log(`  ❌ ${gameId}: ${e.message}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Done!`);
  console.log(`   Games inserted: ${records.length}`);
  console.log(`   Marked complete: ${marked}`);
  console.log(
    `   Participation scraped: ${scraped} games, ${totalPitchers} pitcher records`,
  );
  console.log("=".repeat(60));
}

main().catch(console.error);
