import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data: participation } = await supabase
  .from('cbb_pitcher_participation')
  .select('*')
  .limit(1);

console.log('pitcher_participation:', participation?.[0] ? Object.keys(participation[0]).join(', ') : 'No data');

const { data: games } = await supabase
  .from('cbb_games')
  .select('*')
  .limit(1);

console.log('cbb_games:', games?.[0] ? Object.keys(games[0]).join(', ') : 'No data');
