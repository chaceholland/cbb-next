import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const MISSING_PLAYERS = [
  'Danny Heintz',
  'Connor Ball',
  'Beau Bryans',
  'Packy Bradley-Cooney',
  'Jackson Hunter',
  'Carson Kuehne',
  'Riley Quick',
  'Coulson Buchanan',
  'Carson Ozmer',
  'Jonathan Stevens',
  'Aeden Finateri',
  'Braylon Myers',
  'Aidan Moza',
  'Nash Wagner',
  'Ashton Alston',
  'Egan Lowery',
  'Ariston Veasey',
  'Andre Modugno'
];

async function main() {
  console.log('🗑️  Removing 18 players from Alabama roster...\n');
  
  const teamId = '148';
  let removed = 0;
  let notFound = 0;
  
  for (const playerName of MISSING_PLAYERS) {
    // Find the player in the database
    const { data: players, error: fetchError } = await supabase
      .from('cbb_pitchers')
      .select('*')
      .eq('team_id', teamId)
      .or(`name.ilike.%${playerName}%,display_name.ilike.%${playerName}%`);
    
    if (fetchError) {
      console.error(`   ❌ Error searching for ${playerName}:`, fetchError.message);
      continue;
    }
    
    if (!players || players.length === 0) {
      console.log(`   ⚠️  ${playerName} - not found in database`);
      notFound++;
      continue;
    }
    
    // Delete the player
    const player = players[0];
    const { error: deleteError } = await supabase
      .from('cbb_pitchers')
      .delete()
      .eq('pitcher_id', player.pitcher_id);
    
    if (deleteError) {
      console.error(`   ❌ Error deleting ${playerName}:`, deleteError.message);
    } else {
      console.log(`   ✅ Removed ${playerName} (${player.pitcher_id})`);
      removed++;
    }
  }
  
  console.log('\n========== SUMMARY ==========\n');
  console.log(`✅ Removed: ${removed} players`);
  console.log(`⚠️  Not found: ${notFound} players`);
  console.log(`📊 Total: ${removed + notFound} of 18 processed\n`);
  
  // Get final count
  const { count } = await supabase
    .from('cbb_pitchers')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId);
  
  console.log(`Alabama now has ${count} pitchers in the database\n`);
  console.log('✅ Cleanup complete!');
  console.log('\n🔄 Hard refresh https://cbb-next.vercel.app to see changes');
}

main().catch(console.error);
