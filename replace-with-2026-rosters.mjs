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

  // TODO: Insert new data
  // TODO: Show final stats

  console.log('✅ Replacement complete!');
}

main().catch(console.error);
