import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data: pitchers } = await supabase
  .from('cbb_pitchers')
  .select('*')
  .limit(1);

console.log('cbb_pitchers:', pitchers?.[0] ? Object.keys(pitchers[0]).join(', ') : 'No data');

const { data: teams } = await supabase
  .from('cbb_teams')
  .select('*')
  .limit(1);

console.log('cbb_teams:', teams?.[0] ? Object.keys(teams[0]).join(', ') : 'No data');
