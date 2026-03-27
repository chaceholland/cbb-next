#!/usr/bin/env node
/**
 * Fix LSU roster issues:
 * 1. Remove duplicate pitchers
 * 2. Verify/fix headshot URLs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Normalize name for matching
const normalizeName = name => name?.toLowerCase()
  .replace(/\s*-\s*p\s*/g, ' ')
  .replace(/[^a-z\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '';

// Score a pitcher record
function scorePitcher(pitcher) {
  let score = 0;
  if (pitcher.headshot) score += 100;
  if (pitcher.position) score += 50;
  if (pitcher.height) score += 10;
  if (pitcher.weight) score += 10;
  if (pitcher.year) score += 10;
  if (pitcher.hometown) score += 10;
  if (pitcher.bats_throws) score += 10;
  if (!pitcher.name?.includes(' - P')) score += 20;
  if (!pitcher.display_name?.includes(' - P')) score += 20;
  return score;
}

async function fixLSU() {
  console.log('🔍 Analyzing LSU roster...\n');

  // Get LSU team
  const { data: teams } = await supabase
    .from('cbb_teams')
    .select('*')
    .eq('name', 'LSU');

  if (!teams || teams.length === 0) {
    console.error('❌ LSU team not found');
    return;
  }

  const teamId = teams[0].team_id;

  // Get all LSU pitchers
  const { data: pitchers } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .eq('team_id', teamId)
    .order('name');

  console.log(`Found ${pitchers.length} LSU pitchers\n`);

  // Group by normalized name
  const groups = new Map();
  for (const pitcher of pitchers) {
    const normalizedName = normalizeName(pitcher.name);
    if (!groups.has(normalizedName)) {
      groups.set(normalizedName, []);
    }
    groups.get(normalizedName).push(pitcher);
  }

  // Find duplicates
  const duplicates = [];
  for (const [name, group] of groups.entries()) {
    if (group.length > 1) {
      duplicates.push({ name, pitchers: group });
    }
  }

  console.log(`Found ${duplicates.length} duplicate groups:\n`);

  let totalDeleted = 0;

  for (const dup of duplicates) {
    console.log(`\n${dup.name} (${dup.pitchers.length} copies):`);

    // Score each version
    const scored = dup.pitchers.map(p => ({
      ...p,
      score: scorePitcher(p)
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    const keeper = scored[0];
    const toDelete = scored.slice(1);

    console.log(`  ✅ KEEPING: ${keeper.name} (ID: ${keeper.pitcher_id}, score: ${keeper.score})`);
    console.log(`     Headshot: ${keeper.headshot ? 'Yes' : 'No'}, Position: ${keeper.position || 'N/A'}`);

    for (const del of toDelete) {
      console.log(`  ❌ DELETING: ${del.name} (ID: ${del.pitcher_id}, score: ${del.score})`);
      console.log(`     Headshot: ${del.headshot ? 'Yes' : 'No'}, Position: ${del.position || 'N/A'}`);

      // Update participation records to point to keeper
      const { error: updateError } = await supabase
        .from('cbb_pitcher_participation')
        .update({ pitcher_id: keeper.pitcher_id })
        .eq('pitcher_id', del.pitcher_id);

      if (updateError) {
        console.log(`     ⚠️  Warning: Could not update participation records: ${updateError.message}`);
        continue;
      }

      // Delete the duplicate
      const { error: deleteError } = await supabase
        .from('cbb_pitchers')
        .delete()
        .eq('pitcher_id', del.pitcher_id);

      if (deleteError) {
        console.log(`     ❌ Error deleting: ${deleteError.message}`);
      } else {
        totalDeleted++;
      }
    }
  }

  console.log(`\n\n✅ Cleanup complete: ${totalDeleted} duplicates removed`);

  // Now check remaining pitchers for headshot issues
  const { data: remaining } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .eq('team_id', teamId)
    .order('name');

  console.log(`\n\n📋 Final LSU roster: ${remaining.length} pitchers\n`);

  const missingHeadshots = remaining.filter(p => !p.headshot);
  if (missingHeadshots.length > 0) {
    console.log(`Missing headshots (${missingHeadshots.length}):`);
    missingHeadshots.forEach(p => console.log(`  - ${p.name}`));
  } else {
    console.log('✅ All pitchers have headshot URLs');
  }
}

fixLSU().catch(console.error);
