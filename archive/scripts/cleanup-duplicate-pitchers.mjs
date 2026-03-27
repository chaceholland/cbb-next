#!/usr/bin/env node
/**
 * Clean up duplicate pitcher records
 * Focuses on " - P" pattern duplicates and exact name matches
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Normalize name for matching - removes " - P" pattern
const normalizeForMatching = name => name?.toLowerCase()
  .replace(/\s*-\s*p\s*/g, ' ')
  .replace(/[^a-z\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '';

// Score a pitcher record based on data completeness
function scorePitcher(pitcher) {
  let score = 0;

  // Has headshot (most important)
  if (pitcher.headshot) score += 100;

  // Has position info
  if (pitcher.position) score += 50;

  // Has bio data
  if (pitcher.height) score += 10;
  if (pitcher.weight) score += 10;
  if (pitcher.year) score += 10;
  if (pitcher.hometown) score += 10;
  if (pitcher.high_school) score += 10;

  // Has stats
  if (pitcher.ip !== null && pitcher.ip !== undefined) score += 5;
  if (pitcher.era !== null && pitcher.era !== undefined) score += 5;

  // Prefer records without " - P" pattern (cleaner name)
  if (!pitcher.name?.includes(' - P')) score += 20;
  if (!pitcher.display_name?.includes(' - P')) score += 20;

  return score;
}

async function findDuplicates() {
  console.log('🔍 Finding duplicate pitchers...\n');

  // Get all pitchers
  const { data: pitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .order('team_id', { ascending: true });

  if (error) {
    console.error('❌ Error fetching pitchers:', error);
    return [];
  }

  console.log(`Found ${pitchers.length} total pitchers\n`);

  // Group by normalized name + team_id
  const groups = new Map();

  for (const pitcher of pitchers) {
    const normalizedName = normalizeForMatching(pitcher.name);
    const key = `${normalizedName}|${pitcher.team_id}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(pitcher);
  }

  // Find groups with duplicates
  const duplicateGroups = [];
  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      duplicateGroups.push({
        key,
        pitchers: group,
        team_id: group[0].team_id,
        team_name: group[0].team_name || 'Unknown',
        normalized_name: key.split('|')[0]
      });
    }
  }

  console.log(`Found ${duplicateGroups.length} groups with duplicates\n`);

  return duplicateGroups;
}

async function cleanupDuplicates(duplicateGroups, dryRun = true) {
  const results = {
    totalGroups: duplicateGroups.length,
    totalDuplicates: 0,
    deleted: 0,
    errors: [],
    details: []
  };

  console.log(`${dryRun ? '🔍 DRY RUN MODE - No changes will be made' : '🚀 EXECUTING CLEANUP'}\n`);
  console.log('='.repeat(80));

  for (const group of duplicateGroups) {
    results.totalDuplicates += group.pitchers.length;

    // Score each pitcher in the group
    const scored = group.pitchers.map(p => ({
      ...p,
      score: scorePitcher(p)
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    const keeper = scored[0];
    const toDelete = scored.slice(1);

    console.log(`\n📌 ${group.team_name} - ${group.normalized_name}`);
    console.log(`   Found ${group.pitchers.length} duplicates:`);

    // Show keeper
    console.log(`   ✅ KEEPING: ${keeper.display_name || keeper.name} (ID: ${keeper.pitcher_id})`);
    console.log(`      Score: ${keeper.score}, Headshot: ${keeper.headshot ? 'Yes' : 'No'}, Position: ${keeper.position || 'N/A'}`);

    // Show what will be deleted
    for (const dup of toDelete) {
      console.log(`   ❌ DELETING: ${dup.display_name || dup.name} (ID: ${dup.pitcher_id})`);
      console.log(`      Score: ${dup.score}, Headshot: ${dup.headshot ? 'Yes' : 'No'}, Position: ${dup.position || 'N/A'}`);

      if (!dryRun) {
        // First, update any cbb_pitcher_participation records to point to the keeper
        const { error: updateError } = await supabase
          .from('cbb_pitcher_participation')
          .update({ pitcher_id: keeper.pitcher_id })
          .eq('pitcher_id', dup.pitcher_id);

        if (updateError) {
          console.log(`      ⚠️  Warning: Could not update participation records: ${updateError.message}`);
          results.errors.push({
            pitcher_id: dup.pitcher_id,
            name: dup.name,
            error: `Participation update failed: ${updateError.message}`
          });
          continue; // Skip deletion if we can't update participation records
        }

        // Delete the duplicate
        const { error: deleteError } = await supabase
          .from('cbb_pitchers')
          .delete()
          .eq('pitcher_id', dup.pitcher_id);

        if (deleteError) {
          console.log(`      ❌ Error deleting: ${deleteError.message}`);
          results.errors.push({
            pitcher_id: dup.pitcher_id,
            name: dup.name,
            error: deleteError.message
          });
        } else {
          results.deleted++;
        }
      }
    }

    results.details.push({
      team: group.team_name,
      normalized_name: group.normalized_name,
      keeper: {
        pitcher_id: keeper.pitcher_id,
        name: keeper.display_name || keeper.name,
        score: keeper.score
      },
      deleted: toDelete.map(d => ({
        pitcher_id: d.pitcher_id,
        name: d.display_name || d.name,
        score: d.score
      }))
    });
  }

  return results;
}

async function main() {
  console.log('🧹 Duplicate Pitcher Cleanup Tool\n');
  console.log('This tool will identify and remove duplicate pitcher records,');
  console.log('keeping the version with the most complete data.\n');

  // Find duplicates
  const duplicateGroups = await findDuplicates();

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!\n');
    return;
  }

  // Calculate total duplicates to remove
  const totalToRemove = duplicateGroups.reduce((sum, group) => sum + (group.pitchers.length - 1), 0);

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Groups with duplicates: ${duplicateGroups.length}`);
  console.log(`Total duplicate records to remove: ${totalToRemove}`);
  console.log(`Records to keep: ${duplicateGroups.length}`);

  // First, do a dry run
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 1: DRY RUN ANALYSIS');
  console.log('='.repeat(80));

  const dryRunResults = await cleanupDuplicates(duplicateGroups, true);

  // Save dry run results
  fs.writeFileSync(
    'duplicate-cleanup-plan.json',
    JSON.stringify(dryRunResults, null, 2)
  );
  console.log('\n\n💾 Dry run results saved to: duplicate-cleanup-plan.json');

  // Now execute the actual cleanup
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 2: EXECUTING CLEANUP');
  console.log('='.repeat(80));
  console.log('\nProceeding with actual deletion in 3 seconds...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  const results = await cleanupDuplicates(duplicateGroups, false);

  // Final summary
  console.log('\n\n' + '='.repeat(80));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nTotal duplicate groups processed: ${results.totalGroups}`);
  console.log(`Records deleted: ${results.deleted}`);
  console.log(`Errors encountered: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.name} (${err.pitcher_id}): ${err.error}`);
    });
  }

  // Save final results
  fs.writeFileSync(
    'duplicate-cleanup-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Final results saved to: duplicate-cleanup-results.json');

  // Re-run coverage analysis
  console.log('\n📊 Running updated coverage analysis...\n');
  const { spawn } = await import('child_process');
  spawn('node', ['analyze-headshot-coverage.mjs'], { stdio: 'inherit' });
}

main().catch(console.error);
