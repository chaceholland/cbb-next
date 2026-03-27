import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkGameIssues() {
  console.log('🔍 Checking for game data issues...\n');

  // 1. Find games with NULL team names
  const { data: unknownGames, error: unknownError } = await supabase
    .from('cbb_games')
    .select('game_id, date, home_team_id, away_team_id, home_name, away_name, venue')
    .or('home_name.is.null,away_name.is.null')
    .order('date', { ascending: true })
    .limit(20);

  if (unknownError) {
    console.error('Error finding unknown games:', unknownError);
  } else {
    console.log(`Found ${unknownGames?.length || 0} games with NULL team names:\n`);
    unknownGames?.forEach(g => {
      console.log(`Date: ${g.date.split('T')[0]}`);
      console.log(`  Home: ${g.home_name || 'NULL'} (ID: ${g.home_team_id})`);
      console.log(`  Away: ${g.away_name || 'NULL'} (ID: ${g.away_team_id})`);
      console.log(`  Venue: ${g.venue || 'NULL'}`);
      console.log(`  Game ID: ${g.game_id}\n`);
    });
  }

  // 2. Find Ole Miss games
  const { data: oleMissGames, error: oleMissError } = await supabase
    .from('cbb_games')
    .select('game_id, date, home_team_id, away_team_id, home_name, away_name, venue')
    .or('home_name.ilike.%Ole Miss%,away_name.ilike.%Ole Miss%,home_name.ilike.%Mississippi%,away_name.ilike.%Mississippi%')
    .gte('date', '2026-02-14')
    .lte('date', '2026-02-21')
    .order('date', { ascending: true });

  if (oleMissError) {
    console.error('Error finding Ole Miss games:', oleMissError);
  } else {
    console.log(`\nOle Miss games around today (Feb 14-21):\n`);
    oleMissGames?.forEach(g => {
      console.log(`Date: ${g.date.split('T')[0]}`);
      console.log(`  ${g.away_name} @ ${g.home_name}`);
      console.log(`  IDs: Away=${g.away_team_id}, Home=${g.home_team_id}`);
      console.log(`  Game ID: ${g.game_id}\n`);
    });
  }

  // 3. Find Miami games
  const { data: miamiGames, error: miamiError } = await supabase
    .from('cbb_games')
    .select('game_id, date, home_team_id, away_team_id, home_name, away_name')
    .or('home_name.ilike.%Miami%,away_name.ilike.%Miami%')
    .gte('date', '2026-02-14')
    .lte('date', '2026-02-21')
    .order('date', { ascending: true });

  if (miamiError) {
    console.error('Error finding Miami games:', miamiError);
  } else {
    console.log(`\nMiami games around today (Feb 14-21):\n`);
    miamiGames?.forEach(g => {
      console.log(`Date: ${g.date.split('T')[0]}`);
      console.log(`  ${g.away_name} @ ${g.home_name}`);
      console.log(`  IDs: Away=${g.away_team_id}, Home=${g.home_team_id}`);
      console.log(`  Game ID: ${g.game_id}\n`);
    });
  }

  // 4. Check cbb_teams table for team name data
  const { data: teams, error: teamsError } = await supabase
    .from('cbb_teams')
    .select('espn_id, display_name, short_name')
    .order('espn_id', { ascending: true });

  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
  } else {
    console.log(`\nTotal teams in cbb_teams: ${teams?.length || 0}`);
    console.log('\nSample of teams (first 10):');
    teams?.slice(0, 10).forEach(t => {
      console.log(`  ID ${t.espn_id}: ${t.display_name} (${t.short_name})`);
    });
  }
}

checkGameIssues().catch(console.error);
