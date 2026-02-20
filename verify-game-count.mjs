import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyGameCount() {
  console.log('📊 Verifying game counts in database...\n');

  // Get total count
  const { count: total, error: totalError } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error('Error counting total games:', totalError);
    process.exit(1);
  }

  // Get 2026 count
  const { count: count2026 } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true })
    .gte('date', '2026-01-01')
    .lt('date', '2027-01-01');

  // Get 2025 count
  const { count: count2025 } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true })
    .gte('date', '2025-01-01')
    .lt('date', '2026-01-01');

  // Get pre-2025 count
  const { count: countBefore2025 } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true })
    .lt('date', '2025-01-01');

  // Get post-2026 count
  const { count: countAfter2026 } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true })
    .gte('date', '2027-01-01');

  console.log('Game Count Breakdown:');
  console.log('─'.repeat(40));
  console.log(`Total games:        ${total}`);
  console.log(`2026 season:        ${count2026}`);
  console.log(`2025 season:        ${count2025} (should be 0)`);
  console.log(`Before 2025:        ${countBefore2025}`);
  console.log(`After 2026:         ${countAfter2026}`);
  console.log('─'.repeat(40));

  // Sample some games to see date range
  const { data: sampleGames } = await supabase
    .from('cbb_games')
    .select('game_id, date, home_name, away_name')
    .order('date', { ascending: true })
    .limit(5);

  console.log('\nEarliest 5 games:');
  sampleGames?.forEach(g => {
    console.log(`  ${g.date.split('T')[0]}: ${g.away_name} @ ${g.home_name}`);
  });

  const { data: latestGames } = await supabase
    .from('cbb_games')
    .select('game_id, date, home_name, away_name')
    .order('date', { ascending: false })
    .limit(5);

  console.log('\nLatest 5 games:');
  latestGames?.forEach(g => {
    console.log(`  ${g.date.split('T')[0]}: ${g.away_name} @ ${g.home_name}`);
  });
}

verifyGameCount().catch(console.error);
