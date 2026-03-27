/**
 * Fix data corruption by identifying and nulling out invalid field values
 * This allows the fields to be properly re-scraped later
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const validBatsThrows = ['R/R', 'L/L', 'R/L', 'L/R', 'B/L', 'B/R', 'S/R', 'S/L'];

const validYearPatterns = [
  'Fr.', 'So.', 'Jr.', 'Sr.', 'Gr.',
  'Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate',
  'R-Fr.', 'R-So.', 'R-Jr.', 'R-Sr.',
  '*Fr.', '*So.', '*Jr.', '*Sr.',
  'Redshirt Freshman', 'Redshirt Sophomore', 'Redshirt Junior', 'Redshirt Senior',
  'RS-Freshman', 'RS-Sophomore', 'RS-Junior',
  'Fifth Year', 'Graduate Student', 'Sr. (Graduate)', '**Sr. (Graduate)',
  'Fifth Year (Gr.)', 'R-Freshman'
];

function isCorruptedYear(year) {
  if (!year) return false;
  // Check if it's a height pattern
  if (year.includes("'") || year.match(/^\d-\d$/)) return true;
  // Check if it's bats/throws pattern
  if (validBatsThrows.includes(year)) return true;
  // Check if it's excessively long (HTML/whitespace)
  if (year.length > 30) return true;
  return false;
}

function isCorruptedBatsThrows(batsThrows) {
  if (!batsThrows) return false;
  return !validBatsThrows.includes(batsThrows);
}

function isCorruptedPosition(position) {
  if (!position) return false;
  // Position field should be relatively short
  return position.length > 100;
}

async function fixCorruption() {
  console.log('\n🔧 FIXING DATA CORRUPTION\n');
  console.log('='.repeat(80) + '\n');

  // Get all pitchers
  const { data: pitchers, error: fetchError } = await supabase
    .from('cbb_pitchers')
    .select('*');

  if (fetchError) {
    console.error('❌ Error fetching pitchers:', fetchError.message);
    return;
  }

  console.log(`📊 Analyzing ${pitchers.length} pitchers...\n`);

  const fixes = [];

  for (const pitcher of pitchers) {
    const updates = {};

    // Check bats_throws corruption
    if (isCorruptedBatsThrows(pitcher.bats_throws)) {
      updates.bats_throws = null;
    }

    // Check year corruption
    if (isCorruptedYear(pitcher.year)) {
      updates.year = null;
    }

    // Check position corruption
    if (isCorruptedPosition(pitcher.position)) {
      updates.position = null;
    }

    if (Object.keys(updates).length > 0) {
      fixes.push({
        pitcher_id: pitcher.pitcher_id,
        name: pitcher.name,
        team_id: pitcher.team_id,
        updates
      });
    }
  }

  console.log(`🎯 Found ${fixes.length} pitchers with corrupted data\n`);

  if (fixes.length === 0) {
    console.log('✅ No corruption found! Data is clean.\n');
    return;
  }

  // Group by corruption type
  const batsThrowsFixes = fixes.filter(f => f.updates.bats_throws === null);
  const yearFixes = fixes.filter(f => f.updates.year === null);
  const positionFixes = fixes.filter(f => f.updates.position === null);

  console.log('Corruption breakdown:');
  console.log(`  - Corrupted bats_throws: ${batsThrowsFixes.length}`);
  console.log(`  - Corrupted year: ${yearFixes.length}`);
  console.log(`  - Corrupted position: ${positionFixes.length}\n`);

  console.log('📝 Applying fixes...\n');

  let fixed = 0;
  let failed = 0;

  for (const fix of fixes) {
    const { error } = await supabase
      .from('cbb_pitchers')
      .update(fix.updates)
      .eq('pitcher_id', fix.pitcher_id);

    if (error) {
      console.error(`❌ Failed to fix ${fix.name}: ${error.message}`);
      failed++;
    } else {
      const fields = Object.keys(fix.updates).join(', ');
      console.log(`✅ Fixed ${fix.name} (${fix.team_id}): cleared ${fields}`);
      fixed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n✨ Fixed ${fixed} pitchers`);
  if (failed > 0) {
    console.log(`⚠️  Failed to fix ${failed} pitchers`);
  }
  console.log('\n🔄 Redeploy to Vercel to see changes\n');
}

fixCorruption().catch(console.error);
