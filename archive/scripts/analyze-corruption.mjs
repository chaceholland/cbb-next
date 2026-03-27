import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data: pitchers } = await supabase.from('cbb_pitchers').select('*');

console.log('\n🔍 DETAILED CORRUPTION ANALYSIS\n');
console.log('='.repeat(80) + '\n');

// Pattern 1: Bats/Throws field corruption
console.log('1. BATS/THROWS CORRUPTION PATTERNS:\n');

const validBatsThrows = ['R/R', 'L/L', 'R/L', 'L/R', 'B/L', 'B/R', 'S/R', 'S/L'];
const corruptedBatsThrows = pitchers.filter(p =>
  p.bats_throws && !validBatsThrows.includes(p.bats_throws)
);

console.log(`Total corrupted: ${corruptedBatsThrows.length}`);
console.log('\nSamples:');
corruptedBatsThrows.slice(0, 10).forEach(p => {
  console.log(`  ${p.name} (${p.team_id}): "${p.bats_throws.substring(0, 60)}..."`);
});

console.log('\n' + '='.repeat(80) + '\n');

// Pattern 2: Year field corruption
console.log('2. YEAR FIELD CORRUPTION PATTERNS:\n');

const validYearPatterns = [
  'Fr.', 'So.', 'Jr.', 'Sr.', 'Gr.',
  'Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate',
  'R-Fr.', 'R-So.', 'R-Jr.', 'R-Sr.',
  '*Fr.', '*So.', '*Jr.', '*Sr.',
  'Redshirt Freshman', 'Redshirt Sophomore', 'Redshirt Junior', 'Redshirt Senior',
  'RS-Freshman', 'RS-Sophomore', 'RS-Junior',
  'Fifth Year', 'Graduate Student', 'Sr. (Graduate)', '**Sr. (Graduate)'
];

const corruptedYear = pitchers.filter(p => {
  if (!p.year) return false;
  // Check if it's a height pattern (contains ' or -)
  if (p.year.includes("'") || p.year.includes('-')) return true;
  // Check if it's R/R or L/L pattern
  if (['R/R', 'L/L', 'R/L', 'L/R', 'S/R'].includes(p.year)) return true;
  // Check if it's super long (likely contains HTML/extra text)
  if (p.year.length > 30) return true;
  return false;
});

console.log(`Total corrupted: ${corruptedYear.length}`);
console.log('\nHeight in year field:');
corruptedYear.filter(p => p.year.includes("'") || p.year.includes('-')).slice(0, 5).forEach(p => {
  console.log(`  ${p.name} (${p.team_id}): year="${p.year}"`);
});

console.log('\nBats/Throws in year field:');
corruptedYear.filter(p => ['R/R', 'L/L', 'R/L', 'L/R', 'S/R'].includes(p.year)).slice(0, 5).forEach(p => {
  console.log(`  ${p.name} (${p.team_id}): year="${p.year}"`);
});

console.log('\nLong text in year field:');
corruptedYear.filter(p => p.year.length > 30).slice(0, 3).forEach(p => {
  console.log(`  ${p.name} (${p.team_id}): year="${p.year.substring(0, 80)}..."`);
});

console.log('\n' + '='.repeat(80) + '\n');

// Pattern 3: Position field corruption
console.log('3. POSITION FIELD CORRUPTION PATTERNS:\n');

const validPositions = ['RHP', 'LHP', 'P', 'Pitcher',
  'Right-Handed Pitcher', 'Left-Handed Pitcher',
  'Right-handed Pitcher', 'Left-handed Pitcher',
  'OF/RHP', 'INF/RHP', 'RHP/INF', '1B/LHP', 'INF/OF/RHP'];

const corruptedPosition = pitchers.filter(p => {
  if (!p.position) return false;
  // Check if it's excessively long (contains HTML/whitespace)
  if (p.position.length > 100) return true;
  return false;
});

console.log(`Total corrupted (long text): ${corruptedPosition.length}`);
if (corruptedPosition.length > 0) {
  console.log('\nSamples:');
  corruptedPosition.slice(0, 3).forEach(p => {
    console.log(`  ${p.name} (${p.team_id}): ${p.position.length} chars`);
  });
}

console.log('\n' + '='.repeat(80) + '\n');

// Summary by team
console.log('4. CORRUPTION BY TEAM:\n');

const teamCorruption = {};
[...corruptedBatsThrows, ...corruptedYear, ...corruptedPosition].forEach(p => {
  teamCorruption[p.team_id] = (teamCorruption[p.team_id] || 0) + 1;
});

const sortedTeams = Object.entries(teamCorruption)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log('Top 10 teams with corruption:');
sortedTeams.forEach(([teamId, count]) => {
  const team = pitchers.find(p => p.team_id === teamId);
  console.log(`  Team ${teamId}: ${count} corrupted records`);
});

console.log('\n' + '='.repeat(80) + '\n');

console.log(`\n✅ SUMMARY:`);
console.log(`  - Corrupted bats_throws: ${corruptedBatsThrows.length}`);
console.log(`  - Corrupted year: ${corruptedYear.length}`);
console.log(`  - Corrupted position: ${corruptedPosition.length}`);
console.log(`  - Total unique corrupted records: ${new Set([...corruptedBatsThrows, ...corruptedYear, ...corruptedPosition].map(p => p.pitcher_id)).size}\n`);
