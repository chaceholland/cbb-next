import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const searchTerms = ['Cincinnati', 'California', 'Missouri', 'Purdue', 'Duke'];

console.log('\nSearching for teams:\n');

for (const term of searchTerms) {
  const { data, error } = await supabase
    .from('cbb_teams')
    .select('team_id, name')
    .ilike('name', `%${term}%`);

  if (!error && data.length > 0) {
    data.forEach(team => {
      console.log(`${team.name.padEnd(30)} | team_id: ${team.team_id}`);
    });
  } else {
    console.log(`${term.padEnd(30)} | NOT FOUND`);
  }
}
