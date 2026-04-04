import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";

// Use service role key for writes; fall back to anon key for reads-only scenarios
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

interface PitcherRecord {
  game_id: string;
  team_id: string;
  pitcher_id: string | null;
  pitcher_name: string;
  stats: Record<string, string | null>;
}

// ─── ESPN Scraper ────────────────────────────────────────────────────────────

async function scrapePitcherData(
  gameId: string,
): Promise<PitcherRecord[] | { error: string }> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const pitchers: PitcherRecord[] = [];

    if (data.boxscore?.players) {
      for (const team of data.boxscore.players) {
        const teamId = team.team.id;

        for (const statGroup of team.statistics || []) {
          if (statGroup.type === "pitching") {
            const labels: string[] = statGroup.labels || [];
            const keys: string[] = statGroup.keys || [];

            for (const athlete of statGroup.athletes || []) {
              const stats: Record<string, string> = {};
              athlete.stats?.forEach((value: string, idx: number) => {
                const label = labels[idx] || keys[idx];
                stats[label] = value;
              });

              const ip = stats["IP"] || stats["fullInnings.partInnings"];

              pitchers.push({
                game_id: gameId,
                team_id: teamId,
                pitcher_id: athlete.athlete?.id || null,
                pitcher_name: athlete.athlete?.displayName || "Unknown",
                stats: {
                  IP: ip || null,
                  H: stats["H"] || stats["hits"] || null,
                  R: stats["R"] || stats["runs"] || null,
                  ER: stats["ER"] || stats["earnedRuns"] || null,
                  BB: stats["BB"] || stats["walks"] || null,
                  K: stats["K"] || stats["SO"] || stats["strikeouts"] || null,
                  HR: stats["HR"] || stats["homeRuns"] || null,
                  PC: stats["PC"] || stats["pitches"] || null,
                  ERA: stats["ERA"] || null,
                  source: "espn",
                },
              });
            }
          }
        }
      }
    }

    return pitchers;
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// ─── D1Baseball / StatBroadcast Fallback ─────────────────────────────────────

const TEAM_NAME_OVERRIDES: Record<string, string> = {
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

const D1_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function normalizeTeamName(name: string): string {
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

function toD1Date(dateStr: string): string {
  const d = new Date(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

interface D1Game {
  broadcastId: string;
  homeEspnId?: string;
  awayEspnId?: string;
  homeName?: string;
  awayName?: string;
}

// Cache scoreboard responses per date within a single cron run
const scoreboardCache = new Map<string, D1Game[]>();

async function fetchD1Scoreboard(dateStr: string): Promise<D1Game[]> {
  const d1Date = toD1Date(dateStr);
  if (scoreboardCache.has(d1Date)) return scoreboardCache.get(d1Date)!;

  const url = `https://d1baseball.com/wp-content/plugins/integritive/dynamic-scores.php?v=${Date.now()}&date=${d1Date}`;
  const res = await fetch(url, {
    headers: {
      ...D1_HEADERS,
      Referer: `https://d1baseball.com/scores/?date=${d1Date}`,
    },
  });
  if (!res.ok) throw new Error(`D1Baseball API HTTP ${res.status}`);

  const json = await res.json();
  const dump = (json?.content?.["d1-scores"] || "") as string;

  const games: D1Game[] = [];
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

  scoreboardCache.set(d1Date, games);
  return games;
}

interface GameRecord {
  game_id: string;
  home_team_id: string;
  away_team_id: string;
  home_name?: string;
  away_name?: string;
  date: string;
}

async function findD1BroadcastId(game: GameRecord): Promise<string | null> {
  let d1Games: D1Game[];
  try {
    d1Games = await fetchD1Scoreboard(game.date);
  } catch {
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
  const homeName = normalizeTeamName(game.home_name || "");
  const awayName = normalizeTeamName(game.away_name || "");
  const homeTokens = homeName.split(/\s+/).filter((t) => t.length > 3);
  const awayTokens = awayName.split(/\s+/).filter((t) => t.length > 3);

  let bestScore = 0;
  let bestBroadcastId: string | null = null;
  for (const g of d1Games) {
    const h = normalizeTeamName(g.homeName || "");
    const a = normalizeTeamName(g.awayName || "");
    const hay = h + " " + a;
    const homeHits = homeTokens.filter((t) => hay.includes(t)).length;
    const awayHits = awayTokens.filter((t) => hay.includes(t)).length;
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

// ROT13 + base64 decode — matches StatBroadcast's client-side tatdsy()+atou()
function decodeStatBroadcast(encoded: string): string {
  const a = "a".charCodeAt(0),
    z = a + 26;
  const A = "A".charCodeAt(0),
    Z = A + 26;
  const rot = (c: number, base: number) =>
    String.fromCharCode(base + ((c - base + 13) % 26));
  const b: string[] = [];
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

const eventCache = new Map<string, { xmlfile: string; sport: string }>();

async function fetchStatBroadcastEvent(
  broadcastId: string,
): Promise<{ xmlfile: string; sport: string } | null> {
  if (eventCache.has(broadcastId)) return eventCache.get(broadcastId)!;
  const data = Buffer.from("type=statbroadcast").toString("base64");
  const res = await fetch(`${SB_WS}event/${broadcastId}?data=${data}`, {
    headers: D1_HEADERS,
  });
  if (!res.ok) return null;
  const xml = decodeStatBroadcast(await res.text());
  const xmlfile =
    xml.match(/<xmlfile><!\[CDATA\[([^\]]+)\]\]>/)?.[1] ||
    `text/${broadcastId}.xml`;
  const sport = xml.match(/<sport>([^<]+)<\/sport>/)?.[1] || "bsgame";
  const result = { xmlfile, sport };
  eventCache.set(broadcastId, result);
  return result;
}

async function fetchStatBroadcastView(
  broadcastId: string,
  xsl: string,
): Promise<string | null> {
  const event = await fetchStatBroadcastEvent(broadcastId);
  if (!event) return null;
  const params =
    `event=${broadcastId}&xml=${event.xmlfile}&xsl=${xsl}` +
    `&sport=${event.sport}&filetime=-1&type=statbroadcast&start=true`;
  const encoded = Buffer.from(params).toString("base64");
  const res = await fetch(`${SB_WS}stats?data=${encoded}`, {
    headers: D1_HEADERS,
  });
  if (!res.ok) return null;
  return decodeStatBroadcast(await res.text());
}

interface ParsedPitcher {
  teamLabel: string;
  teamSide: string;
  pitcherName: string;
  stats: Record<string, string | null>;
}

function parseBoxScorePitchers(
  html: string,
  teamSide: string,
): ParsedPitcher[] {
  const results: ParsedPitcher[] = [];
  const sectionRe =
    /([A-Za-z &.'-]+?)\s*Pitching Stats[\s\S]{0,2000}?<tbody>([\s\S]*?)<\/tbody>/gi;
  let sectionMatch;

  while ((sectionMatch = sectionRe.exec(html)) !== null) {
    const teamLabel = sectionMatch[1].trim();
    const tbody = sectionMatch[2];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tbody)) !== null) {
      const cells: string[] = [];
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cm;
      while ((cm = cellRe.exec(rowMatch[1])) !== null) {
        cells.push(cm[1].replace(/<[^>]+>/g, "").trim());
      }
      if (cells.length < 8) continue;

      // Columns: 0=#, 1=Name, 2=Dec, 3=IP, 4=H, 5=R, 6=ER, 7=BB, 8=K,
      //          9=WP, 10=BK, 11=HP, 12=BF, 13=2B, 14=3B, 15=HR
      const pitcherName = cells[1];
      const IP = cells[3];
      const H = cells[4];
      const R = cells[5];
      const ER = cells[6];
      const BB = cells[7];
      const K = cells[8];
      const BF = cells[12];
      const HR = cells[15];
      const PC = cells[20];

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

async function scrapeD1Baseball(
  game: GameRecord,
): Promise<PitcherRecord[] | null> {
  const broadcastId = await findD1BroadcastId(game);
  if (!broadcastId) return null;

  // Fetch both home and visitor box scores in parallel
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

  const parsed: ParsedPitcher[] = [];
  if (homeHtml) parsed.push(...parseBoxScorePitchers(homeHtml, "home"));
  if (visHtml) parsed.push(...parseBoxScorePitchers(visHtml, "visitor"));

  if (parsed.length === 0) return null;

  // Assign team IDs
  return parsed.map((p) => {
    let teamId: string;
    if (p.teamSide === "home") {
      teamId = game.home_team_id;
    } else if (p.teamSide === "visitor") {
      teamId = game.away_team_id;
    } else {
      const label = (p.teamLabel || "").toLowerCase();
      const homeName = normalizeTeamName(game.home_name || "");
      const awayName = normalizeTeamName(game.away_name || "");
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

// ─── Game Completion Status ──────────────────────────────────────────────────

async function updateGameCompletionStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  trackedTeamIds: Set<string>,
  daysBack: number,
  delayMs: number,
): Promise<{ checked: number; completed: number; errors: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const { data: incompleteGames, error: incErr } = await supabase
    .from("cbb_games")
    .select("*")
    .eq("completed", false)
    .gte("date", cutoffDate.toISOString())
    .lte("date", new Date().toISOString())
    .order("date", { ascending: false });

  if (incErr) {
    console.error(
      `[api/update] Failed to fetch incomplete games: ${incErr.message}`,
    );
    return { checked: 0, completed: 0, errors: 0 };
  }

  const trackedIncomplete = (incompleteGames || []).filter(
    (g: { home_team_id: string; away_team_id: string }) =>
      trackedTeamIds.has(g.home_team_id) || trackedTeamIds.has(g.away_team_id),
  );

  if (trackedIncomplete.length === 0) {
    return { checked: 0, completed: 0, errors: 0 };
  }

  console.log(
    `[api/update] Checking ${trackedIncomplete.length} incomplete past games for completion status`,
  );

  let completed = 0;
  let errors = 0;

  for (let i = 0; i < trackedIncomplete.length; i++) {
    const game = trackedIncomplete[i];
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${game.game_id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const comp = data?.header?.competitions?.[0];
      const isComplete = comp?.status?.type?.completed === true;

      if (isComplete) {
        const homeScore = comp?.competitors?.find(
          (t: { homeAway: string }) => t.homeAway === "home",
        )?.score;
        const awayScore = comp?.competitors?.find(
          (t: { homeAway: string }) => t.homeAway === "away",
        )?.score;
        const homeName = comp?.competitors?.find(
          (t: { homeAway: string }) => t.homeAway === "home",
        )?.team?.displayName;
        const awayName = comp?.competitors?.find(
          (t: { homeAway: string }) => t.homeAway === "away",
        )?.team?.displayName;
        const venue = comp?.venue?.fullName;

        await supabase
          .from("cbb_games")
          .update({
            completed: true,
            status: "final",
            home_score: homeScore,
            away_score: awayScore,
            ...(homeName && { home_name: homeName }),
            ...(awayName && { away_name: awayName }),
            ...(venue && { venue }),
          })
          .eq("game_id", game.game_id);

        completed++;
        console.log(
          `[api/update] Marked complete: ${awayName || game.away_name} @ ${homeName || game.home_name} (${awayScore}-${homeScore})`,
        );
      }
    } catch (err) {
      errors++;
      console.error(
        `[api/update] Error checking game ${game.game_id}: ${(err as Error).message}`,
      );
    }

    if (i < trackedIncomplete.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(
    `[api/update] Completion check done: ${completed} newly completed, ${errors} errors out of ${trackedIncomplete.length} checked`,
  );

  return { checked: trackedIncomplete.length, completed, errors };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

/**
 * GET /api/update
 *
 * Called by Vercel Cron 3x daily (6 AM, 2 PM, 10 PM UTC):
 *   1. Update game completion status from ESPN (scores, final status)
 *   2. Find completed games from the last 14 days missing pitcher data
 *   3. Skip games with 5+ failed scrape attempts (no_data_available)
 *   4. Scrape ESPN box scores for each
 *   5. If ESPN has no data, try D1Baseball/StatBroadcast fallback
 *   6. Upsert to cbb_pitcher_participation
 *   7. Log to cbb_sync_log
 */
export async function GET(request: Request) {
  // Verify cron secret in production (Vercel sends this header)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const DAYS_BACK = 14;
  const MAX_SCRAPE_ATTEMPTS = 5;
  const DELAY_MS = 300;

  const results = {
    total: 0,
    successful: 0,
    noData: 0,
    errors: 0,
    d1Fallback: 0,
    skippedMaxAttempts: 0,
    totalPitchers: 0,
    completionUpdate: { checked: 0, completed: 0, errors: 0 },
    games: [] as Array<{
      game_id: string;
      matchup: string;
      status: string;
      source?: string;
      pitchers?: number;
      message?: string;
    }>,
  };

  try {
    // 1. Get tracked team IDs
    const { data: trackedTeams, error: teamsErr } = await supabase
      .from("cbb_teams")
      .select("team_id");

    if (teamsErr) throw new Error(`Failed to fetch teams: ${teamsErr.message}`);
    const trackedTeamIds = new Set(
      (trackedTeams || []).map((t: { team_id: string }) => t.team_id),
    );

    // 2. Update game completion status first
    results.completionUpdate = await updateGameCompletionStatus(
      supabase,
      trackedTeamIds,
      DAYS_BACK,
      DELAY_MS,
    );

    // 3. Get completed games from last N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_BACK);

    const { data: games, error: gamesErr } = await supabase
      .from("cbb_games")
      .select("*")
      .eq("completed", true)
      .gte("date", cutoffDate.toISOString())
      .order("date", { ascending: false });

    if (gamesErr) throw new Error(`Failed to fetch games: ${gamesErr.message}`);

    // 4. Filter to games involving tracked teams
    const trackedGames = (games || []).filter(
      (g: { home_team_id: string; away_team_id: string }) =>
        trackedTeamIds.has(g.home_team_id) ||
        trackedTeamIds.has(g.away_team_id),
    );

    // 5. Find which games already have participation data
    const gameIds = trackedGames.map((g: { game_id: string }) => g.game_id);

    if (gameIds.length === 0) {
      await supabase.from("cbb_sync_log").insert({
        sync_type: "participation_scrape",
        source: "vercel-cron",
        records_count: 0,
        status: "success",
        error_message: null,
      });
      return NextResponse.json({
        ok: true,
        message: "No completed games to process",
        results,
      });
    }

    const { data: existingParticipation } = await supabase
      .from("cbb_pitcher_participation")
      .select("game_id")
      .in("game_id", gameIds);

    const gamesWithData = new Set(
      (existingParticipation || []).map((p: { game_id: string }) => p.game_id),
    );

    // 6. Games that still need scraping (skip those with too many failed attempts)
    const gamesToScrape = trackedGames.filter(
      (g: {
        game_id: string;
        scrape_attempts?: number;
        scrape_status?: string;
      }) => {
        if (gamesWithData.has(g.game_id)) return false;
        // Skip games that have been tried too many times with no data
        const attempts = g.scrape_attempts || 0;
        if (
          attempts >= MAX_SCRAPE_ATTEMPTS &&
          g.scrape_status === "no_data_available"
        ) {
          return false;
        }
        return true;
      },
    );

    // Count skipped games
    const skipped = trackedGames.filter(
      (g: {
        game_id: string;
        scrape_attempts?: number;
        scrape_status?: string;
      }) =>
        !gamesWithData.has(g.game_id) &&
        (g.scrape_attempts || 0) >= MAX_SCRAPE_ATTEMPTS &&
        g.scrape_status === "no_data_available",
    );
    results.skippedMaxAttempts = skipped.length;

    results.total = gamesToScrape.length;
    console.log(
      `[api/update] Found ${gamesToScrape.length} games to scrape (${results.skippedMaxAttempts} skipped, ${MAX_SCRAPE_ATTEMPTS}+ attempts)`,
    );

    // 7. Scrape each game: ESPN first, then D1Baseball fallback
    for (let i = 0; i < gamesToScrape.length; i++) {
      const game = gamesToScrape[i];
      const matchup = `${game.away_name} @ ${game.home_name}`;
      const currentAttempts = (game.scrape_attempts || 0) + 1;

      const espnResult = await scrapePitcherData(game.game_id);

      if ("error" in espnResult) {
        // ESPN returned an error
        console.log(
          `[api/update] ESPN error for ${matchup}: ${espnResult.error}`,
        );
        await supabase
          .from("cbb_games")
          .update({
            last_scrape_attempt: new Date().toISOString(),
            scrape_status: "error",
            scrape_attempts: currentAttempts,
          })
          .eq("game_id", game.game_id);
        results.errors++;
        results.games.push({
          game_id: game.game_id,
          matchup,
          status: "error",
          source: "espn",
          message: espnResult.error,
        });
      } else if (espnResult.length === 0) {
        // ESPN has no data — try D1Baseball fallback
        console.log(
          `[api/update] ESPN no data for ${matchup}, trying D1Baseball...`,
        );

        let d1Result: PitcherRecord[] | null = null;
        try {
          d1Result = await scrapeD1Baseball(game as GameRecord);
        } catch (err) {
          console.log(
            `[api/update] D1Baseball error for ${matchup}: ${(err as Error).message}`,
          );
        }

        if (d1Result && d1Result.length > 0) {
          // D1Baseball returned data
          const { error: upsertErr } = await supabase
            .from("cbb_pitcher_participation")
            .upsert(d1Result, {
              onConflict: "game_id,pitcher_id",
              ignoreDuplicates: false,
            });

          if (upsertErr) {
            console.error(
              `[api/update] D1 upsert error for ${matchup}: ${upsertErr.message}`,
            );
            results.errors++;
            results.games.push({
              game_id: game.game_id,
              matchup,
              status: "error",
              source: "d1baseball",
              message: upsertErr.message,
            });
          } else {
            await supabase
              .from("cbb_games")
              .update({
                last_scrape_attempt: new Date().toISOString(),
                scrape_status: "d1_has_data",
                scrape_attempts: currentAttempts,
              })
              .eq("game_id", game.game_id);
            results.successful++;
            results.d1Fallback++;
            results.totalPitchers += d1Result.length;
            results.games.push({
              game_id: game.game_id,
              matchup,
              status: "success",
              source: "d1baseball",
              pitchers: d1Result.length,
            });
            console.log(
              `[api/update] D1Baseball success for ${matchup}: ${d1Result.length} pitchers`,
            );
          }
        } else {
          // Neither ESPN nor D1Baseball had data
          await supabase
            .from("cbb_games")
            .update({
              last_scrape_attempt: new Date().toISOString(),
              scrape_status: "no_data_available",
              scrape_attempts: currentAttempts,
            })
            .eq("game_id", game.game_id);
          results.noData++;
          results.games.push({
            game_id: game.game_id,
            matchup,
            status: "no_data",
          });
        }
      } else {
        // ESPN returned data — upsert
        const { error: upsertErr } = await supabase
          .from("cbb_pitcher_participation")
          .upsert(espnResult, {
            onConflict: "game_id,pitcher_id",
            ignoreDuplicates: false,
          });

        if (upsertErr) {
          console.error(
            `[api/update] Upsert error for ${matchup}: ${upsertErr.message}`,
          );
          results.errors++;
          results.games.push({
            game_id: game.game_id,
            matchup,
            status: "error",
            source: "espn",
            message: upsertErr.message,
          });
        } else {
          await supabase
            .from("cbb_games")
            .update({
              last_scrape_attempt: new Date().toISOString(),
              scrape_status: "has_data",
              scrape_attempts: currentAttempts,
            })
            .eq("game_id", game.game_id);
          results.successful++;
          results.totalPitchers += espnResult.length;
          results.games.push({
            game_id: game.game_id,
            matchup,
            status: "success",
            source: "espn",
            pitchers: espnResult.length,
          });
        }
      }

      // Rate limiting between requests
      if (i < gamesToScrape.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    // 8. Log to cbb_sync_log
    const hasErrors = results.errors > 0;
    await supabase.from("cbb_sync_log").insert({
      sync_type: "participation_scrape",
      source: "vercel-cron",
      records_count: results.totalPitchers,
      status: hasErrors ? "error" : "success",
      error_message: hasErrors
        ? `${results.errors} game(s) failed out of ${results.total}`
        : null,
    });

    console.log(
      `[api/update] Done: ${results.successful} success (${results.d1Fallback} via D1), ${results.noData} no-data, ${results.errors} errors, ${results.skippedMaxAttempts} skipped, ${results.totalPitchers} pitchers`,
    );

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = (error as Error).message || String(error);
    console.error(`[api/update] Fatal error: ${message}`);

    try {
      await supabase.from("cbb_sync_log").insert({
        sync_type: "participation_scrape",
        source: "vercel-cron",
        records_count: 0,
        status: "error",
        error_message: message,
      });
    } catch {
      // ignore logging failures on fatal error
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
