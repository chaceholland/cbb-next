import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching team and pitcher data...\n');

  // Get team IDs
  const teamNames = ['LSU', 'Rutgers', 'UCLA', 'Texas', 'Alabama', 'Arizona State'];
  const { data: teams, error: teamsError } = await supabase
    .from('cbb_teams')
    .select('team_id, display_name')
    .in('display_name', teamNames);

  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    process.exit(1);
  }

  const teamMap = {};
  teams.forEach(t => {
    teamMap[t.display_name] = t.team_id;
  });

  console.log('Team IDs:');
  teams.forEach(t => console.log(`  ${t.display_name}: ${t.team_id}`));
  console.log('');

  // Get LSU pitcher IDs
  const lsuTeamId = teamMap['LSU'];
  const pitcherNames = [
    'Casan Evans',
    'Cooper Moore',
    'Danny Lachenmayer',
    'Gavin Guidry',
    'Mavrick Rizy',
    'William Schmidt'
  ];

  const { data: pitchers, error: pitchersError } = await supabase
    .from('cbb_pitchers')
    .select('pitcher_id, name, display_name')
    .eq('team_id', lsuTeamId);

  if (pitchersError) {
    console.error('Error fetching pitchers:', pitchersError);
    process.exit(1);
  }

  console.log('LSU Pitchers:');
  pitchers.forEach(p => console.log(`  ${p.display_name || p.name}: ${p.pitcher_id}`));
  console.log('');

  // Find matching pitchers
  const matchedPitchers = pitchers.filter(p => {
    const displayName = (p.display_name || p.name).toLowerCase();
    return pitcherNames.some(name => displayName.includes(name.toLowerCase()));
  });

  console.log('Matched Pitchers:');
  matchedPitchers.forEach(p => console.log(`  ${p.display_name || p.name}: ${p.pitcher_id}`));
  console.log('');

  // Create team issues array
  const teamIssues = [
    {
      teamId: teamMap['LSU'],
      teamName: 'LSU',
      issues: ['Incomplete roster'],
    },
    {
      teamId: teamMap['Rutgers'],
      teamName: 'Rutgers',
      issues: ['Misc.'],
      customNote: 'Try rescraping for player headshots',
    },
    {
      teamId: teamMap['UCLA'],
      teamName: 'UCLA',
      issues: ['Misc.'],
      customNote: 'Try rescraping for pitcher headshots.',
    },
    {
      teamId: teamMap['Texas'],
      teamName: 'Texas',
      issues: ['Try Rescraping for All Data'],
    },
    {
      teamId: teamMap['Alabama'],
      teamName: 'Alabama',
      issues: ['Missing pitcher data', 'Misc.'],
      customNote: 'Try Rescraping for pitcher numbers',
    },
    {
      teamId: teamMap['Arizona State'],
      teamName: 'Arizona State',
      issues: ['Try Rescraping for All Data'],
    },
  ];

  // Create pitcher issues array
  const pitcherIssues = matchedPitchers.map(p => ({
    pitcherKey: `${lsuTeamId}:${p.pitcher_id}`,
    pitcherName: p.display_name || p.name,
    teamName: 'LSU',
    issues: ['Missing headshot'],
  }));

  // Output for browser console
  console.log('\n=== Copy and paste this into your browser console ===\n');
  console.log(`// Team Issues`);
  console.log(`localStorage.setItem('cbb-team-data-quality-issues', JSON.stringify(${JSON.stringify(teamIssues, null, 2)}));\n`);
  console.log(`// Pitcher Issues`);
  console.log(`localStorage.setItem('cbb-roster-pitcher-data-quality-issues', JSON.stringify(${JSON.stringify(pitcherIssues, null, 2)}));\n`);
  console.log(`console.log('Issues imported! Refresh the page to see them.');`);
  console.log('\n=== End of script ===\n');
}

main().catch(console.error);
