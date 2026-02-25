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

async function analyzeHeadshotCoverage() {
  console.log('🔍 Analyzing headshot coverage across all teams...\n');

  // Get all pitchers
  const { data: pitchers, error: pitchersError } = await supabase
    .from('cbb_pitchers')
    .select('pitcher_id, name, team_id, headshot');

  if (pitchersError) {
    console.error('Error fetching pitchers:', pitchersError);
    return;
  }

  // Get all teams
  const { data: teams, error: teamsError } = await supabase
    .from('cbb_teams')
    .select('team_id, display_name');

  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    return;
  }

  const teamMap = {};
  teams.forEach(t => { teamMap[t.team_id] = t.display_name; });

  // Group pitchers by team
  const teamStats = {};
  pitchers.forEach(p => {
    if (!teamStats[p.team_id]) {
      teamStats[p.team_id] = {
        team_name: teamMap[p.team_id] || 'Unknown',
        total: 0,
        with_headshot: 0,
        without_headshot: 0,
        pitchers_missing: []
      };
    }
    teamStats[p.team_id].total++;
    if (p.headshot && p.headshot.trim() !== '') {
      teamStats[p.team_id].with_headshot++;
    } else {
      teamStats[p.team_id].without_headshot++;
      teamStats[p.team_id].pitchers_missing.push(p.name);
    }
  });

  // Calculate percentages and sort
  const teamResults = Object.entries(teamStats).map(([team_id, stats]) => ({
    team_id,
    team_name: stats.team_name,
    total: stats.total,
    with_headshot: stats.with_headshot,
    without_headshot: stats.without_headshot,
    coverage_pct: ((stats.with_headshot / stats.total) * 100).toFixed(1),
    pitchers_missing: stats.pitchers_missing
  })).sort((a, b) => parseFloat(a.coverage_pct) - parseFloat(b.coverage_pct));

  // Identify teams with poor coverage (< 50%)
  const poorCoverage = teamResults.filter(t => parseFloat(t.coverage_pct) < 50);

  console.log('📊 HEADSHOT COVERAGE SUMMARY\n');
  console.log('═'.repeat(80));

  if (poorCoverage.length > 0) {
    console.log(`\n🚨 TEAMS WITH < 50% HEADSHOT COVERAGE (${poorCoverage.length} teams):\n`);
    poorCoverage.forEach(team => {
      console.log(`${team.team_name}`);
      console.log(`  Coverage: ${team.coverage_pct}% (${team.with_headshot}/${team.total} pitchers)`);
      console.log(`  Missing: ${team.without_headshot} headshots`);
      console.log('');
    });
  }

  // Teams with moderate coverage (50-80%)
  const moderateCoverage = teamResults.filter(t => parseFloat(t.coverage_pct) >= 50 && parseFloat(t.coverage_pct) < 80);

  if (moderateCoverage.length > 0) {
    console.log(`\n⚠️  TEAMS WITH 50-80% COVERAGE (${moderateCoverage.length} teams):\n`);
    moderateCoverage.forEach(team => {
      console.log(`${team.team_name}: ${team.coverage_pct}% (${team.with_headshot}/${team.total})`);
    });
  }

  // Teams with good coverage (80%+)
  const goodCoverage = teamResults.filter(t => parseFloat(t.coverage_pct) >= 80);

  console.log(`\n\n✅ TEAMS WITH 80%+ COVERAGE (${goodCoverage.length} teams):\n`);
  goodCoverage.forEach(team => {
    console.log(`${team.team_name}: ${team.coverage_pct}% (${team.with_headshot}/${team.total})`);
  });

  // Overall stats
  const totalPitchers = pitchers.length;
  const totalWithHeadshots = pitchers.filter(p => p.headshot && p.headshot.trim() !== '').length;
  const overallCoverage = ((totalWithHeadshots / totalPitchers) * 100).toFixed(1);

  console.log('\n' + '═'.repeat(80));
  console.log('\n📈 OVERALL STATISTICS:\n');
  console.log(`Total Teams: ${teams.length}`);
  console.log(`Total Pitchers: ${totalPitchers}`);
  console.log(`Pitchers with Headshots: ${totalWithHeadshots}`);
  console.log(`Pitchers without Headshots: ${totalPitchers - totalWithHeadshots}`);
  console.log(`Overall Coverage: ${overallCoverage}%`);
  console.log('');
  console.log(`Teams needing rescraping (< 50%): ${poorCoverage.length}`);
  console.log(`Teams with moderate coverage (50-80%): ${moderateCoverage.length}`);
  console.log(`Teams with good coverage (80%+): ${goodCoverage.length}`);

  // Save teams needing rescraping to a file
  if (poorCoverage.length > 0) {
    const teamsToRescrape = poorCoverage.map(t => ({
      team_id: t.team_id,
      team_name: t.team_name,
      coverage_pct: t.coverage_pct,
      missing_count: t.without_headshot
    }));

    fs.writeFileSync(
      'teams-needing-headshot-rescrape.json',
      JSON.stringify(teamsToRescrape, null, 2)
    );
    console.log('\n💾 Saved teams needing rescraping to: teams-needing-headshot-rescrape.json');
  }
}

analyzeHeadshotCoverage().catch(console.error);
