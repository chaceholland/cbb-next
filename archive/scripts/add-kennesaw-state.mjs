#!/usr/bin/env node
/**
 * Add Kennesaw State to cbb_teams + scrape 2026 roster + insert games
 * Team ID: 307, Conference: C-USA
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { chromium } from "playwright";
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

const TEAM = {
  team_id: "307",
  name: "Kennesaw State Owls",
  display_name: "Kennesaw St",
  conference: "C-USA",
  logo: "/logos/307.png",
};
const ROSTER_URL = "https://ksuowls.com/sports/baseball/roster";
const SCHEDULE_PATH = join(__dirname, "../CBB/data/schedule.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. Upsert team ─────────────────────────────────────────────────────────────
async function upsertTeam() {
  const { error } = await supabase
    .from("cbb_teams")
    .upsert(TEAM, { onConflict: "team_id" });
  if (error) throw new Error(`Team upsert failed: ${error.message}`);
  console.log("✅ Kennesaw State added to cbb_teams\n");
}

// ── 2. Scrape roster ───────────────────────────────────────────────────────────
async function scrapeRoster(browser) {
  console.log(`🌐 Scraping: ${ROSTER_URL}\n`);
  const page = await browser.newPage();
  try {
    await page.goto(ROSTER_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    const rosterData = await page.evaluate(() => {
      const players = [];

      // PRIORITY 1: Modern SIDEARM card view
      const cardContainer = document.querySelector(
        ".c-rosterpage__players--card-view",
      );
      if (cardContainer) {
        for (const card of cardContainer.querySelectorAll(".s-person-card")) {
          const nameLink = card.querySelector(
            'a[href*="/roster/"], a[href*="/player/"]',
          );
          if (!nameLink) continue;
          const name = nameLink.textContent
            ?.trim()
            .replace(/Jersey Number \d+/i, "")
            .trim();
          const headshot =
            card.querySelector("img")?.getAttribute("src") || null;
          const t = card.textContent || "";
          const position = t.match(/Position\s+([A-Z\/]+)/)?.[1] || null;
          const number = t.match(/Jersey Number\s+(\d+)/)?.[1] || null;
          const height = t.match(/Height\s+([\d'"\s]+)/)?.[1]?.trim() || null;
          const weight = t.match(/Weight\s+(\d+)\s*lbs/)?.[1] || null;
          const year = t.match(/Academic Year\s+([\w.-]+)/)?.[1] || null;
          const hometown =
            t
              .match(/Hometown\s+([^]+?)(?:Last School|Previous School|$)/)?.[1]
              ?.trim() || null;
          const btMatch = t.match(/\b([LR])[-\/]([LR])\b/);
          players.push({
            name,
            display_name: name,
            number,
            position,
            headshot,
            height,
            weight,
            year,
            hometown,
            bats_throws: btMatch?.[0] || null,
          });
        }
        return players;
      }

      // PRIORITY 2: Older SIDEARM (.sidearm-roster-player)
      const oldCards = document.querySelectorAll(".sidearm-roster-player");
      if (oldCards.length) {
        for (const card of oldCards) {
          // Name is in h3 > a, not just any anchor
          const nameEl =
            card.querySelector("h3 a") ||
            card.querySelector(".sidearm-roster-player-name a");
          if (!nameEl) continue;
          const name = nameEl.textContent?.trim();
          if (!name) continue;
          const imgEl = card.querySelector("img");
          const imgSrc =
            imgEl?.getAttribute("data-src") ||
            imgEl?.getAttribute("src") ||
            null;
          const headshot =
            imgSrc && !imgSrc.includes("silhouette") ? imgSrc : null;
          const t = card.textContent || "";
          const position =
            card
              .querySelector(".sidearm-roster-player-position span.text-bold")
              ?.textContent?.trim() ||
            t.match(/\b(P|RHP|LHP|C|1B|2B|3B|SS|OF|INF|UTIL)\b/)?.[0] ||
            null;
          const number =
            card
              .querySelector(".sidearm-roster-player-jersey-number")
              ?.textContent?.trim() || null;
          const height =
            card.querySelector("[class*='height']")?.textContent?.trim() ||
            null;
          const weight =
            card.querySelector("[class*='weight']")?.textContent?.trim() ||
            null;
          const year =
            card
              .querySelector("[class*='academic-year'], [class*='class']")
              ?.textContent?.trim() || null;
          const btMatch = t.match(/\b([LR])[-\/]([LR])\b/);
          players.push({
            name,
            display_name: name,
            number,
            position,
            headshot,
            height,
            weight,
            year,
            hometown: null,
            bats_throws: btMatch?.[0] || null,
          });
        }
        return players;
      }

      // FALLBACK: Table view
      for (const table of document.querySelectorAll("table")) {
        const rows = table.querySelectorAll("tbody tr");
        if (!rows.length) continue;
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll("td, th"));
          const texts = cells.map((c) => c.textContent?.trim() || "");
          let name = null,
            number = null,
            position = null,
            headshot = null;
          let height = null,
            weight = null,
            year = null,
            hometown = null,
            batsThrows = null;
          for (const cell of cells) {
            const link = cell.querySelector(
              'a[href*="/roster/"], a[href*="/player/"]',
            );
            if (link) {
              name = link.textContent?.trim();
              const img = cell.querySelector("img");
              if (img) {
                const s = img.getAttribute("src");
                if (s && !s.includes("logo")) headshot = s;
              }
              break;
            }
          }
          if (!name) {
            for (const t of texts) {
              if (
                !/^\d{1,3}$/.test(t) &&
                t.split(" ").length >= 2 &&
                t.length > 5
              ) {
                name = t;
                break;
              }
            }
          }
          if (!name) continue;
          if (/^\d{1,2}$/.test(texts[0])) number = texts[0];
          for (let i = 0; i < cells.length; i++) {
            const t = texts[i];
            if (!t) continue;
            const lbl =
              cells[i].getAttribute("data-label")?.toLowerCase() || "";
            if (lbl.includes("pos")) position = t;
            else if (lbl.includes("height") || lbl.includes("ht")) height = t;
            else if (lbl.includes("weight") || lbl.includes("wt")) weight = t;
            else if (
              lbl.includes("year") ||
              lbl.includes("class") ||
              lbl.includes("yr")
            )
              year = t;
            else if (lbl.includes("hometown") || lbl.includes("home"))
              hometown = t;
            else if (
              lbl.includes("b/t") ||
              (lbl.includes("bat") && lbl.includes("throw"))
            )
              batsThrows = t;
            else {
              if (
                !position &&
                /^(P|RHP|LHP|C|1B|2B|3B|SS|OF|INF|UTIL)$/i.test(t)
              )
                position = t;
              else if (!height && /\d+[-']\s*\d+/.test(t)) height = t;
              else if (!weight && /^(1[5-9]\d|[2-3]\d{2})(lbs?)?$/i.test(t))
                weight = t.replace(/lbs?/i, "").trim();
              else if (
                !year &&
                /^(r-)?(fr|so|jr|sr|freshman|sophomore|junior|senior)\.?$/i.test(
                  t,
                )
              )
                year = t;
              else if (!batsThrows && /^[LR][-\/][LR]$/i.test(t))
                batsThrows = t;
              else if (
                !hometown &&
                t.length > 10 &&
                (t.includes(",") || t.includes("/"))
              )
                hometown = t;
            }
          }
          players.push({
            name,
            display_name: name,
            number,
            position,
            headshot,
            height,
            weight,
            year,
            hometown,
            bats_throws: batsThrows,
          });
        }
        if (players.length) break;
      }
      return players;
    });

    await page.close();
    const pitchers = rosterData.filter(
      (p) => p.position && /^(P|RHP|LHP)$/i.test(p.position),
    );
    console.log(
      `Found ${rosterData.length} total players, ${pitchers.length} pitchers\n`,
    );
    if (!pitchers.length) {
      const positions = [
        ...new Set(rosterData.map((p) => p.position).filter(Boolean)),
      ];
      console.log("  All positions found:", positions.join(", ") || "none");
    }
    return pitchers;
  } catch (e) {
    await page.close();
    throw e;
  }
}

async function insertPitchers(pitchers) {
  await supabase.from("cbb_pitchers").delete().eq("team_id", "307");
  if (!pitchers.length) {
    console.log("⚠️  No pitchers to insert.\n");
    return;
  }
  const records = pitchers.map((p, i) => ({
    pitcher_id: `307-P${i + 1}`,
    team_id: "307",
    name: p.name,
    display_name: p.display_name || p.name,
    number: p.number || null,
    position: p.position,
    headshot: p.headshot || null,
    height: p.height || null,
    weight: p.weight || null,
    year: p.year || null,
    hometown: p.hometown || null,
    bats_throws: p.bats_throws || null,
  }));
  const { error } = await supabase.from("cbb_pitchers").insert(records);
  if (error) throw new Error(`Pitcher insert failed: ${error.message}`);
  console.log(`✅ Inserted ${records.length} pitchers\n`);
  records.forEach((p) =>
    console.log(
      `  [${p.number || "--"}] ${p.name} (${p.position}) ${p.year || ""} ${p.hometown ? "— " + p.hometown : ""}`,
    ),
  );
}

// ── 3. Insert games ────────────────────────────────────────────────────────────
async function insertGames() {
  const raw = JSON.parse(readFileSync(SCHEDULE_PATH, "utf8"));
  const all = raw.games || raw;
  const teamGames = all.filter(
    (g) =>
      String(g.home_team_id || g.home || "") === "307" ||
      String(g.away_team_id || g.away || "") === "307",
  );
  console.log(
    `\n📋 Found ${teamGames.length} Kennesaw State games in schedule.json\n`,
  );

  const records = teamGames
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

  const { error } = await supabase
    .from("cbb_games")
    .upsert(records, { onConflict: "game_id" });
  if (error) throw new Error(`Game insert failed: ${error.message}`);
  console.log(`✅ Upserted ${records.length} games into cbb_games\n`);

  // Mark past games complete via ESPN
  const now = new Date();
  const pastGames = records.filter((g) => new Date(g.date) < now);
  console.log(`🔍 Checking ESPN for ${pastGames.length} past games...\n`);

  let marked = 0;
  const completedIds = [];

  for (const game of pastGames) {
    await sleep(300);
    try {
      const resp = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${game.game_id}`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const comp = data?.header?.competitions?.[0];
      if (comp?.status?.type?.completed) {
        const homeScore = comp.competitors?.find(
          (t) => t.homeAway === "home",
        )?.score;
        const awayScore = comp.competitors?.find(
          (t) => t.homeAway === "away",
        )?.score;
        const homeName = comp.competitors?.find((t) => t.homeAway === "home")
          ?.team?.displayName;
        const awayName = comp.competitors?.find((t) => t.homeAway === "away")
          ?.team?.displayName;
        const venue = comp.venue?.fullName;
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

  if (!completedIds.length) {
    console.log("ℹ️  No completed games to scrape participation for.");
    return;
  }
  console.log(
    `🎯 Scraping pitcher participation for ${completedIds.length} completed games...\n`,
  );
  let scraped = 0,
    totalPitchers = 0;
  for (const gameId of completedIds) {
    await sleep(300);
    try {
      const resp = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`,
      );
      const data = await resp.json();
      const pitcherRecords = [];
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
          pitcherRecords.push({
            game_id: gameId,
            team_id: teamId,
            pitcher_id: pitcherId,
            pitcher_name: athlete.athlete?.displayName || "",
            stats,
          });
        }
      }
      if (pitcherRecords.length) {
        const { error } = await supabase
          .from("cbb_pitcher_participation")
          .upsert(pitcherRecords, { onConflict: "game_id,pitcher_id" });
        if (error) console.log(`  ❌ ${gameId}: ${error.message}`);
        else {
          console.log(`  ✅ ${gameId}: ${pitcherRecords.length} pitchers`);
          scraped++;
          totalPitchers += pitcherRecords.length;
        }
      } else {
        console.log(`  ⚠️  ${gameId}: no pitcher data yet`);
      }
    } catch (e) {
      console.log(`  ❌ ${gameId}: ${e.message}`);
    }
  }
  console.log(
    `\n   Participation: ${scraped} games, ${totalPitchers} pitcher records`,
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("⚾ Adding Kennesaw State to CBB Pitcher Tracker");
  console.log("=".repeat(60));
  console.log();

  await upsertTeam();

  const browser = await chromium.launch({ headless: true });
  try {
    const pitchers = await scrapeRoster(browser);
    await insertPitchers(pitchers);
  } finally {
    await browser.close();
  }

  await insertGames();

  console.log("\n" + "=".repeat(60));
  console.log("✅ Kennesaw State fully added to Rosters + Schedule.");
  console.log("=".repeat(60));
}

main().catch(console.error);
