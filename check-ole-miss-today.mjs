import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkOleMissToday() {
  console.log('🔍 Checking Ole Miss games for Feb 18, 2026...\n');

  // Get Ole Miss games for today (Feb 18)
  const { data: todayGames, error } = await supabase
    .from('cbb_games')
    .select('*')
    .gte('date', '2026-02-18')
    .lt('date', '2026-02-19')
    .or('home_team_id.eq.92,away_team_id.eq.92');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${todayGames?.length || 0} Ole Miss games on Feb 18:\n`);
  todayGames?.forEach(g => {
    console.log(`Game ID: ${g.game_id}`);
    console.log(`  ${g.away_name} (${g.away_team_id}) @ ${g.home_name} (${g.home_team_id})`);
    console.log(`  Date: ${g.date}`);
    console.log(`  Venue: ${g.venue || 'NULL'}`);
    console.log(`  Status: ${g.status || 'NULL'}`);
    console.log('');
  });

  // Also check for Miami games today
  const { data: miamiGames } = await supabase
    .from('cbb_games')
    .select('*')
    .gte('date', '2026-02-18')
    .lt('date', '2026-02-19')
    .or('home_team_id.eq.176,away_team_id.eq.176');

  console.log(`\nFound ${miamiGames?.length || 0} Miami games on Feb 18:\n`);
  miamiGames?.forEach(g => {
    console.log(`Game ID: ${g.game_id}`);
    console.log(`  ${g.away_name} (${g.away_team_id}) @ ${g.home_name} (${g.home_team_id})`);
    console.log(`  Date: ${g.date}`);
    console.log('');
  });

  // Check what ESPN says Ole Miss is playing today
  console.log('\n🌐 Checking ESPN API for Ole Miss today...\n');

  const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/92/schedule?dates=2026');
  const data = await response.json();
  const events = data.events || [];

  const todayESPN = events.filter(e => e.date.startsWith('2026-02-18'));

  console.log(`ESPN shows ${todayESPN.length} Ole Miss games on Feb 18:\n`);
  todayESPN.forEach(event => {
    const comp = event.competitions[0];
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    console.log(`  ${away.team.displayName} @ ${home.team.displayName}`);
    console.log(`  ESPN Game ID: ${event.id}`);
    console.log('');
  });
}

checkOleMissToday().catch(console.error);
