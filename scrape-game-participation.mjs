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
 * Scrapes pitcher participation data from ESPN's game summary page
 */
async function scrapePitcherData(gameId) {
  try {
    // ESPN's box score API endpoint
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract pitcher data from box score
    const pitchers = [];

    // Check if boxscore data exists
    if (data.boxscore?.players) {
      for (const team of data.boxscore.players) {
        const teamId = team.team.id;
        const teamName = team.team.displayName;

        // Look for pitching statistics
        for (const statGroup of team.statistics || []) {
          if (statGroup.name === 'Pitching' || statGroup.type === 'pitching') {
            for (const athlete of statGroup.athletes || []) {
              const stats = {};

              // Parse stats from the labels and stats arrays
              if (statGroup.labels && athlete.stats) {
                statGroup.labels.forEach((label, idx) => {
                  stats[label] = athlete.stats[idx];
                });
              }

              pitchers.push({
                game_id: gameId,
                team_id: teamId,
                team_name: teamName,
                pitcher_id: athlete.athlete?.id || null,
                pitcher_name: athlete.athlete?.displayName || 'Unknown',
                headshot: athlete.athlete?.headshot?.href || null,
                stats: {
                  IP: stats.IP || stats['IP'] || null,
                  H: stats.H || null,
                  R: stats.R || null,
                  ER: stats.ER || null,
                  BB: stats.BB || null,
                  K: stats.SO || stats.K || null,
                  HR: stats.HR || null,
                  PC: stats['P-S']?.split('-')[0] || null, // Pitch count
                  ERA: stats.ERA || null,
                }
              });
            }
          }
        }
      }
    }

    return pitchers;
  } catch (error) {
    console.error(`Error scraping game ${gameId}:`, error.message);
    return [];
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
    console.error('Database error:', error);
    return { success: 0, errors: pitchers.length };
  }

  return { success: pitchers.length, errors: 0 };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node scrape-game-participation.mjs <game_id>           # Scrape single game');
    console.log('  node scrape-game-participation.mjs --batch <file>      # Scrape from JSON file');
    console.log('  node scrape-game-participation.mjs --missing           # Scrape all missing');
    return;
  }

  if (args[0] === '--missing') {
    // Load games missing participation data
    const missingGames = JSON.parse(fs.readFileSync('games-missing-participation.json', 'utf8'));

    console.log(`Scraping participation data for ${missingGames.length} games...\n`);

    let totalPitchers = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < missingGames.length; i++) {
      const game = missingGames[i];
      console.log(`[${i + 1}/${missingGames.length}] ${game.matchup}`);

      const pitchers = await scrapePitcherData(game.game_id);

      if (pitchers.length > 0) {
        const result = await savePitcherData(pitchers);
        totalPitchers += result.success;
        successCount += result.success > 0 ? 1 : 0;
        errorCount += result.errors > 0 ? 1 : 0;
        console.log(`  ✅ Found ${pitchers.length} pitchers`);
      } else {
        console.log(`  ⚠️  No pitcher data available`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Games scraped: ${missingGames.length}`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  No data: ${missingGames.length - successCount - errorCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Total pitchers saved: ${totalPitchers}`);

  } else if (args[0] === '--batch') {
    // Batch mode: read game IDs from file
    const gameIds = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    console.log(`Scraping ${gameIds.length} games from ${args[1]}...\n`);

    for (const gameId of gameIds) {
      const pitchers = await scrapePitcherData(gameId);
      if (pitchers.length > 0) {
        await savePitcherData(pitchers);
        console.log(`✅ Game ${gameId}: ${pitchers.length} pitchers`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

  } else {
    // Single game mode
    const gameId = args[0];
    console.log(`Scraping game ${gameId}...\n`);

    const pitchers = await scrapePitcherData(gameId);

    if (pitchers.length > 0) {
      console.log(`Found ${pitchers.length} pitchers:\n`);
      pitchers.forEach(p => {
        console.log(`  ${p.pitcher_name} (${p.team_name})`);
        console.log(`    IP: ${p.stats.IP}, K: ${p.stats.K}, ER: ${p.stats.ER}`);
      });

      console.log('\nSaving to database...');
      const result = await savePitcherData(pitchers);
      console.log(`✅ Saved ${result.success} pitchers`);
    } else {
      console.log('⚠️  No pitcher data found for this game');
    }
  }
}

main().catch(console.error);
