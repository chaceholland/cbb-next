#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Scrapes pitcher participation data from ESPN's game summary API
 */
async function scrapePitcherData(gameId) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const pitchers = [];

    // Extract pitcher data from box score
    if (data.boxscore?.players) {
      for (const team of data.boxscore.players) {
        const teamId = team.team.id;
        const teamName = team.team.displayName;

        // Look for pitching statistics
        for (const statGroup of team.statistics || []) {
          if (statGroup.type === 'pitching') {
            const labels = statGroup.labels || [];
            const keys = statGroup.keys || [];

            for (const athlete of statGroup.athletes || []) {
              const stats = {};

              // Map stats using labels
              athlete.stats?.forEach((value, idx) => {
                const label = labels[idx] || keys[idx];
                stats[label] = value;
              });

              // Parse IP (might be in format like "5.1" or "5 1/3")
              let ip = stats['IP'] || stats['fullInnings.partInnings'];

              pitchers.push({
                game_id: gameId,
                team_id: teamId,
                pitcher_id: athlete.athlete?.id || null,
                pitcher_name: athlete.athlete?.displayName || 'Unknown',
                stats: {
                  IP: ip || null,
                  H: stats['H'] || stats['hits'] || null,
                  R: stats['R'] || stats['runs'] || null,
                  ER: stats['ER'] || stats['earnedRuns'] || null,
                  BB: stats['BB'] || stats['walks'] || null,
                  K: stats['K'] || stats['SO'] || stats['strikeouts'] || null,
                  HR: stats['HR'] || stats['homeRuns'] || null,
                  PC: stats['PC'] || stats['pitches'] || null,
                  ERA: stats['ERA'] || null,
                }
              });
            }
          }
        }
      }
    }

    return pitchers;
  } catch (error) {
    return { error: error.message, pitchers: [] };
  }
}

/**
 * Saves pitcher participation data to database
 */
async function savePitcherData(pitchers) {
  if (pitchers.length === 0) return { success: 0, errors: 0 };

  const { data, error } = await supabase
    .from('cbb_pitcher_participation')
    .upsert(pitchers, {
      onConflict: 'game_id,pitcher_id,pitcher_name',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Database error:', error.message);
    return { success: 0, errors: pitchers.length };
  }

  return { success: pitchers.length, errors: 0 };
}

/**
 * Updates scrape tracking status for a game
 */
async function updateScrapeStatus(gameId, status, incrementAttempts = true) {
  const updates = {
    last_scrape_attempt: new Date().toISOString(),
    scrape_status: status,
  };

  if (incrementAttempts) {
    // Increment attempts counter
    const { data: game } = await supabase
      .from('cbb_games')
      .select('scrape_attempts')
      .eq('game_id', gameId)
      .single();

    updates.scrape_attempts = (game?.scrape_attempts || 0) + 1;
  }

  await supabase
    .from('cbb_games')
    .update(updates)
    .eq('game_id', gameId);
}

/**
 * Finds games that are completed but missing pitcher participation data
 */
async function findGamesMissingParticipation(daysBack = 7) {
  // Get tracked teams
  const { data: trackedTeams } = await supabase
    .from('cbb_teams')
    .select('team_id');

  const trackedTeamIds = new Set(trackedTeams.map(t => t.team_id));

  // Get completed games from last N days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const { data: games } = await supabase
    .from('cbb_games')
    .select('*')
    .eq('completed', true)
    .gte('date', cutoffDate.toISOString())
    .order('date', { ascending: false });

  // Filter to games involving tracked teams
  const trackedGames = games.filter(g =>
    trackedTeamIds.has(g.home_team_id) || trackedTeamIds.has(g.away_team_id)
  );

  // Get all participation data in one query
  const gameIds = trackedGames.map(g => g.game_id);
  const { data: allParticipation } = await supabase
    .from('cbb_pitcher_participation')
    .select('game_id')
    .in('game_id', gameIds);

  // Create set of game IDs that have participation data
  const gamesWithData = new Set(allParticipation?.map(p => p.game_id) || []);

  // Return games without participation data
  const gamesWithoutParticipation = trackedGames.filter(g => !gamesWithData.has(g.game_id));

  return gamesWithoutParticipation;
}

/**
 * Main auto-scraper function
 */
async function autoScrape(options = {}) {
  const {
    daysBack = 7,
    maxGames = null,
    delayMs = 300,
    verbose = true,
  } = options;

  if (verbose) {
    console.log('🔄 ESPN Auto-Scraper for Pitcher Participation Data');
    console.log('═'.repeat(60));
    console.log(`Looking back: ${daysBack} days`);
    console.log(`Rate limit delay: ${delayMs}ms between requests\n`);
  }

  // Find games missing data
  if (verbose) console.log('🔍 Finding games missing participation data...');
  const missingGames = await findGamesMissingParticipation(daysBack);

  const gamesToScrape = maxGames ? missingGames.slice(0, maxGames) : missingGames;

  if (verbose) {
    console.log(`Found ${missingGames.length} games missing data`);
    console.log(`Will attempt to scrape: ${gamesToScrape.length} games\n`);
  }

  // Track results
  const results = {
    total: gamesToScrape.length,
    successful: 0,
    noData: 0,
    errors: 0,
    totalPitchers: 0,
    games: []
  };

  // Scrape each game
  for (let i = 0; i < gamesToScrape.length; i++) {
    const game = gamesToScrape[i];
    const progress = `[${i + 1}/${gamesToScrape.length}]`;

    if (verbose) {
      process.stdout.write(`${progress} ${game.away_name} @ ${game.home_name}... `);
    }

    const result = await scrapePitcherData(game.game_id);

    if (result.error) {
      if (verbose) console.log(`❌ Error: ${result.error}`);
      await updateScrapeStatus(game.game_id, 'error');
      results.errors++;
      results.games.push({
        game_id: game.game_id,
        matchup: `${game.away_name} @ ${game.home_name}`,
        status: 'error',
        message: result.error
      });
    } else if (result.length === 0) {
      if (verbose) console.log(`⚠️  No data available yet (checked at ${new Date().toLocaleString()})`);
      await updateScrapeStatus(game.game_id, 'no_data_available');
      results.noData++;
      results.games.push({
        game_id: game.game_id,
        matchup: `${game.away_name} @ ${game.home_name}`,
        status: 'no_data',
        lastChecked: new Date().toISOString()
      });
    } else {
      const { success } = await savePitcherData(result);
      await updateScrapeStatus(game.game_id, 'has_data');
      if (verbose) console.log(`✅ Found ${result.length} pitchers`);
      results.successful++;
      results.totalPitchers += success;
      results.games.push({
        game_id: game.game_id,
        matchup: `${game.away_name} @ ${game.home_name}`,
        status: 'success',
        pitchers: result.length
      });
    }

    // Rate limiting
    if (i < gamesToScrape.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Summary
  if (verbose) {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Summary:');
    console.log(`  ✅ Successful: ${results.successful} games (${results.totalPitchers} pitchers)`);
    console.log(`  ⚠️  No data yet: ${results.noData} games`);
    console.log(`  ❌ Errors: ${results.errors} games`);
    console.log(`  📝 Still missing: ${results.noData + results.errors} games`);
  }

  return results;
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);

  const options = {
    daysBack: 7,
    maxGames: null,
    delayMs: 300,
    verbose: true,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      options.daysBack = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--max' && args[i + 1]) {
      options.maxGames = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      options.delayMs = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--quiet' || args[i] === '-q') {
      options.verbose = false;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node auto-scrape-participation.mjs [options]');
      console.log('');
      console.log('Options:');
      console.log('  --days <n>      Look back N days (default: 7)');
      console.log('  --max <n>       Scrape maximum N games (default: all)');
      console.log('  --delay <ms>    Delay between requests in ms (default: 300)');
      console.log('  --quiet, -q     Suppress verbose output');
      console.log('  --help, -h      Show this help');
      console.log('');
      console.log('Examples:');
      console.log('  node auto-scrape-participation.mjs');
      console.log('  node auto-scrape-participation.mjs --days 3 --max 20');
      console.log('  node auto-scrape-participation.mjs --quiet');
      return;
    }
  }

  const results = await autoScrape(options);

  // Write results to log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = `scrape-log-${timestamp}.json`;
  fs.writeFileSync(logFile, JSON.stringify(results, null, 2));

  if (options.verbose) {
    console.log(`\n📄 Results saved to: ${logFile}`);
  }

  // Exit with appropriate code
  process.exit(results.errors > 0 ? 1 : 0);
}

main().catch(console.error);
