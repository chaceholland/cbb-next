/**
 * Comprehensive data completeness audit for all teams
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

async function auditDataCompleteness() {
  console.log('🔍 Running data completeness audit...\n');

  // Get all teams
  const { data: teams, error: teamsError } = await supabase
    .from('cbb_teams')
    .select('team_id, name, conference')
    .order('name');

  if (teamsError) {
    console.error('❌ Error fetching teams:', teamsError.message);
    return;
  }

  console.log(`📊 Analyzing ${teams.length} teams...\n`);

  // Get all pitchers
  const { data: pitchers, error: pitchersError } = await supabase
    .from('cbb_pitchers')
    .select('pitcher_id, team_id, name, display_name, headshot, position, year, height, weight, hometown, bats_throws');

  if (pitchersError) {
    console.error('❌ Error fetching pitchers:', pitchersError.message);
    return;
  }

  console.log(`👥 Analyzing ${pitchers.length} total pitchers\n`);
  console.log('='.repeat(100) + '\n');

  // Calculate stats for each team
  const teamStats = teams.map(team => {
    const teamPitchers = pitchers.filter(p => p.team_id === team.team_id);
    const total = teamPitchers.length;

    const stats = {
      team_name: team.name,
      conference: team.conference,
      total_pitchers: total,
      has_headshot: teamPitchers.filter(p => p.headshot).length,
      has_position: teamPitchers.filter(p => p.position).length,
      has_year: teamPitchers.filter(p => p.year).length,
      has_height: teamPitchers.filter(p => p.height).length,
      has_weight: teamPitchers.filter(p => p.weight).length,
      has_hometown: teamPitchers.filter(p => p.hometown).length,
      has_bats_throws: teamPitchers.filter(p => p.bats_throws).length,
    };

    stats.missing_headshot = total - stats.has_headshot;
    stats.missing_position = total - stats.has_position;
    stats.missing_year = total - stats.has_year;
    stats.missing_height = total - stats.has_height;
    stats.missing_weight = total - stats.has_weight;
    stats.missing_hometown = total - stats.has_hometown;
    stats.missing_bats_throws = total - stats.has_bats_throws;

    stats.total_missing = stats.missing_headshot + stats.missing_position +
                          stats.missing_year + stats.missing_height +
                          stats.missing_weight + stats.missing_hometown +
                          stats.missing_bats_throws;

    const totalPossible = total * 7; // 7 fields tracked
    const totalPresent = stats.has_headshot + stats.has_position + stats.has_year +
                         stats.has_height + stats.has_weight + stats.has_hometown +
                         stats.has_bats_throws;
    stats.completeness_pct = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(1) : 0;

    return stats;
  });

  // Sort by most missing data
  teamStats.sort((a, b) => b.total_missing - a.total_missing);

  // Display top 20 teams with most missing data
  console.log('🚨 TOP 20 TEAMS WITH MOST MISSING DATA\n');
  console.log('Rank | Team                          | Conf | Pitchers | Missing | Complete%');
  console.log('-'.repeat(100));

  teamStats.slice(0, 20).forEach((stat, idx) => {
    const rank = (idx + 1).toString().padStart(2, ' ');
    const team = stat.team_name.padEnd(29, ' ');
    const conf = (stat.conference || 'N/A').padEnd(4, ' ');
    const pitchers = stat.total_pitchers.toString().padStart(8, ' ');
    const missing = stat.total_missing.toString().padStart(7, ' ');
    const complete = (stat.completeness_pct + '%').padStart(9, ' ');

    console.log(`${rank}   | ${team} | ${conf} | ${pitchers} | ${missing} | ${complete}`);
  });

  console.log('\n' + '='.repeat(100) + '\n');

  // Breakdown by field type
  console.log('📋 MISSING DATA BY FIELD (Total across all teams)\n');

  const totalStats = {
    headshot: teamStats.reduce((sum, s) => sum + s.missing_headshot, 0),
    position: teamStats.reduce((sum, s) => sum + s.missing_position, 0),
    year: teamStats.reduce((sum, s) => sum + s.missing_year, 0),
    height: teamStats.reduce((sum, s) => sum + s.missing_height, 0),
    weight: teamStats.reduce((sum, s) => sum + s.missing_weight, 0),
    hometown: teamStats.reduce((sum, s) => sum + s.missing_hometown, 0),
    bats_throws: teamStats.reduce((sum, s) => sum + s.missing_bats_throws, 0),
  };

  const totalPitchers = pitchers.length;

  console.log(`Missing Headshots:    ${totalStats.headshot.toString().padStart(4)} / ${totalPitchers} (${((totalStats.headshot/totalPitchers)*100).toFixed(1)}%)`);
  console.log(`Missing Position:     ${totalStats.position.toString().padStart(4)} / ${totalPitchers} (${((totalStats.position/totalPitchers)*100).toFixed(1)}%)`);
  console.log(`Missing Year:         ${totalStats.year.toString().padStart(4)} / ${totalPitchers} (${((totalStats.year/totalPitchers)*100).toFixed(1)}%)`);
  console.log(`Missing Height:       ${totalStats.height.toString().padStart(4)} / ${totalPitchers} (${((totalStats.height/totalPitchers)*100).toFixed(1)}%)`);
  console.log(`Missing Weight:       ${totalStats.weight.toString().padStart(4)} / ${totalPitchers} (${((totalStats.weight/totalPitchers)*100).toFixed(1)}%)`);
  console.log(`Missing Hometown:     ${totalStats.hometown.toString().padStart(4)} / ${totalPitchers} (${((totalStats.hometown/totalPitchers)*100).toFixed(1)}%)`);
  console.log(`Missing Bats/Throws:  ${totalStats.bats_throws.toString().padStart(4)} / ${totalPitchers} (${((totalStats.bats_throws/totalPitchers)*100).toFixed(1)}%)`);

  console.log('\n' + '='.repeat(100) + '\n');

  // Show top 10 most complete teams
  const mostComplete = [...teamStats].sort((a, b) => b.completeness_pct - a.completeness_pct).slice(0, 10);

  console.log('✅ TOP 10 MOST COMPLETE TEAMS\n');
  console.log('Rank | Team                          | Conf | Pitchers | Complete%');
  console.log('-'.repeat(100));

  mostComplete.forEach((stat, idx) => {
    const rank = (idx + 1).toString().padStart(2, ' ');
    const team = stat.team_name.padEnd(29, ' ');
    const conf = (stat.conference || 'N/A').padEnd(4, ' ');
    const pitchers = stat.total_pitchers.toString().padStart(8, ' ');
    const complete = (stat.completeness_pct + '%').padStart(9, ' ');

    console.log(`${rank}   | ${team} | ${conf} | ${pitchers} | ${complete}`);
  });

  console.log('\n' + '='.repeat(100) + '\n');

  // Detailed breakdown for top 10 teams with most missing data
  console.log('🔍 DETAILED BREAKDOWN - TOP 10 TEAMS WITH MOST MISSING DATA\n');

  for (let i = 0; i < Math.min(10, teamStats.length); i++) {
    const stat = teamStats[i];
    console.log(`${i + 1}. ${stat.team_name} (${stat.conference || 'N/A'}) - ${stat.total_pitchers} pitchers - ${stat.completeness_pct}% complete`);
    console.log(`   Missing: Headshots=${stat.missing_headshot}, Position=${stat.missing_position}, Year=${stat.missing_year}, Height=${stat.missing_height}, Weight=${stat.missing_weight}, Hometown=${stat.missing_hometown}, Bats/Throws=${stat.missing_bats_throws}`);
    console.log('');
  }

  console.log('='.repeat(100) + '\n');
  console.log('✅ Audit complete!\n');
}

async function main() {
  console.log('🏀 CBB Pitcher Data Completeness Audit\n');
  console.log('='.repeat(100) + '\n');

  await auditDataCompleteness();
}

main().catch(console.error);
