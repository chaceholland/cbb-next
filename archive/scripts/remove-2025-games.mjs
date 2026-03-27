import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function remove2025Games() {
  console.log('🗑️  Removing 2025 season games from database...\n');

  // First, count 2025 games
  const { count: count2025, error: countError } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true })
    .gte('date', '2025-01-01')
    .lt('date', '2026-01-01');

  if (countError) {
    console.error('Error counting 2025 games:', countError);
    process.exit(1);
  }

  console.log(`Found ${count2025} games from 2025 season`);

  if (count2025 === 0) {
    console.log('✅ No 2025 games to remove. Database is clean!');
    return;
  }

  // Show sample of games to be deleted
  const { data: sampleGames } = await supabase
    .from('cbb_games')
    .select('game_id, date, home_name, away_name')
    .gte('date', '2025-01-01')
    .lt('date', '2026-01-01')
    .limit(5);

  console.log('\nSample of games to be deleted:');
  sampleGames?.forEach(g => {
    console.log(`  - ${g.date.split('T')[0]}: ${g.away_name} @ ${g.home_name} (ID: ${g.game_id})`);
  });

  console.log(`\n⚠️  About to delete ${count2025} games from 2025 season...`);

  // Delete 2025 games
  const { error: deleteError, count: deletedCount } = await supabase
    .from('cbb_games')
    .delete({ count: 'exact' })
    .gte('date', '2025-01-01')
    .lt('date', '2026-01-01');

  if (deleteError) {
    console.error('❌ Error deleting 2025 games:', deleteError);
    process.exit(1);
  }

  console.log(`\n✅ Successfully deleted ${deletedCount} games from 2025 season`);

  // Verify deletion
  const { count: remainingCount } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true })
    .gte('date', '2025-01-01')
    .lt('date', '2026-01-01');

  console.log(`\nVerification: ${remainingCount} 2025 games remaining (should be 0)`);

  // Show current database stats
  const { count: total } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true });

  const { count: count2026 } = await supabase
    .from('cbb_games')
    .select('*', { count: 'exact', head: true })
    .gte('date', '2026-01-01')
    .lt('date', '2027-01-01');

  console.log('\n📊 Current database stats:');
  console.log(`  Total games: ${total}`);
  console.log(`  2026 games: ${count2026}`);
  console.log(`  Other years: ${total - count2026}`);
}

remove2025Games().catch(console.error);
