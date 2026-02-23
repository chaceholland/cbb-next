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

async function main() {
  console.log('🔄 Updating LSU pitcher headshots to team logo...\n');

  // Get LSU team logo
  const { data: lsuTeam, error: teamError } = await supabase
    .from('cbb_teams')
    .select('logo')
    .eq('team_id', '85')
    .single();

  if (teamError || !lsuTeam) {
    console.error('❌ Error fetching LSU team:', teamError);
    process.exit(1);
  }

  console.log(`✅ LSU team logo: ${lsuTeam.logo}\n`);

  const targetPitchers = [
    'Casan Evans',
    'Cooper Moore',
    'Danny Lachenmayer',
    'Gavin Guidry',
    'Mavrick Rizy',
    'William Schmidt'
  ];

  let updated = 0;
  for (const name of targetPitchers) {
    const { error } = await supabase
      .from('cbb_pitchers')
      .update({ headshot: lsuTeam.logo })
      .eq('team_id', '85')
      .ilike('name', `%${name}%`);

    if (error) {
      console.error(`❌ Error updating ${name}:`, error.message);
    } else {
      console.log(`✅ Updated ${name} headshot to team logo`);
      updated++;
    }
  }

  console.log(`\n✅ Updated ${updated}/6 LSU pitcher headshots`);
}

main().catch(console.error);
