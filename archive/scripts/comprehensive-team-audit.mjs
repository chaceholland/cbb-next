#!/usr/bin/env node
/**
 * Comprehensive Team Data Audit
 * Analyzes data completeness across all teams for pitchers
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

// Calculate coverage percentage for a field
function calculateCoverage(data, field) {
  const total = data.length;
  const withData = data.filter(item => {
    const value = item[field];
    return value !== null && value !== undefined && value !== '';
  }).length;
  return {
    count: withData,
    total,
    percentage: total > 0 ? ((withData / total) * 100).toFixed(1) : '0.0'
  };
}

async function auditTeams() {
  console.log('🔍 Starting Comprehensive Team Data Audit\n');
  console.log('=' .repeat(80));

  // Fetch all teams
  const { data: teams, error: teamsError } = await supabase
    .from('cbb_teams')
    .select('*');

  if (teamsError) {
    console.error('❌ Error fetching teams:', teamsError);
    return;
  }

  // Create team lookup map
  const teamMap = new Map(teams.map(t => [t.team_id, t.name || t.display_name]));

  // Fetch all pitchers
  const { data: pitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .order('team_id', { ascending: true });

  if (error) {
    console.error('❌ Error fetching pitchers:', error);
    return;
  }

  // Add team names to pitchers
  const flatPitchers = pitchers.map(p => ({
    ...p,
    team_name: teamMap.get(p.team_id) || 'Unknown'
  }));

  console.log(`\n📊 Total Pitchers: ${flatPitchers.length}\n`);

  // Group by team
  const teamGroups = new Map();
  for (const pitcher of flatPitchers) {
    const teamKey = `${pitcher.team_id}|${pitcher.team_name}`;
    if (!teamGroups.has(teamKey)) {
      teamGroups.set(teamKey, []);
    }
    teamGroups.get(teamKey).push(pitcher);
  }

  const teamData = Array.from(teamGroups.entries()).map(([key, pitchers]) => {
    const [team_id, team_name] = key.split('|');
    return { team_id, team_name, pitchers };
  });

  console.log(`📋 Total Teams: ${teamData.length}\n`);
  console.log('=' .repeat(80));

  // Analyze each team
  const teamAnalysis = [];

  for (const team of teamData) {
    const analysis = {
      team_id: team.team_id,
      team_name: team.team_name,
      pitcher_count: team.pitchers.length,

      // Visual data
      headshot: calculateCoverage(team.pitchers, 'headshot'),

      // Bio data
      height: calculateCoverage(team.pitchers, 'height'),
      weight: calculateCoverage(team.pitchers, 'weight'),
      year: calculateCoverage(team.pitchers, 'year'),
      hometown: calculateCoverage(team.pitchers, 'hometown'),
      bats_throws: calculateCoverage(team.pitchers, 'bats_throws'),
      position: calculateCoverage(team.pitchers, 'position'),
      number: calculateCoverage(team.pitchers, 'number'),

      // Name data
      display_name: calculateCoverage(team.pitchers, 'display_name'),
      espn_link: calculateCoverage(team.pitchers, 'espn_link'),
    };

    // Calculate overall bio completeness (average of bio fields)
    const bioFields = [analysis.height, analysis.weight, analysis.year, analysis.hometown, analysis.bats_throws];
    const avgBioPercentage = bioFields.reduce((sum, field) => sum + parseFloat(field.percentage), 0) / bioFields.length;
    analysis.bio_completeness = avgBioPercentage.toFixed(1);

    // Calculate overall profile completeness (headshot + display_name + number)
    const profileFields = [analysis.headshot, analysis.display_name, analysis.number];
    const avgProfilePercentage = profileFields.reduce((sum, field) => sum + parseFloat(field.percentage), 0) / profileFields.length;
    analysis.profile_completeness = avgProfilePercentage.toFixed(1);

    teamAnalysis.push(analysis);
  }

  // Sort by team name
  teamAnalysis.sort((a, b) => a.team_name.localeCompare(b.team_name));

  // Overall statistics
  const totalPitchers = flatPitchers.length;
  const overallStats = {
    headshot: calculateCoverage(flatPitchers, 'headshot'),
    height: calculateCoverage(flatPitchers, 'height'),
    weight: calculateCoverage(flatPitchers, 'weight'),
    year: calculateCoverage(flatPitchers, 'year'),
    hometown: calculateCoverage(flatPitchers, 'hometown'),
    bats_throws: calculateCoverage(flatPitchers, 'bats_throws'),
    position: calculateCoverage(flatPitchers, 'position'),
    number: calculateCoverage(flatPitchers, 'number'),
    display_name: calculateCoverage(flatPitchers, 'display_name'),
    espn_link: calculateCoverage(flatPitchers, 'espn_link'),
  };

  // Print overall summary
  console.log('\n📈 OVERALL DATA COMPLETENESS\n');
  console.log('Profile Data:');
  console.log(`  Headshots:      ${overallStats.headshot.percentage}% (${overallStats.headshot.count}/${overallStats.headshot.total})`);
  console.log(`  Display Name:   ${overallStats.display_name.percentage}% (${overallStats.display_name.count}/${overallStats.display_name.total})`);
  console.log(`  Jersey Number:  ${overallStats.number.percentage}% (${overallStats.number.count}/${overallStats.number.total})`);
  console.log(`  ESPN Link:      ${overallStats.espn_link.percentage}% (${overallStats.espn_link.count}/${overallStats.espn_link.total})`);

  console.log('\nBio Data:');
  console.log(`  Height:         ${overallStats.height.percentage}% (${overallStats.height.count}/${overallStats.height.total})`);
  console.log(`  Weight:         ${overallStats.weight.percentage}% (${overallStats.weight.count}/${overallStats.weight.total})`);
  console.log(`  Year:           ${overallStats.year.percentage}% (${overallStats.year.count}/${overallStats.year.total})`);
  console.log(`  Hometown:       ${overallStats.hometown.percentage}% (${overallStats.hometown.count}/${overallStats.hometown.total})`);
  console.log(`  Bats/Throws:    ${overallStats.bats_throws.percentage}% (${overallStats.bats_throws.count}/${overallStats.bats_throws.total})`);
  console.log(`  Position:       ${overallStats.position.percentage}% (${overallStats.position.count}/${overallStats.position.total})`);

  console.log('\n' + '=' .repeat(80));
  console.log('\n📋 TEAM-BY-TEAM BREAKDOWN\n');

  // Categorize teams by data quality
  const critical = [];  // < 50% in key areas
  const needsWork = []; // 50-80% in key areas
  const good = [];      // 80%+ in key areas

  for (const team of teamAnalysis) {
    const headshotPct = parseFloat(team.headshot.percentage);
    const bioPct = parseFloat(team.bio_completeness);
    const profilePct = parseFloat(team.profile_completeness);

    // Determine overall health based on profile and bio data
    const avgHealth = (profilePct + bioPct) / 2;

    if (avgHealth < 50) {
      critical.push(team);
    } else if (avgHealth < 80) {
      needsWork.push(team);
    } else {
      good.push(team);
    }
  }

  // Print Critical teams
  if (critical.length > 0) {
    console.log(`🚨 CRITICAL - Low Data Coverage (${critical.length} teams)\n`);
    for (const team of critical) {
      console.log(`${team.team_name}`);
      console.log(`  Pitchers: ${team.pitcher_count}`);
      console.log(`  Headshots: ${team.headshot.percentage}% (${team.headshot.count}/${team.headshot.total})`);
      console.log(`  Profile: ${team.profile_completeness}% | Bio: ${team.bio_completeness}%`);
      console.log(`  Missing: ${team.headshot.total - team.headshot.count} headshots, ` +
                  `${team.height.total - team.height.count} heights, ` +
                  `${team.year.total - team.year.count} years, ` +
                  `${team.hometown.total - team.hometown.count} hometowns`);
      console.log();
    }
  }

  // Print Needs Work teams
  if (needsWork.length > 0) {
    console.log(`⚠️  NEEDS IMPROVEMENT - Moderate Coverage (${needsWork.length} teams)\n`);
    for (const team of needsWork) {
      console.log(`${team.team_name}`);
      console.log(`  Pitchers: ${team.pitcher_count}`);
      console.log(`  Headshots: ${team.headshot.percentage}% | Profile: ${team.profile_completeness}% | Bio: ${team.bio_completeness}%`);
      console.log();
    }
  }

  // Print Good teams (summary only)
  if (good.length > 0) {
    console.log(`✅ GOOD - High Data Coverage (${good.length} teams)\n`);
    console.log('Teams with 80%+ average coverage:');
    good.forEach(team => {
      console.log(`  • ${team.team_name} (${team.pitcher_count} pitchers) - ` +
                  `${team.headshot.percentage}% headshots, ${team.bio_completeness}% bio`);
    });
    console.log();
  }

  // Identify specific data gaps
  console.log('\n' + '=' .repeat(80));
  console.log('🎯 PRIORITY DATA GAPS\n');

  // Teams with 0% headshots
  const noHeadshots = teamAnalysis.filter(t => parseFloat(t.headshot.percentage) === 0);
  if (noHeadshots.length > 0) {
    console.log(`📸 Teams with NO headshots (${noHeadshots.length}):`);
    noHeadshots.forEach(t => console.log(`  • ${t.team_name} (${t.pitcher_count} pitchers)`));
    console.log();
  }

  // Teams with low bio data
  const lowBio = teamAnalysis.filter(t => parseFloat(t.bio_completeness) < 30);
  if (lowBio.length > 0) {
    console.log(`📝 Teams with <30% bio data (${lowBio.length}):`);
    lowBio.forEach(t => console.log(`  • ${t.team_name} - ${t.bio_completeness}% complete`));
    console.log();
  }

  // Teams with low profile data
  const lowProfile = teamAnalysis.filter(t => parseFloat(t.profile_completeness) < 50);
  if (lowProfile.length > 0) {
    console.log(`👤 Teams with <50% profile data (${lowProfile.length}):`);
    lowProfile.forEach(t => console.log(`  • ${t.team_name} - ${t.profile_completeness}% complete`));
    console.log();
  }

  // Teams missing ESPN links
  const noEspnLinks = teamAnalysis.filter(t => parseFloat(t.espn_link.percentage) === 0);
  if (noEspnLinks.length > 0) {
    console.log(`🔗 Teams with NO ESPN links (${noEspnLinks.length}):`);
    noEspnLinks.forEach(t => console.log(`  • ${t.team_name} (${t.pitcher_count} pitchers)`));
    console.log();
  }

  // Save detailed results
  const results = {
    timestamp: new Date().toISOString(),
    overall: overallStats,
    summary: {
      total_teams: teamData.length,
      total_pitchers: totalPitchers,
      critical_teams: critical.length,
      needs_work_teams: needsWork.length,
      good_teams: good.length,
    },
    teams: teamAnalysis,
    priority_gaps: {
      no_headshots: noHeadshots.map(t => ({ team_name: t.team_name, pitcher_count: t.pitcher_count })),
      low_bio: lowBio.map(t => ({ team_name: t.team_name, bio_completeness: t.bio_completeness, pitcher_count: t.pitcher_count })),
      low_profile: lowProfile.map(t => ({ team_name: t.team_name, profile_completeness: t.profile_completeness, pitcher_count: t.pitcher_count })),
      no_espn_links: noEspnLinks.map(t => ({ team_name: t.team_name, pitcher_count: t.pitcher_count })),
    }
  };

  fs.writeFileSync('team-audit-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Detailed results saved to: team-audit-results.json');

  console.log('\n' + '=' .repeat(80));
  console.log('✅ Audit Complete\n');
}

auditTeams().catch(console.error);
