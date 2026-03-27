#!/usr/bin/env node
/**
 * D1Baseball / StatBroadcast Fallback Scraper
 *
 * For games where ESPN returned no pitcher data, this script:
 *   1. Fetches the D1Baseball scoreboard for the game's date
 *   2. Finds the matching game and extracts the StatBroadcast box score ID
 *   3. Fetches the StatBroadcast box score (plain HTML, no bot protection)
 *   4. Parses pitcher stats and saves with source='d1baseball'
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// ─── Supabase setup ───────────────────────────────────────────────────────────

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ESPN → D1Baseball team name overrides
const TEAM_NAME_OVERRIDES = {
  "ole miss rebels": "mississippi",
  "ole miss": "mississippi",
  "lsu tigers": "lsu",
  "usc trojans": "usc",
  "ucf knights": "ucf",
  "miami hurricanes": "miami (fl)",
  "pitt panthers": "pittsburgh",
  "nc state wolfpack": "nc state",
  "vt hokies": "virginia tech",
  "unlv rebels": "unlv",
  "utsa roadrunners": "utsa",
  "utep miners": "utep",
  "uab blazers": "uab",
  "unc tar heels": "unc",
  "tcu horned frogs": "tcu",
  "smu mustangs": "smu",
  "byu cougars": "byu",
  "app state mountaineers": "appalachian state",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalize team name for matching
 */
function normalize(name) {
  if (!name) return "";
  const lower = name.toLowerCase().trim();
  for (const [key, val] of Object.entries(TEAM_NAME_OVERRIDES)) {
    if (lower.includes(key)) return val;
  }
  return lower
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert ISO date to YYYYMMDD for D1Baseball
 */
function toD1Date(dateStr) {
  const d = new Date(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

// ─── D1Baseball / StatBroadcast fetching ─────────────────────────────────────

// Cache scoreboard responses per date to avoid re-fetching for each game
const scoreboard_cache = new Map();

/**
 * Fetch the D1Baseball dynamic-scores API for a given date.
 * Returns array of { broadcastId, homeEspnId, awayEspnId, homeName, awayName }
 */
async function fetchD1Scoreboard(dateStr) {
  const d1Date = toD1Date(dateStr);

  if (scoreboard_cache.has(d1Date)) return scoreboard_cache.get(d1Date);

  const url = `https://d1baseball.com/wp-content/plugins/integritive/dynamic-scores.php?v=${Date.now()}&date=${d1Date}`;
  const res = await fetch(url, {
    headers: {
      ...HEADERS,
      Referer: `https://d1baseball.com/scores/?date=${d1Date}`,
    },
  });
  if (!res.ok) throw new Error(`D1Baseball API HTTP ${res.status}`);

  const json = await res.json();
  const dump = json?.content?.["d1-scores"] || "";

  const games = [];
  const gameRe =
    /\["game_id"\]=>\s+int\((\d+)\)([\s\S]{0,4000}?)(?=\["game_id"\]|$)/g;
  let m;
  while ((m = gameRe.exec(dump)) !== null) {
    const block = m[2];
    const broadcastId = block.match(
      /statbroadcast\.com\/broadcast\/\?id=(\d+)/,
    )?.[1];
    if (!broadcastId) continue;

    const homeEspnId = block.match(
      /\["home_team_643_team_id"\]=>\s+int\((\d+)\)/,
    )?.[1];
    const awayEspnId = block.match(
      /\["road_team_643_team_id"\]=>\s+int\((\d+)\)/,
    )?.[1];
    const homeName = block.match(
      /\["home_team_name"\]=>\s+string\(\d+\)\s+"([^"]+)"/,
    )?.[1];
    const awayName = block.match(
      /\["road_team_name"\]=>\s+string\(\d+\)\s+"([^"]+)"/,
    )?.[1];

    games.push({ broadcastId, homeEspnId, awayEspnId, homeName, awayName });
  }

  scoreboard_cache.set(d1Date, games);
  return games;
}

/**
 * Find the StatBroadcast ID for an ESPN game by matching ESPN team IDs directly.
 * Falls back to fuzzy team name matching if IDs don't match.
 */
async function findD1BroadcastId(game) {
  let d1Games;
  try {
    d1Games = await fetchD1Scoreboard(game.date);
  } catch (err) {
    return null;
  }

  if (d1Games.length === 0) return null;

  const homeId = String(game.home_team_id);
  const awayId = String(game.away_team_id);

  // Primary: exact ESPN team ID match
  for (const g of d1Games) {
    if (
      (g.homeEspnId === homeId && g.awayEspnId === awayId) ||
      (g.homeEspnId === awayId && g.awayEspnId === homeId)
    ) {
      return g.broadcastId;
    }
  }

  // Fallback: fuzzy team name match
  // Require MOST significant tokens to match to avoid "Washington" matching "Washington State"
  const homeName = normalize(game.home_name || "");
  const awayName = normalize(game.away_name || "");
  const homeTokens = homeName.split(/\s+/).filter((t) => t.length > 3);
  const awayTokens = awayName.split(/\s+/).filter((t) => t.length > 3);

  // Score-based match: count how many tokens from each team appear in the d1 game names
  let bestScore = 0;
  let bestBroadcastId = null;
  for (const g of d1Games) {
    const h = normalize(g.homeName || "");
    const a = normalize(g.awayName || "");
    const hay = h + " " + a;
    const homeHits = homeTokens.filter((t) => hay.includes(t)).length;
    const awayHits = awayTokens.filter((t) => hay.includes(t)).length;
    // Both teams must match at least half their tokens, and combined score must be strong
    const homeFrac = homeTokens.length ? homeHits / homeTokens.length : 0;
    const awayFrac = awayTokens.length ? awayHits / awayTokens.length : 0;
    if (homeFrac >= 0.5 && awayFrac >= 0.5) {
      const score = homeHits + awayHits;
      if (score > bestScore) {
        bestScore = score;
        bestBroadcastId = g.broadcastId;
      }
    }
  }

  return bestBroadcastId;
}

// ─── StatBroadcast API decoding ──────────────────────────────────────────────

/**
 * ROT13 + base64 decode — matches StatBroadcast's client-side tatdsy()+atou()
 */
function decodeStatBroadcast(encoded) {
  const a = "a".charCodeAt(0),
    z = a + 26;
  const A = "A".charCodeAt(0),
    Z = A + 26;
  const rot = (c, base) => String.fromCharCode(base + ((c - base + 13) % 26));
  const b = [];
  let i = encoded.length;
  while (i--) {
    const c = encoded.charCodeAt(i);
    if (c >= a && c < z) b[i] = rot(c, a);
    else if (c >= A && c < Z) b[i] = rot(c, A);
    else b[i] = encoded[i];
  }
  return Buffer.from(b.join(""), "base64").toString("utf8");
}

const SB_WS = "https://stats.statbroadcast.com/interface/webservice/";

// Cache event metadata per broadcast ID
const event_cache = new Map();

async function fetchStatBroadcastEvent(broadcastId) {
  if (event_cache.has(broadcastId)) return event_cache.get(broadcastId);
  const data = Buffer.from("type=statbroadcast").toString("base64");
  const res = await fetch(`${SB_WS}event/${broadcastId}?data=${data}`, {
    headers: HEADERS,
  });
  if (!res.ok) return null;
  const xml = decodeStatBroadcast(await res.text());
  const xmlfile =
    xml.match(/<xmlfile><!\[CDATA\[([^\]]+)\]\]>/)?.[1] ||
    `text/${broadcastId}.xml`;
  const sport = xml.match(/<sport>([^<]+)<\/sport>/)?.[1] || "bsgame";
  const result = { xmlfile, sport };
  event_cache.set(broadcastId, result);
  return result;
}

async function fetchStatBroadcastView(broadcastId, xsl) {
  const event = await fetchStatBroadcastEvent(broadcastId);
  if (!event) return null;
  const params =
    `event=${broadcastId}&xml=${event.xmlfile}&xsl=${xsl}` +
    `&sport=${event.sport}&filetime=-1&type=statbroadcast&start=true`;
  const encoded = Buffer.from(params).toString("base64");
  const res = await fetch(`${SB_WS}stats?data=${encoded}`, {
    headers: HEADERS,
  });
  if (!res.ok) return null;
  return decodeStatBroadcast(await res.text());
}

/**
 * Fetch and parse StatBroadcast box score for all pitchers on both teams.
 * Returns array of { teamLabel, pitcherName, stats }
 */
async function fetchStatBroadcastBoxScore(broadcastId) {
  // Fetch both Home and Visitor box score views in parallel
  const [homeHtml, visHtml] = await Promise.all([
    fetchStatBroadcastView(
      broadcastId,
      'baseball/sb.bsgame.views.box.xsl&params={"team": "H"}',
    ),
    fetchStatBroadcastView(
      broadcastId,
      'baseball/sb.bsgame.views.box.xsl&params={"team": "V"}',
    ),
  ]);

  const results = [];
  if (homeHtml) results.push(...parseBoxScorePitchers(homeHtml, "home"));
  if (visHtml) results.push(...parseBoxScorePitchers(visHtml, "visitor"));
  return results;
}

/**
 * Parse pitcher stats from a StatBroadcast box score HTML view.
 * Table columns: #, Player, Dec, IP, H, R, ER, BB, K, WP, BK, HP, BF,
 *                2B, 3B, HR, XBH, FO, GO, GDP, TP, ST, ERA
 */
function parseBoxScorePitchers(html, teamSide) {
  const results = [];

  // Find the pitching table section: "TEAM Pitching Stats"
  const sectionRe =
    /([A-Za-z &.'-]+?)\s*Pitching Stats[\s\S]{0,2000}?<tbody>([\s\S]*?)<\/tbody>/gi;
  let sectionMatch;

  while ((sectionMatch = sectionRe.exec(html)) !== null) {
    const teamLabel = sectionMatch[1].trim();
    const tbody = sectionMatch[2];

    // Each pitcher row: <tr><td>jersey</td><td>Name,Last</td><td>Dec</td><td>IP</td>...
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tbody)) !== null) {
      const cells = [];
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cm;
      while ((cm = cellRe.exec(rowMatch[1])) !== null) {
        cells.push(cm[1].replace(/<[^>]+>/g, "").trim());
      }
      if (cells.length < 8) continue;

      // Columns: 0=#, 1=Name, 2=Dec, 3=IP, 4=H, 5=R, 6=ER, 7=BB, 8=K,
      //          9=WP, 10=BK, 11=HP, 12=BF, 13=2B, 14=3B, 15=HR, 16=XBH,
      //          17=FO, 18=GO, 19=GDP, 20=TP, 21=ST, 22=ERA
      const [
        ,
        pitcherName,
        ,
        IP,
        H,
        R,
        ER,
        BB,
        K,
        ,
        ,
        ,
        BF,
        ,
        ,
        HR,
        ,
        ,
        ,
        ,
        PC,
      ] = cells;
      if (!pitcherName || !IP || !/^\d/.test(IP)) continue;

      results.push({
        teamLabel,
        teamSide,
        pitcherName: pitcherName.replace(",", ", ").trim(),
        stats: {
          IP: IP || null,
          H: H || null,
          R: R || null,
          ER: ER || null,
          BB: BB || null,
          K: K || null,
          HR: HR || null,
          BF: BF || null,
          PC: PC || null,
          source: "d1baseball",
        },
      });
    }
  }

  return results;
}

/**
 * Assign team IDs to parsed pitchers using teamSide or fallback label matching.
 */
function assignTeamIds(pitchers, game) {
  const homeName = normalize(game.home_name || "");
  const awayName = normalize(game.away_name || "");

  return pitchers.map((p, idx) => {
    let teamId;

    // Primary: use teamSide set during parsing
    if (p.teamSide === "home") {
      teamId = game.home_team_id;
    } else if (p.teamSide === "visitor") {
      teamId = game.away_team_id;
    } else {
      // Fallback: fuzzy label match
      const label = (p.teamLabel || "").toLowerCase();
      const homeTokens = homeName.split(/\s+/).filter((t) => t.length > 2);
      const awayTokens = awayName.split(/\s+/).filter((t) => t.length > 2);
      const homeScore = homeTokens.filter((t) => label.includes(t)).length;
      const awayScore = awayTokens.filter((t) => label.includes(t)).length;
      teamId = homeScore >= awayScore ? game.home_team_id : game.away_team_id;
    }

    const normalizedName = p.pitcherName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const pitcherId = `D1-${game.game_id}-${teamId}-${normalizedName}`;

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

async function findGamesForD1Fallback(daysBack = 14) {
  const { data: trackedTeams } = await supabase
    .from("cbb_teams")
    .select("team_id");
  const trackedIds = new Set(trackedTeams.map((t) => t.team_id));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const { data: games } = await supabase
    .from("cbb_games")
    .select("*")
    .eq("completed", true)
    .gte("date", cutoff.toISOString())
    .order("date", { ascending: false });

  const tracked = (games || []).filter(
    (g) => trackedIds.has(g.home_team_id) || trackedIds.has(g.away_team_id),
  );

  const hasScrapeStatus = tracked.length > 0 && "scrape_status" in tracked[0];

  if (hasScrapeStatus) {
    return tracked.filter(
      (g) =>
        g.scrape_status === "no_data_available" ||
        g.scrape_status === "ncaa_no_data" ||
        g.scrape_status === "ncaa_error" ||
        g.scrape_status === "d1_error" ||
        g.scrape_status === "d1_no_data",
    );
  }

  // Fallback: games with no participation rows
  const gameIds = tracked.map((g) => g.game_id);
  if (gameIds.length === 0) return [];
  const { data: existing } = await supabase
    .from("cbb_pitcher_participation")
    .select("game_id")
    .in("game_id", gameIds);
  const hasData = new Set((existing || []).map((r) => r.game_id));
  return tracked.filter((g) => !hasData.has(g.game_id));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function d1BaseballFallback(options = {}) {
  const {
    daysBack = 14,
    maxGames = null,
    delayMs = 500,
    verbose = true,
  } = options;

  if (verbose) {
    console.log("\n⚾ D1Baseball Fallback Scraper");
    console.log("═".repeat(60));
    console.log(`Looking back: ${daysBack} days`);
    console.log(`Rate limit: ${delayMs}ms between requests\n`);
  }

  const games = await findGamesForD1Fallback(daysBack);
  const toScrape = maxGames ? games.slice(0, maxGames) : games;

  if (verbose) {
    console.log(`Found ${games.length} games without pitcher data`);
    console.log(
      `Will attempt D1Baseball lookup for: ${toScrape.length} games\n`,
    );
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
    const matchup = `${game.away_name || "?"} @ ${game.home_name || "?"}`;

    if (verbose)
      process.stdout.write(`[${i + 1}/${toScrape.length}] ${matchup}... `);

    try {
      const broadcastId = await findD1BroadcastId(game);

      if (!broadcastId) {
        if (verbose) console.log("⚠️  Not found on D1Baseball");
        await updateScrapeStatus(game.game_id, "d1_no_data");
        results.noData++;
        results.games.push({
          game_id: game.game_id,
          matchup,
          status: "not_found",
        });
        await sleep(delayMs);
        continue;
      }

      if (verbose) process.stdout.write(`broadcast ${broadcastId}... `);

      const pitchers = await fetchStatBroadcastBoxScore(broadcastId);
      await sleep(300);

      if (pitchers.length === 0) {
        if (verbose) console.log("⚠️  Box score found but no pitching data");
        await updateScrapeStatus(game.game_id, "d1_no_data");
        results.noData++;
        results.games.push({
          game_id: game.game_id,
          matchup,
          status: "no_pitching_data",
          broadcastId,
        });
        await sleep(delayMs);
        continue;
      }

      const rows = assignTeamIds(pitchers, game);
      const { success } = await savePitchers(rows);
      await updateScrapeStatus(game.game_id, "d1_has_data");

      if (verbose) console.log(`✅ ${pitchers.length} pitchers`);
      results.successful++;
      results.totalPitchers += success;
      results.games.push({
        game_id: game.game_id,
        matchup,
        status: "success",
        broadcastId,
        pitchers: pitchers.length,
      });
    } catch (err) {
      if (verbose) console.log(`❌ ${err.message}`);
      await updateScrapeStatus(game.game_id, "d1_error");
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

  if (verbose) {
    console.log("\n" + "═".repeat(60));
    console.log("📊 D1Baseball Summary:");
    console.log(
      `  ✅ Successful: ${results.successful} games (${results.totalPitchers} pitchers)`,
    );
    console.log(`  ⚠️  No data: ${results.noData} games`);
    console.log(`  ❌ Errors: ${results.errors} games`);
  }

  return results;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const options = { daysBack: 14, maxGames: null, delayMs: 500, verbose: true };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1])
      options.daysBack = parseInt(args[++i]);
    else if (args[i] === "--max" && args[i + 1])
      options.maxGames = parseInt(args[++i]);
    else if (args[i] === "--delay" && args[i + 1])
      options.delayMs = parseInt(args[++i]);
    else if (args[i] === "--quiet" || args[i] === "-q") options.verbose = false;
  }

  const results = await d1BaseballFallback(options);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = `scraper-logs/d1baseball-log-${timestamp}.json`;
  fs.mkdirSync("scraper-logs", { recursive: true });
  fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
  if (options.verbose) console.log(`\n📄 Results saved to: ${logFile}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}
