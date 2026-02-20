import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixGameData() {
  console.log('🔍 Checking team table structure and game data...\n');

  // Check cbb_teams table structure
  const { data: teamsSample, error: teamsError } = await supabase
    .from('cbb_teams')
    .select('*')
    .limit(5);

  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    return;
  }

  console.log('cbb_teams columns:', Object.keys(teamsSample[0] || {}));
  console.log('\nSample teams:');
  teamsSample?.forEach(t => {
    console.log(`  ${JSON.stringify(t)}`);
  });

  // Get all teams for lookup
  const { data: allTeams } = await supabase
    .from('cbb_teams')
    .select('*');

  const teamMap = {};
  allTeams?.forEach(t => {
    const idKey = t.team_id || t.espn_team_id || t.id;
    teamMap[idKey] = t;
  });

  console.log(`\n📊 Total teams in lookup: ${Object.keys(teamMap).length}\n`);

  // Get games with NULL names
  const { data: nullGames, error: nullError } = await supabase
    .from('cbb_games')
    .select('*')
    .or('home_name.is.null,away_name.is.null')
    .limit(100);

  if (nullError) {
    console.error('Error fetching NULL games:', nullError);
    return;
  }

  console.log(`Found ${nullGames?.length || 0} games with NULL team names\n`);

  // Try to match team IDs to cbb_teams
  console.log('Analyzing team ID matches:\n');
  const uniqueTeamIds = new Set();
  nullGames?.forEach(g => {
    uniqueTeamIds.add(g.home_team_id);
    uniqueTeamIds.add(g.away_team_id);
  });

  console.log(`Unique team IDs in NULL games: ${uniqueTeamIds.size}`);
  console.log('Sample team IDs:', Array.from(uniqueTeamIds).slice(0, 10));

  // Check if any of these IDs exist in teamMap
  const matchedIds = [];
  const unmatchedIds = [];
  uniqueTeamIds.forEach(id => {
    if (teamMap[id]) {
      matchedIds.push(id);
    } else {
      unmatchedIds.push(id);
    }
  });

  console.log(`\nMatched IDs in cbb_teams: ${matchedIds.length}`);
  console.log(`Unmatched IDs: ${unmatchedIds.length}`);
  console.log('Unmatched IDs sample:', unmatchedIds.slice(0, 10));

  // Check for Ole Miss specifically on Feb 14
  const { data: feb14Games } = await supabase
    .from('cbb_games')
    .select('*')
    .gte('date', '2026-02-14')
    .lt('date', '2026-02-15')
    .or(`home_team_id.eq.92,away_team_id.eq.92`); // Ole Miss is usually ID 92

  console.log(`\n\nOle Miss games on Feb 14:`);
  feb14Games?.forEach(g => {
    console.log(`  Game ID: ${g.game_id}`);
    console.log(`  ${g.away_name || 'NULL'} (${g.away_team_id}) @ ${g.home_name || 'NULL'} (${g.home_team_id})`);
    console.log(`  Venue: ${g.venue || 'NULL'}\n`);
  });
}

fixGameData().catch(console.error);
