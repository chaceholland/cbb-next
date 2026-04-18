#!/usr/bin/env node
/**
 * NCAA Stats Fallback Scraper
 *
 * For games where ESPN returned no data (scrape_status = 'no_data_available'),
 * this script attempts to find the game on stats.ncaa.org and extract pitcher
 * participation data from the official NCAA box score.
 *
 * Data flow:
 *   1. Query cbb_games for completed games with no ESPN data in the last N days
 *   2. For each game, fetch the NCAA scoreboard for that date
 *   3. Match game by team names → extract NCAA contest_id
 *   4. Fetch NCAA box score HTML → parse pitcher stats
 *   5. Upsert into cbb_pitcher_participation with source='ncaa'
 *   6. Update scrape_status to 'ncaa_has_data' or 'ncaa_no_data'
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { chromium as baseChromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
const chromium = baseChromium;
chromium.use(stealthPlugin());

// ─── Supabase setup ───────────────────────────────────────────────────────────

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length)
    env[key.trim()] = rest
      .join("=")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\\[nr]/g, "");
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

// NCAA academic year: spring 2026 season = academic year 2026
const NCAA_ACADEMIC_YEAR = new Date().getFullYear();
const NCAA_SPORT_CODE = "MBA";
const NCAA_DIVISION = "1";

// Known ESPN→NCAA name overrides for teams with significantly different names
const TEAM_NAME_OVERRIDES = {
  "ole miss rebels": "mississippi",
  "ole miss": "mississippi",
  "lsu tigers": "louisiana st",
  lsu: "louisiana st",
  "usc trojans": "southern california",
  usc: "southern california",
  "ucf knights": "central florida",
  ucf: "central florida",
  "miami hurricanes": "miami fl",
  "pitt panthers": "pittsburgh",
  "nc state wolfpack": "north carolina st",
  "nc state": "north carolina st",
  "vt hokies": "virginia tech",
  "unlv rebels": "nevada las vegas",
  unlv: "nevada las vegas",
  "utsa roadrunners": "texas san antonio",
  utsa: "texas san antonio",
  "utep miners": "texas el paso",
  utep: "texas el paso",
  "uab blazers": "alabama birmingham",
  uab: "alabama birmingham",
  "unc tar heels": "north carolina",
  unc: "north carolina",
  "tcu horned frogs": "texas christian",
  tcu: "texas christian",
  "smu mustangs": "southern methodist",
  smu: "southern methodist",
  "byu cougars": "brigham young",
  byu: "brigham young",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalize a team name for fuzzy matching.
 * Returns an array of meaningful tokens.
 */
function tokenize(name) {
  if (!name) return [];
  const lower = name.toLowerCase().trim();
  // Check override map first
  for (const [key, val] of Object.entries(TEAM_NAME_OVERRIDES)) {
    if (lower.includes(key)) return tokenize(val);
  }
  return lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the", "and", "for"].includes(w));
}

/**
 * Returns true if at least one token from `a` appears in `b` string.
 */
function nameMatches(espnName, ncaaText) {
  const tokens = tokenize(espnName);
  const haystack = ncaaText.toLowerCase();
  return tokens.some((t) => haystack.includes(t));
}

/**
 * Convert ISO date string (YYYY-MM-DD or full ISO) to MM/DD/YYYY for NCAA.
 */
function toNcaaDate(dateStr) {
  const d = new Date(dateStr);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// ─── NCAA scraping (uses Playwright to bypass Akamai bot detection) ──────────

// Shared browser instance, created once per run
let _browser = null;
let _page = null;

async function getBrowserPage() {
  if (!_browser) {
    _browser = await chromium.launch({ headless: true });
    const context = await _browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    _page = await context.newPage();
    // Prime the session with a first visit to pass any interstitial
    await _page.goto("https://stats.ncaa.org", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await sleep(1500);
  }
  return _page;
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
    _page = null;
  }
}

/**
 * Fetch a URL via Playwright, waiting for the real page content to load.
 * Returns the full page HTML after bot challenges resolve.
 */
async function browserFetch(url) {
  const page = await getBrowserPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  // Wait for Akamai interstitial to clear and real content to render
  await page
    .waitForFunction(
      () => {
        const t = document.title || "";
        if (t.includes("Access Denied") || t.trim().length === 0) return false;
        return document.body && document.body.innerText.length > 800;
      },
      { timeout: 15000 },
    )
    .catch(() => {});
  return await page.content();
}

/**
 * Fetch the NCAA scoreboard HTML for a given date using plain fetch.
 * The scoreboard endpoint is not bot-protected and returns full HTML.
 */
async function fetchNcaaScoreboard(dateStr) {
  const ncaaDate = encodeURIComponent(toNcaaDate(dateStr));
  const url = `https://stats.ncaa.org/contests/scoreboards?utf8=%E2%9C%93&game_date=${ncaaDate}&sport_code=${NCAA_SPORT_CODE}&division=${NCAA_DIVISION}&academic_year=${NCAA_ACADEMIC_YEAR}&conference_id=0&region_id=0`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Scoreboard HTTP ${res.status}`);
  return await res.text();
}

/**
 * Parse contest IDs and team names from the scoreboard HTML.
 * Returns array of { contestId, text } where text is the surrounding HTML chunk.
 */
function parseScoreboardContests(html) {
  const contests = [];
  // Match links like /contests/12345678/box_score
  const linkRe = /href="\/contests\/(\d+)\/box_score"/g;
  let match;
  while ((match = linkRe.exec(html)) !== null) {
    const contestId = match[1];
    // Grab surrounding 800 chars for team name matching
    const start = Math.max(0, match.index - 600);
    const end = Math.min(html.length, match.index + 200);
    contests.push({ contestId, text: html.slice(start, end) });
  }
  return contests;
}

/**
 * Find the NCAA contest ID for a game given team names.
 */
async function findNcaaContest(game) {
  const html = await fetchNcaaScoreboard(game.date);
  const contests = parseScoreboardContests(html);

  if (contests.length === 0) return null;

  for (const { contestId, text } of contests) {
    const homeMatch = nameMatches(game.home_name || "", text);
    const awayMatch = nameMatches(game.away_name || "", text);
    if (homeMatch && awayMatch) return contestId;
  }

  // Looser pass: match just one team if scoreboard is sparse
  for (const { contestId, text } of contests) {
    const homeMatch = nameMatches(game.home_name || "", text);
    const awayMatch = nameMatches(game.away_name || "", text);
    if (homeMatch || awayMatch) {
      // Require at least one distinctive token match, not just short words
      const homeTokens = tokenize(game.home_name || "");
      const awayTokens = tokenize(game.away_name || "");
      const haystack = text.toLowerCase();
      const strongMatch =
        homeTokens.some((t) => t.length > 4 && haystack.includes(t)) ||
        awayTokens.some((t) => t.length > 4 && haystack.includes(t));
      if (strongMatch) return contestId;
    }
  }

  return null;
}

/**
 * Fetch and parse the NCAA box score for a contest.
 * Returns array of pitcher rows: { team_label, name, IP, H, R, ER, BB, K, HR }
 * Fast-fails if box score is blocked (403/Access Denied).
 */
async function fetchNcaaBoxScore(contestId) {
  // The `individual_stats` page carries the full pitcher stat table.
  // The `box_score` page only has a summary card (no sortable table).
  const url = `https://stats.ncaa.org/contests/${contestId}/individual_stats`;
  try {
    const html = await browserFetch(url);
    if (html.includes("Access Denied") || html.length < 2000) return [];
    return parseNcaaPitchers(html);
  } catch (err) {
    console.error(`\n  browser fetch failed for ${contestId}: ${err.message}`);
    return [];
  }
}

/**
 * Parse pitcher stats from NCAA box score HTML.
 *
 * NCAA box score table structure (pitching section):
 *   <td class="smcell">Name</td><td>IP</td><td>H</td><td>R</td>
 *   <td>ER</td><td>BB</td><td>SO</td><td>HR</td>...
 *
 * Returns [ { teamLabel, pitcherName, IP, H, R, ER, BB, K, HR, BF, ERA } ]
 */
function parseNcaaPitchers(html) {
  const results = [];

  // Each team's pitching section is a card shaped like:
  //   <img alt="TEAM"...>TEAM</a> Pitching
  //   ... <table ...><thead>#|Name|P|IP|H|R|ER|BB|SO|...</thead><tbody>rows</tbody></table>
  const sectionRe =
    /alt="([^"]+)"[^>]*>[^<]*<\/a>\s*Pitching[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/gi;
  let sectionMatch;
  while ((sectionMatch = sectionRe.exec(html)) !== null) {
    const teamLabel = sectionMatch[1].trim();
    const tbody = sectionMatch[2];

    // Each pitcher row. Columns after the name: P, IP, H, R, ER, BB, SO, ...
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tbody)) !== null) {
      const rowHtml = rowMatch[1];

      // Pull pitcher name from the anchor tag in the second cell
      const nameMatch = rowHtml.match(
        /<a[^>]*href="\/players\/[^"]+"[^>]*>([^<]+)<\/a>/,
      );
      if (!nameMatch) continue;
      const pitcherName = nameMatch[1].replace(/\s+/g, " ").trim();
      if (!pitcherName || pitcherName.length < 2) continue;

      // Collect all numeric stat cells in column order.
      // The stat cells carry data-order attrs; skip the first two descriptive
      // cells (#, Name) and the position cell ("P").
      const cells = [];
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cm;
      while ((cm = cellRe.exec(rowHtml)) !== null) {
        cells.push(
          cm[1]
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, "")
            .trim(),
        );
      }
      // Drop empty leading cells, then locate IP (first cell after the "P" column).
      // Actual layout: [#, name, P, IP, H, R, ER, BB, SO, ...]
      if (cells.length < 8) continue;
      const [, , , IP, H, R, ER, BB, SO] = cells;
      if (!IP || !/^\d/.test(IP)) continue;

      results.push({
        teamLabel,
        pitcherName,
        stats: {
          IP: IP || null,
          H: H || null,
          R: R || null,
          ER: ER || null,
          BB: BB || null,
          K: SO || null,
          HR: null,
          source: "ncaa",
        },
      });
    }
  }

  return results;
}

/**
 * Match NCAA pitcher rows to team IDs using the team label vs game team names.
 */
function assignTeamIds(pitchers, game) {
  const homeName = game.home_name || "";
  const awayName = game.away_name || "";

  return pitchers.map((p) => {
    const label = p.teamLabel;
    const homeScore = tokenize(homeName).filter((t) =>
      label.toLowerCase().includes(t),
    ).length;
    const awayScore = tokenize(awayName).filter((t) =>
      label.toLowerCase().includes(t),
    ).length;

    let teamId;
    if (homeScore >= awayScore) {
      teamId = game.home_team_id;
    } else {
      teamId = game.away_team_id;
    }

    // Generate a synthetic pitcher_id since we don't have ESPN athlete IDs
    const normalizedName = p.pitcherName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const pitcherId = `NCAA-${game.game_id}-${teamId}-${normalizedName}`;

    return {
      game_id: game.game_id,
      team_id: teamId,
      pitcher_id: pitcherId,
      pitcher_name: p.pitcherName,
      stats: p.stats,
    };
  });
}

// ─── Database helpers ─────────────────────────────────────────────────────────

async function savePitchers(rows) {
  if (rows.length === 0) return { success: 0, errors: 0 };
  const { error } = await supabase
    .from("cbb_pitcher_participation")
    .upsert(rows, {
      onConflict: "game_id,pitcher_id",
      ignoreDuplicates: false,
    });
  if (error) {
    console.error("  DB error:", error.message);
    return { success: 0, errors: rows.length };
  }
  return { success: rows.length, errors: 0 };
}

async function updateScrapeStatus(gameId, status) {
  const { data: game } = await supabase
    .from("cbb_games")
    .select("scrape_attempts")
    .eq("game_id", gameId)
    .single();

  await supabase
    .from("cbb_games")
    .update({
      scrape_status: status,
      last_scrape_attempt: new Date().toISOString(),
      scrape_attempts: (game?.scrape_attempts || 0) + 1,
    })
    .eq("game_id", gameId);
}

async function findGamesForNcaaFallback(daysBack = 14) {
  const { data: trackedTeams } = await supabase
    .from("cbb_teams")
    .select("team_id");
  const trackedIds = new Set(trackedTeams.map((t) => t.team_id));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  // Fetch all completed games in window involving tracked teams
  const { data: games } = await supabase
    .from("cbb_games")
    .select("*")
    .eq("completed", true)
    .gte("date", cutoff.toISOString())
    .order("date", { ascending: false });

  const trackedGames = (games || []).filter(
    (g) => trackedIds.has(g.home_team_id) || trackedIds.has(g.away_team_id),
  );

  // If scrape_status column exists, filter to no_data_available games only
  // Otherwise fall back to finding games with no participation rows at all
  const hasScrapeStatus =
    trackedGames.length > 0 && "scrape_status" in trackedGames[0];

  if (hasScrapeStatus) {
    // Include any game that's been flagged as missing by an upstream source
    // (ESPN, D1Baseball, or a prior NCAA attempt).
    const retryStatuses = new Set([
      "no_data_available",
      "ncaa_error",
      "ncaa_no_data",
      "d1_no_data",
    ]);
    const candidates = trackedGames.filter(
      (g) => !g.scrape_status || retryStatuses.has(g.scrape_status),
    );
    // Of those, keep only the ones still lacking participation rows.
    const gameIds = candidates.map((g) => g.game_id);
    if (gameIds.length === 0) return [];
    const withData = new Set();
    for (let i = 0; i < gameIds.length; i += 200) {
      const chunk = gameIds.slice(i, i + 200);
      const { data } = await supabase
        .from("cbb_pitcher_participation")
        .select("game_id")
        .in("game_id", chunk);
      (data || []).forEach((r) => withData.add(r.game_id));
    }
    return candidates.filter((g) => !withData.has(g.game_id));
  }

  // Fallback: find games with no participation data
  const gameIds = trackedGames.map((g) => g.game_id);
  if (gameIds.length === 0) return [];

  const { data: existing } = await supabase
    .from("cbb_pitcher_participation")
    .select("game_id")
    .in("game_id", gameIds);

  const hasData = new Set((existing || []).map((r) => r.game_id));
  return trackedGames.filter((g) => !hasData.has(g.game_id));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function ncaaFallback(options = {}) {
  const {
    daysBack = 14,
    maxGames = null,
    delayMs = 800,
    verbose = true,
  } = options;

  if (verbose) {
    console.log("\n🎓 NCAA Stats Fallback Scraper");
    console.log("═".repeat(60));
    console.log(
      `Looking back: ${daysBack} days | Academic year: ${NCAA_ACADEMIC_YEAR}`,
    );
    console.log(`Rate limit: ${delayMs}ms between requests\n`);
  }

  const games = await findGamesForNcaaFallback(daysBack);
  const toScrape = maxGames ? games.slice(0, maxGames) : games;

  if (verbose) {
    console.log(`Found ${games.length} games with no ESPN data`);
    console.log(`Will attempt NCAA lookup for: ${toScrape.length} games\n`);
  }

  const results = {
    total: toScrape.length,
    successful: 0,
    noData: 0,
    errors: 0,
    totalPitchers: 0,
    games: [],
  };

  for (let i = 0; i < toScrape.length; i++) {
    const game = toScrape[i];
    const progress = `[${i + 1}/${toScrape.length}]`;
    const matchup = `${game.away_name || "?"} @ ${game.home_name || "?"}`;

    if (verbose) process.stdout.write(`${progress} ${matchup}... `);

    try {
      // Step 1: Find the NCAA contest ID
      const contestId = await findNcaaContest(game);

      if (!contestId) {
        if (verbose) console.log("⚠️  Not found on NCAA scoreboard");
        await updateScrapeStatus(game.game_id, "ncaa_no_data");
        results.noData++;
        results.games.push({
          game_id: game.game_id,
          matchup,
          status: "not_found",
        });
        await sleep(delayMs);
        continue;
      }

      if (verbose) process.stdout.write(`contest ${contestId}... `);

      // Step 2: Fetch and parse the box score
      await sleep(400); // small gap between find and fetch
      const pitchers = await fetchNcaaBoxScore(contestId);

      if (pitchers.length === 0) {
        if (verbose) console.log("⚠️  Box score found but no pitching data");
        await updateScrapeStatus(game.game_id, "ncaa_no_data");
        results.noData++;
        results.games.push({
          game_id: game.game_id,
          matchup,
          status: "no_pitching_data",
          contestId,
        });
        await sleep(delayMs);
        continue;
      }

      // Step 3: Assign team IDs and save
      const rows = assignTeamIds(pitchers, game);
      const { success } = await savePitchers(rows);
      await updateScrapeStatus(game.game_id, "ncaa_has_data");

      if (verbose)
        console.log(`✅ ${pitchers.length} pitchers (contest ${contestId})`);
      results.successful++;
      results.totalPitchers += success;
      results.games.push({
        game_id: game.game_id,
        matchup,
        status: "success",
        contestId,
        pitchers: pitchers.length,
      });
    } catch (err) {
      if (verbose) console.log(`❌ ${err.message}`);
      await updateScrapeStatus(game.game_id, "ncaa_error");
      results.errors++;
      results.games.push({
        game_id: game.game_id,
        matchup,
        status: "error",
        message: err.message,
      });
    }

    if (i < toScrape.length - 1) await sleep(delayMs);
  }

  await closeBrowser();

  if (verbose) {
    console.log("\n" + "═".repeat(60));
    console.log("📊 NCAA Fallback Summary:");
    console.log(
      `  ✅ Successful: ${results.successful} games (${results.totalPitchers} pitchers)`,
    );
    console.log(`  ⚠️  No NCAA data: ${results.noData} games`);
    console.log(`  ❌ Errors: ${results.errors} games`);
  }

  return results;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const options = { daysBack: 14, maxGames: null, delayMs: 800, verbose: true };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      options.daysBack = parseInt(args[++i]);
    } else if (args[i] === "--max" && args[i + 1]) {
      options.maxGames = parseInt(args[++i]);
    } else if (args[i] === "--delay" && args[i + 1]) {
      options.delayMs = parseInt(args[++i]);
    } else if (args[i] === "--quiet" || args[i] === "-q") {
      options.verbose = false;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: node ncaa-fallback-scraper.mjs [options]");
      console.log("");
      console.log("Scrapes stats.ncaa.org for games where ESPN had no data.");
      console.log("");
      console.log("Options:");
      console.log("  --days <n>     Look back N days (default: 14)");
      console.log("  --max <n>      Max games to attempt (default: all)");
      console.log("  --delay <ms>   Delay between requests (default: 800)");
      console.log("  --quiet, -q    Suppress verbose output");
      return;
    }
  }

  const results = await ncaaFallback(options);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = `scraper-logs/ncaa-fallback-log-${timestamp}.json`;
  fs.mkdirSync("scraper-logs", { recursive: true });
  fs.writeFileSync(logFile, JSON.stringify(results, null, 2));

  if (options.verbose) console.log(`\n📄 Results saved to: ${logFile}`);

  process.exit(results.errors > results.successful ? 1 : 0);
}

export { ncaaFallback };

// Only run CLI main when executed directly, not when imported
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}
