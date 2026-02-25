#!/usr/bin/env node
/**
 * Phase 2: Replace Database with 2026 Rosters
 *
 * Reads 2026-rosters.json and replaces all pitcher data in the database.
 * WARNING: This deletes all existing pitcher and participation records!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper to get user confirmation
async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

// Load and validate scraped data from JSON
function loadScrapedData() {
  const jsonPath = join(__dirname, '2026-rosters.json');

  if (!existsSync(jsonPath)) {
    throw new Error('2026-rosters.json not found!');
  }

  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  console.log('✅ Loaded 2026-rosters.json');
  console.log(`   Scraped: ${new Date(data.scrapedAt).toLocaleString()}`);
  console.log(`   Total teams: ${data.totalTeams}`);
  console.log(`   Successful: ${data.successfulTeams}`);
  console.log(`   Failed: ${data.failedTeams}`);
  console.log(`   Total pitchers: ${data.totalPitchers}`);
  console.log();

  return data;
}

// Get current database statistics
async function getCurrentStats() {
  console.log('📊 Current Database State:');

  const { count: pitcherCount, error: pitcherError } = await supabase
    .from('cbb_pitchers')
    .select('*', { count: 'exact', head: true });

  if (pitcherError) {
    throw new Error(`Failed to count pitchers: ${pitcherError.message}`);
  }

  const { count: participationCount, error: participationError } = await supabase
    .from('cbb_pitcher_game_participation')
    .select('*', { count: 'exact', head: true });

  if (participationError) {
    throw new Error(`Failed to count participation records: ${participationError.message}`);
  }

  console.log(`   Current pitchers: ${pitcherCount}`);
  console.log(`   Current participation records: ${participationCount}`);
  console.log();

  return { pitcherCount, participationCount };
}

// Delete all existing pitcher data
async function deleteOldData() {
  console.log('🗑️  Deleting old data...');

  // Step 1: Delete participation records (respects foreign key)
  console.log('   Deleting participation records...');
  const { error: participationError } = await supabase
    .from('cbb_pitcher_game_participation')
    .delete()
    .neq('pitcher_id', '___MATCH_NOTHING___');

  if (participationError) {
    throw new Error(`Failed to delete participation records: ${participationError.message}`);
  }
  console.log('   ✅ Participation records deleted');

  // Step 2: Delete pitchers
  console.log('   Deleting pitchers...');
  const { error: pitcherError } = await supabase
    .from('cbb_pitchers')
    .delete()
    .neq('pitcher_id', '___MATCH_NOTHING___');

  if (pitcherError) {
    throw new Error(`Failed to delete pitchers: ${pitcherError.message}`);
  }
  console.log('   ✅ Pitchers deleted');
  console.log();
}

// Insert new rosters with batch operations
async function insertNewRosters(scrapedData) {
  console.log('📥 Inserting new rosters...');

  let totalInserted = 0;
  let teamsProcessed = 0;
  const BATCH_SIZE = 100;

  for (const team of scrapedData.teams) {
    // Skip failed teams or teams with no pitchers
    if (team.status !== 'success' || !team.pitchers || team.pitchers.length === 0) {
      continue;
    }

    // Generate pitcher records with IDs
    const pitcherRecords = team.pitchers.map((pitcher, index) => ({
      pitcher_id: `${team.team_id}-P${index + 1}`,
      team_id: team.team_id,
      name: pitcher.name,
      display_name: pitcher.display_name,
      number: pitcher.number || null,
      position: pitcher.position,
      headshot: pitcher.headshot || null,
      height: pitcher.height || null,
      weight: pitcher.weight || null,
      year: pitcher.year || null,
      hometown: pitcher.hometown || null,
      bats_throws: pitcher.bats_throws || null
    }));

    // Insert in batches
    for (let i = 0; i < pitcherRecords.length; i += BATCH_SIZE) {
      const batch = pitcherRecords.slice(i, i + BATCH_SIZE);

      const { error } = await supabase
        .from('cbb_pitchers')
        .insert(batch);

      if (error) {
        throw new Error(`Failed to insert pitchers for ${team.team_name}: ${error.message}`);
      }

      totalInserted += batch.length;
    }

    teamsProcessed++;
    if (teamsProcessed % 10 === 0) {
      console.log(`   Processed ${teamsProcessed} teams, inserted ${totalInserted} pitchers...`);
    }
  }

  console.log(`   ✅ Inserted ${totalInserted} pitchers from ${teamsProcessed} teams`);
  console.log();

  return { totalInserted, teamsProcessed };
}

async function main() {
  console.log('📋 2026 ROSTER REPLACEMENT');
  console.log('='.repeat(60));
  console.log();

  // Load scraped data
  const scrapedData = loadScrapedData();

  // Get current database stats
  const currentStats = await getCurrentStats();

  // Show summary
  console.log('⚠️  WARNING: This will DELETE all existing pitcher data!');
  console.log(`   Will delete: ${currentStats.pitcherCount} pitchers`);
  console.log(`   Will delete: ${currentStats.participationCount} participation records`);
  console.log(`   Will insert: ${scrapedData.totalPitchers} new pitchers`);
  console.log();

  // Get confirmation
  const confirmed = await confirm('Type "yes" to continue: ');
  if (!confirmed) {
    console.log('❌ Operation cancelled.');
    return;
  }

  console.log();
  console.log('🚀 Starting replacement...');
  console.log();

  // Delete old data
  await deleteOldData();

  // Insert new data
  const insertStats = await insertNewRosters(scrapedData);

  // Show final stats
  console.log('📊 Final Database State:');
  const finalStats = await getCurrentStats();

  console.log('='.repeat(60));
  console.log('✅ Replacement complete!');
  console.log(`   Teams processed: ${insertStats.teamsProcessed}`);
  console.log(`   Pitchers inserted: ${insertStats.totalInserted}`);
  console.log(`   Database now has: ${finalStats.pitcherCount} pitchers`);
}

main().catch(console.error);
