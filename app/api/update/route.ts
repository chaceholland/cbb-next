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

// ─── SIDEARM School Site Fallback ────────────────────────────────────────────

const TEAM_SITES: Record<string, { domain: string; sportPath: string }> = {
  "127": { domain: "byucougars.com", sportPath: "/sports/baseball" },
  "198": { domain: "gofrogs.com", sportPath: "/sports/baseball" },
  "90": { domain: "gophersports.com", sportPath: "/sports/baseball" },
  "85": { domain: "lsusports.net", sportPath: "/sports/baseball" },
  "59": { domain: "thesundevils.com", sportPath: "/sports/baseball" },
  "102": { domain: "scarletknights.com", sportPath: "/sports/baseball" },
  "91": { domain: "mutigers.com", sportPath: "/sports/baseball" },
  "93": { domain: "goduke.com", sportPath: "/sports/baseball" },
  "108": { domain: "ohiostatebuckeyes.com", sportPath: "/sports/baseball" },
  "411": { domain: "nusports.com", sportPath: "/sports/baseball" },
  "60": { domain: "arizonawildcats.com", sportPath: "/sports/baseball" },
  "86": { domain: "bceagles.com", sportPath: "/sports/baseball" },
  "168": { domain: "kuathletics.com", sportPath: "/sports/baseball" },
  "132": { domain: "hokiesports.com", sportPath: "/sports/baseball" },
  "131": { domain: "virginiasports.com", sportPath: "/sports/baseball" },
  "294": { domain: "iuhoosiers.com", sportPath: "/sports/baseball" },
  "153": { domain: "fightingillini.com", sportPath: "/sports/baseball" },
  "87": { domain: "umterps.com", sportPath: "/sports/baseball" },
  "120": { domain: "vucommodores.com", sportPath: "/sports/baseball" },
  "136": { domain: "wvusports.com", sportPath: "/sports/baseball" },
  "97": { domain: "godeacs.com", sportPath: "/sports/baseball" },
  "161": { domain: "gobearcats.com", sportPath: "/sports/baseball" },
  "124": { domain: "uhcougars.com", sportPath: "/sports/baseball" },
  "133": { domain: "gohuskies.com", sportPath: "/sports/baseball" },
  "89": { domain: "mgoblue.com", sportPath: "/sports/baseball" },
};

const SIDEARM_WORKER_URL = "https://d1-proxy.chace-holland.workers.dev";

// Cache schedule responses per team within a single cron run
const scheduleCache = new Map<string, SidearmScheduleGame[]>();

interface SidearmScheduleGame {
  date: string;
  opponent: string;
  boxscoreUrl?: string;
  result?: string;
}

interface GameRecord {
  game_id: string;
  home_team_id: string;
  away_team_id: string;
  home_name?: string;
  away_name?: string;
  date: string;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyTeamMatch(espnName: string, sidearmName: string): boolean {
  const a = normalizeName(espnName);
  const b = normalizeName(sidearmName);
  if (!a || !b) return false;

  const aTokens = a.split(" ").filter((t) => t.length > 1);
  const bTokens = b.split(" ").filter((t) => t.length > 1);

  // Check if >50% of shorter name's tokens appear in the longer
  const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens;
  const longer = aTokens.length <= bTokens.length ? bTokens : aTokens;
  const longerStr = longer.join(" ");

  const matches = shorter.filter((t) => longerStr.includes(t)).length;
  return matches > shorter.length * 0.5;
}

function datesMatch(espnDate: string, sidearmDate: string): boolean {
  // Parse ESPN date (ISO format) and SIDEARM date (various formats)
  const espn = new Date(espnDate);
  const espnTime = espn.getTime();
  if (isNaN(espnTime)) return false;

  // Try multiple SIDEARM date formats
  let sidearm: Date;
  // Try ISO first
  sidearm = new Date(sidearmDate);
  if (isNaN(sidearm.getTime())) {
    // Try MM/DD/YYYY
    const parts = sidearmDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (parts) {
      sidearm = new Date(
        parseInt(parts[3]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2]),
      );
    } else {
      return false;
    }
  }

  // Compare within +/- 2 days (timezone differences between ESPN UTC and local game times)
  const diffMs = Math.abs(espnTime - sidearm.getTime());
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  return diffMs <= twoDays;
}

async function fetchSidearmSchedule(
  domain: string,
  sportPath: string,
  season: string,
): Promise<SidearmScheduleGame[]> {
  const cacheKey = `${domain}${sportPath}:${season}`;
  if (scheduleCache.has(cacheKey)) return scheduleCache.get(cacheKey)!;

  const proxySecret = process.env.D1_PROXY_SECRET;
  const res = await fetch(`${SIDEARM_WORKER_URL}/sidearm/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: proxySecret,
      domain,
      sportPath,
      season,
    }),
  });

  if (!res.ok) {
    console.log(
      `[api/update] SIDEARM schedule fetch failed for ${domain}: HTTP ${res.status}`,
    );
    scheduleCache.set(cacheKey, []);
    return [];
  }

  const json = await res.json();
  const games: SidearmScheduleGame[] = json.games || [];
  scheduleCache.set(cacheKey, games);
  return games;
}

interface SidearmPitcher {
  name: string;
  IP: string | null;
  H: string | null;
  R: string | null;
  ER: string | null;
  BB: string | null;
  K: string | null;
  HR: string | null;
  ERA: string | null;
}

interface SidearmBoxscoreResponse {
  home: SidearmPitcher[];
  away: SidearmPitcher[];
  date?: string;
  error?: string;
}

async function fetchSidearmBoxscore(
  url: string,
): Promise<SidearmBoxscoreResponse | null> {
  const proxySecret = process.env.D1_PROXY_SECRET;
  const res = await fetch(`${SIDEARM_WORKER_URL}/sidearm/boxscore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: proxySecret,
      url,
    }),
  });

  if (!res.ok) {
    console.log(
      `[api/update] SIDEARM boxscore fetch failed for ${url}: HTTP ${res.status}`,
    );
    return null;
  }

  return (await res.json()) as SidearmBoxscoreResponse;
}

interface SidearmOutcome {
  records: PitcherRecord[] | null;
  reason: string;
}

async function scrapeSidearm(game: GameRecord): Promise<SidearmOutcome> {
  // Find which team(s) in this game have a SIDEARM config
  const homeConfig = TEAM_SITES[game.home_team_id];
  const awayConfig = TEAM_SITES[game.away_team_id];
  const config = homeConfig || awayConfig;
  const configTeamId = homeConfig ? game.home_team_id : game.away_team_id;

  if (!config) {
    return { records: null, reason: "no TEAM_SITES config" };
  }

  console.log(
    `[api/update] SIDEARM: trying ${config.domain} for ${game.away_name} @ ${game.home_name}`,
  );

  // Fetch schedule for this team. SIDEARM schedule URLs are keyed by
  // season year (e.g. /schedule/2026), so derive season from game.date.
  let schedule: SidearmScheduleGame[];
  const season = String(new Date(game.date).getFullYear());
  try {
    schedule = await fetchSidearmSchedule(
      config.domain,
      config.sportPath,
      season,
    );
  } catch (err) {
    const msg = (err as Error).message;
    console.log(
      `[api/update] SIDEARM schedule error for ${config.domain}: ${msg}`,
    );
    return { records: null, reason: `schedule error: ${msg}` };
  }

  if (schedule.length === 0) {
    console.log(`[api/update] SIDEARM: empty schedule for ${config.domain}`);
    return {
      records: null,
      reason: `empty schedule for ${config.domain}`,
    };
  }

  // Match the game: find a schedule entry matching the opponent and date.
  const opponentName =
    configTeamId === game.home_team_id
      ? game.away_name || ""
      : game.home_name || "";

  // Phase A — strict match on schedule entries that already have dates.
  let matchedGame: SidearmScheduleGame | null = null;
  for (const sg of schedule) {
    if (
      sg.date &&
      datesMatch(game.date, sg.date) &&
      fuzzyTeamMatch(opponentName, sg.opponent)
    ) {
      matchedGame = sg;
      break;
    }
  }

  // Fetch the boxscore. For Phase B we may need its date to disambiguate,
  // so defer this until after we know which schedule entry to use.
  let boxscore: SidearmBoxscoreResponse | null = null;

  // Phase B — if strict match failed, fall back to opponent-only candidates
  // (schedule entries with the right opponent but no date in the schedule
  // DOM). Fetch each candidate's boxscore and use the date the worker
  // parsed from the boxscore page to disambiguate.
  if (!matchedGame) {
    const candidates = schedule.filter(
      (sg) =>
        !!sg.boxscoreUrl &&
        !sg.date && // dateless entries — the archive/stats-URL links
        fuzzyTeamMatch(opponentName, sg.opponent),
    );

    if (candidates.length === 0) {
      console.log(
        `[api/update] SIDEARM: no matching game for ${opponentName} on ${game.date} in ${config.domain} schedule (${schedule.length} games)`,
      );
      return {
        records: null,
        reason: `no match for "${opponentName}" in ${schedule.length}-game ${config.domain} schedule`,
      };
    }

    for (const candidate of candidates) {
      let box: SidearmBoxscoreResponse | null;
      try {
        box = await fetchSidearmBoxscore(candidate.boxscoreUrl!);
      } catch {
        continue;
      }
      if (!box || !box.date) continue;
      if (datesMatch(game.date, box.date)) {
        matchedGame = candidate;
        boxscore = box;
        break;
      }
    }

    if (!matchedGame) {
      console.log(
        `[api/update] SIDEARM: ${candidates.length} opponent-matching candidate(s) for ${opponentName}, none had a boxscore date matching ${game.date}`,
      );
      return {
        records: null,
        reason: `${candidates.length} opponent-only candidates for ${opponentName}, none matched date ${game.date}`,
      };
    }
  }

  if (!matchedGame.boxscoreUrl) {
    console.log(
      `[api/update] SIDEARM: matched schedule entry has no boxscoreUrl`,
    );
    return {
      records: null,
      reason: "matched schedule entry has no boxscoreUrl",
    };
  }

  console.log(
    `[api/update] SIDEARM: matched game, fetching boxscore from ${matchedGame.boxscoreUrl}`,
  );

  // Fetch boxscore if Phase B didn't already do it.
  if (!boxscore) {
    try {
      boxscore = await fetchSidearmBoxscore(matchedGame.boxscoreUrl);
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`[api/update] SIDEARM boxscore error: ${msg}`);
      return { records: null, reason: `boxscore error: ${msg}` };
    }
  }

  if (!boxscore || (boxscore.home.length === 0 && boxscore.away.length === 0)) {
    console.log(
      `[api/update] SIDEARM: no pitchers in boxscore for ${matchedGame.boxscoreUrl}`,
    );
    return {
      records: null,
      reason: `no pitchers in boxscore ${matchedGame.boxscoreUrl}`,
    };
  }

  // Map to PitcherRecord[] — worker returns { home: [...], away: [...] }
  const records: PitcherRecord[] = [];

  const mapPitchers = (pitchers: SidearmPitcher[], teamId: string) => {
    for (const p of pitchers) {
      const normalizedPitcherName = p.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      records.push({
        game_id: game.game_id,
        team_id: teamId,
        pitcher_id: `SIDEARM-${game.game_id}-${teamId}-${normalizedPitcherName}`,
        pitcher_name: p.name,
        stats: {
          IP: p.IP,
          H: p.H,
          R: p.R,
          ER: p.ER,
          BB: p.BB,
          K: p.K,
          HR: p.HR,
          ERA: p.ERA,
          source: "sidearm",
        },
      });
    }
  };

  // Worker convention: away pitchers first, home pitchers second
  // But if we scraped the home team's site, home = home_team, away = away_team
  const isHomeSite = !!homeConfig;
  if (isHomeSite) {
    mapPitchers(boxscore.away, game.away_team_id);
    mapPitchers(boxscore.home, game.home_team_id);
  } else {
    // Scraped away team's site — their perspective: home = their team, away = opponent
    mapPitchers(boxscore.home, game.away_team_id);
    mapPitchers(boxscore.away, game.home_team_id);
  }

  console.log(
    `[api/update] SIDEARM: found ${records.length} pitchers for ${game.away_name} @ ${game.home_name}`,
  );

  if (records.length === 0) {
    return { records: null, reason: "boxscore yielded 0 records post-mapping" };
  }
  return { records, reason: `ok (${records.length} pitchers)` };
}

// ─── Game Completion Status ──────────────────────────────────────────────────

async function updateGameCompletionStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  trackedTeamIds: Set<string>,
  delayMs: number,
): Promise<{ checked: number; completed: number; errors: number }> {
  const { data: incompleteGames, error: incErr } = await supabase
    .from("cbb_games")
    .select("*")
    .eq("completed", false)
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
 *   5. If ESPN has no data, try SIDEARM school site fallback (25 Power 5 teams)
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
  const MAX_SCRAPE_ATTEMPTS = 5;
  const DELAY_MS = 300;

  const results = {
    total: 0,
    successful: 0,
    noData: 0,
    errors: 0,
    sidearmFallback: 0,
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
      DELAY_MS,
    );

    // 3. Get all completed games (no date cutoff — backfill entire season)
    const { data: games, error: gamesErr } = await supabase
      .from("cbb_games")
      .select("*")
      .eq("completed", true)
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

    // 7. Scrape each game: ESPN first, then SIDEARM school site fallback
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
        // ESPN has no data — try SIDEARM school site fallback
        console.log(
          `[api/update] ESPN no data for ${matchup}, trying SIDEARM...`,
        );

        let sidearmResult: PitcherRecord[] | null = null;
        let sidearmDebug = "";
        try {
          const outcome = await scrapeSidearm(game as GameRecord);
          sidearmResult = outcome.records;
          sidearmDebug = outcome.reason;
        } catch (err) {
          sidearmDebug = `error: ${(err as Error).message}`;
          console.log(
            `[api/update] SIDEARM error for ${matchup}: ${(err as Error).message}`,
          );
        }

        if (sidearmResult && sidearmResult.length > 0) {
          // SIDEARM returned data
          const { error: upsertErr } = await supabase
            .from("cbb_pitcher_participation")
            .upsert(sidearmResult, {
              onConflict: "game_id,pitcher_id",
              ignoreDuplicates: false,
            });

          if (upsertErr) {
            console.error(
              `[api/update] SIDEARM upsert error for ${matchup}: ${upsertErr.message}`,
            );
            results.errors++;
            results.games.push({
              game_id: game.game_id,
              matchup,
              status: "error",
              source: "sidearm",
              message: upsertErr.message,
            });
          } else {
            await supabase
              .from("cbb_games")
              .update({
                last_scrape_attempt: new Date().toISOString(),
                scrape_status: "sidearm_has_data",
                scrape_attempts: currentAttempts,
              })
              .eq("game_id", game.game_id);
            results.successful++;
            results.sidearmFallback++;
            results.totalPitchers += sidearmResult.length;
            results.games.push({
              game_id: game.game_id,
              matchup,
              status: "success",
              source: "sidearm",
              pitchers: sidearmResult.length,
            });
            console.log(
              `[api/update] SIDEARM success for ${matchup}: ${sidearmResult.length} pitchers`,
            );
          }
        } else {
          // Neither ESPN nor SIDEARM had data
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
            message: sidearmDebug,
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
      `[api/update] Done: ${results.successful} success (${results.sidearmFallback} via SIDEARM), ${results.noData} no-data, ${results.errors} errors, ${results.skippedMaxAttempts} skipped, ${results.totalPitchers} pitchers`,
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
