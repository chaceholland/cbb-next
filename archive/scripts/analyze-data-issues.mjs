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

console.log('\n🔍 COMPREHENSIVE DATA QUALITY ANALYSIS\n');
console.log('='.repeat(80) + '\n');

// Get all data
const { data: pitchers } = await supabase.from('cbb_pitchers').select('*');
const { data: teams } = await supabase.from('cbb_teams').select('*');

// 1. Check for data formatting inconsistencies
console.log('📋 1. DATA FORMATTING ISSUES:\n');

// Height formats
const heightFormats = {};
pitchers.filter(p => p.height).forEach(p => {
  const format = p.height.includes('-') ? 'dash' : p.height.includes("'") ? 'feet-inch' : 'other';
  heightFormats[format] = (heightFormats[format] || 0) + 1;
});
console.log('Height formats:', heightFormats);

// Weight formats
const weightWithLbs = pitchers.filter(p => p.weight && p.weight.toLowerCase().includes('lb')).length;
const weightNumbers = pitchers.filter(p => p.weight && !p.weight.toLowerCase().includes('lb')).length;
console.log(`Weight formats: ${weightWithLbs} with "lbs", ${weightNumbers} without`);

// Bats/Throws formats
const batsThrowsFormats = {};
pitchers.filter(p => p.bats_throws).forEach(p => {
  batsThrowsFormats[p.bats_throws] = (batsThrowsFormats[p.bats_throws] || 0) + 1;
});
console.log('Bats/Throws values:', Object.keys(batsThrowsFormats).slice(0, 10));

console.log('\n' + '='.repeat(80) + '\n');

// 2. Missing critical IDs
console.log('📋 2. MISSING ESPN IDs:\n');
const missingEspnIds = pitchers.filter(p => !p.espn_id).length;
console.log(`Pitchers without ESPN IDs: ${missingEspnIds} / ${pitchers.length}`);

console.log('\n' + '='.repeat(80) + '\n');

// 3. Name consistency
console.log('📋 3. NAME FIELD CONSISTENCY:\n');
const missingDisplayName = pitchers.filter(p => !p.display_name).length;
const displayNameDifferent = pitchers.filter(p => p.display_name && p.name !== p.display_name).length;
console.log(`Missing display_name: ${missingDisplayName}`);
console.log(`display_name differs from name: ${displayNameDifferent}`);

console.log('\n' + '='.repeat(80) + '\n');

// 4. Potential duplicates
console.log('📋 4. POTENTIAL DUPLICATE PITCHERS:\n');
const nameMap = {};
pitchers.forEach(p => {
  const key = `${p.name}_${p.team_id}`;
  nameMap[key] = (nameMap[key] || 0) + 1;
});
const duplicates = Object.entries(nameMap).filter(([k, v]) => v > 1);
console.log(`Potential duplicates (same name + team): ${duplicates.length}`);
if (duplicates.length > 0) {
  duplicates.slice(0, 5).forEach(([key, count]) => {
    console.log(`  - ${key}: ${count} entries`);
  });
}

console.log('\n' + '='.repeat(80) + '\n');

// 5. Team data completeness
console.log('📋 5. TEAM DATA COMPLETENESS:\n');
const missingLogos = teams.filter(t => !t.logo).length;
const missingColors = teams.filter(t => !t.primary_color).length;
const missingConference = teams.filter(t => !t.conference).length;
console.log(`Teams missing logo: ${missingLogos} / ${teams.length}`);
console.log(`Teams missing primary_color: ${missingColors} / ${teams.length}`);
console.log(`Teams missing conference: ${missingConference} / ${teams.length}`);

console.log('\n' + '='.repeat(80) + '\n');

// 6. Year field issues
console.log('📋 6. YEAR FIELD ISSUES:\n');
const yearValues = {};
pitchers.filter(p => p.year).forEach(p => {
  yearValues[p.year] = (yearValues[p.year] || 0) + 1;
});
console.log('Year values found:', Object.keys(yearValues).sort());
const unusualYears = Object.entries(yearValues).filter(([year]) =>
  !['Fr.', 'So.', 'Jr.', 'Sr.', 'Freshman', 'Sophomore', 'Junior', 'Senior',
    'Fifth Year', 'Redshirt Junior', 'Redshirt Sophomore', 'Redshirt Senior', 'Gr.'].includes(year)
);
if (unusualYears.length > 0) {
  console.log('\nUnusual year values:');
  unusualYears.slice(0, 10).forEach(([year, count]) => {
    console.log(`  - "${year}": ${count} pitchers`);
  });
}

console.log('\n' + '='.repeat(80) + '\n');

// 7. Position field analysis
console.log('📋 7. POSITION FIELD ANALYSIS:\n');
const positionValues = {};
pitchers.filter(p => p.position).forEach(p => {
  positionValues[p.position] = (positionValues[p.position] || 0) + 1;
});
console.log('Position values found:', Object.keys(positionValues).sort());

console.log('\n' + '='.repeat(80) + '\n');

// 8. Top priorities for improvement
console.log('🎯 TOP PRIORITIES FOR IMPROVEMENT:\n');

const issues = [
  { issue: 'Continue bio data scraping for teams 21-64', impact: 'HIGH', effort: 'MEDIUM' },
  { issue: 'Normalize height format (standardize to one format)', impact: 'MEDIUM', effort: 'LOW' },
  { issue: 'Normalize weight format (remove "lbs" suffix)', impact: 'MEDIUM', effort: 'LOW' },
  { issue: 'Normalize year values (standardize abbreviations)', impact: 'MEDIUM', effort: 'LOW' },
  { issue: 'Add missing team colors/logos', impact: 'LOW', effort: 'LOW' },
  { issue: 'Verify and fix potential duplicates', impact: 'MEDIUM', effort: 'MEDIUM' },
  { issue: 'Scrape missing ESPN IDs if possible', impact: 'LOW', effort: 'HIGH' }
];

issues.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.issue}`);
  console.log(`   Impact: ${item.impact} | Effort: ${item.effort}\n`);
});

console.log('='.repeat(80) + '\n');
