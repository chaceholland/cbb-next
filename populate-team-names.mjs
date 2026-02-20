import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Cache for team names to avoid repeated API calls
const teamNameCache = {};

async function getTeamName(teamId) {
  if (teamNameCache[teamId]) {
    return teamNameCache[teamId];
  }

  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${teamId}`);
    const data = await response.json();
    const teamName = data.team?.displayName || null;
    teamNameCache[teamId] = teamName;
    return teamName;
  } catch (error) {
    console.error(`Error fetching team ${teamId}:`, error.message);
    return null;
  }
}

async function populateTeamNames() {
  console.log('🔄 Populating missing team names in cbb_games...\n');

  // Get all games with NULL team names
  const { data: nullGames, error: fetchError } = await supabase
    .from('cbb_games')
    .select('game_id, home_team_id, away_team_id, home_name, away_name')
    .or('home_name.is.null,away_name.is.null');

  if (fetchError) {
    console.error('Error fetching games:', fetchError);
    return;
  }

  console.log(`Found ${nullGames.length} games with NULL team names\n`);

  // Get unique team IDs that need names
  const teamIds = new Set();
  nullGames.forEach(game => {
    if (!game.home_name) teamIds.add(game.home_team_id);
    if (!game.away_name) teamIds.add(game.away_team_id);
  });

  console.log(`Fetching names for ${teamIds.size} unique teams...`);

  // Fetch all team names
  for (const teamId of teamIds) {
    const name = await getTeamName(teamId);
    console.log(`  Team ${teamId}: ${name || 'NOT FOUND'}`);
    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
  }

  console.log(`\n✅ Fetched ${Object.keys(teamNameCache).length} team names`);
  console.log('\n🔄 Updating games in database...\n');

  // Update games
  let updated = 0;
  let errors = 0;

  for (const game of nullGames) {
    const updates = {};

    if (!game.home_name && teamNameCache[game.home_team_id]) {
      updates.home_name = teamNameCache[game.home_team_id];
    }

    if (!game.away_name && teamNameCache[game.away_team_id]) {
      updates.away_name = teamNameCache[game.away_team_id];
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('cbb_games')
        .update(updates)
        .eq('game_id', game.game_id);

      if (updateError) {
        console.error(`Error updating game ${game.game_id}:`, updateError);
        errors++;
      } else {
        updated++;
        if (updated % 10 === 0) {
          console.log(`  Updated ${updated} games...`);
        }
      }
    }
  }

  console.log(`\n✅ Successfully updated ${updated} games`);
  if (errors > 0) {
    console.log(`❌ Failed to update ${errors} games`);
  }

  // Verify the fix
  const { count: remainingNull } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true })
    .or('home_name.is.null,away_name.is.null');

  console.log(`\n📊 Games with NULL names remaining: ${remainingNull}`);

  // Show sample of fixed games
  const { data: sampleGames } = await supabase
    .from('cbb_games')
    .select('date, home_name, away_name')
    .gte('date', '2026-02-14')
    .lt('date', '2026-02-15')
    .limit(5);

  console.log('\nSample of Feb 14 games after fix:');
  sampleGames?.forEach(g => {
    console.log(`  ${g.away_name} @ ${g.home_name}`);
  });
}

populateTeamNames().catch(console.error);
