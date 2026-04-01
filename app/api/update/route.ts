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

/**
 * Scrapes pitcher participation data from ESPN game summary API.
 */
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

/**
 * Checks ESPN for game completion status and updates scores.
 * Returns the number of games newly marked as completed.
 */
async function updateGameCompletionStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  trackedTeamIds: Set<string>,
  daysBack: number,
  delayMs: number,
): Promise<{ checked: number; completed: number; errors: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Find games that are NOT completed but whose date is in the past
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
      trackedTeamIds.has(g.home_team_id) ||
      trackedTeamIds.has(g.away_team_id),
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

/**
 * GET /api/update
 *
 * Called by Vercel Cron every 6 hours:
 *   1. Update game completion status from ESPN (scores, final status)
 *   2. Find completed games from the last 7 days that are missing pitcher data
 *   3. Scrape ESPN box scores for each
 *   4. Upsert to cbb_pitcher_participation
 *   5. Log to cbb_sync_log
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
  const DAYS_BACK = 7;
  const DELAY_MS = 300;

  const results = {
    total: 0,
    successful: 0,
    noData: 0,
    errors: 0,
    totalPitchers: 0,
    completionUpdate: { checked: 0, completed: 0, errors: 0 },
    games: [] as Array<{
      game_id: string;
      matchup: string;
      status: string;
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

    // 2. Update game completion status first (marks finished games as completed)
    results.completionUpdate = await updateGameCompletionStatus(
      supabase,
      trackedTeamIds,
      DAYS_BACK,
      DELAY_MS,
    );

    // 3. Get completed games from last N days (now includes newly completed ones)
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

    // 6. Games that still need scraping
    const gamesToScrape = trackedGames.filter(
      (g: { game_id: string }) => !gamesWithData.has(g.game_id),
    );

    results.total = gamesToScrape.length;
    console.log(
      `[api/update] Found ${gamesToScrape.length} games missing participation data`,
    );

    // 6. Scrape each game
    for (let i = 0; i < gamesToScrape.length; i++) {
      const game = gamesToScrape[i];
      const matchup = `${game.away_name} @ ${game.home_name}`;

      const result = await scrapePitcherData(game.game_id);

      if ("error" in result) {
        // ESPN returned an error
        console.log(`[api/update] Error for ${matchup}: ${result.error}`);
        await supabase
          .from("cbb_games")
          .update({
            last_scrape_attempt: new Date().toISOString(),
            scrape_status: "error",
          })
          .eq("game_id", game.game_id);
        results.errors++;
        results.games.push({
          game_id: game.game_id,
          matchup,
          status: "error",
          message: result.error,
        });
      } else if (result.length === 0) {
        // No pitcher data available yet
        console.log(`[api/update] No data for ${matchup}`);
        await supabase
          .from("cbb_games")
          .update({
            last_scrape_attempt: new Date().toISOString(),
            scrape_status: "no_data_available",
          })
          .eq("game_id", game.game_id);
        results.noData++;
        results.games.push({
          game_id: game.game_id,
          matchup,
          status: "no_data",
        });
      } else {
        // Upsert pitcher participation
        const { error: upsertErr } = await supabase
          .from("cbb_pitcher_participation")
          .upsert(result, {
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
            message: upsertErr.message,
          });
        } else {
          await supabase
            .from("cbb_games")
            .update({
              last_scrape_attempt: new Date().toISOString(),
              scrape_status: "has_data",
            })
            .eq("game_id", game.game_id);
          results.successful++;
          results.totalPitchers += result.length;
          results.games.push({
            game_id: game.game_id,
            matchup,
            status: "success",
            pitchers: result.length,
          });
        }
      }

      // Rate limiting between requests
      if (i < gamesToScrape.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    // 7. Log to cbb_sync_log
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
      `[api/update] Done: ${results.successful} success, ${results.noData} no-data, ${results.errors} errors, ${results.totalPitchers} pitchers`,
    );

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = (error as Error).message || String(error);
    console.error(`[api/update] Fatal error: ${message}`);

    // Log fatal error
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
