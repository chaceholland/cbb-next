#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  console.log('Setting up scrape tracking columns...\n');

  // Check if columns already exist
  const { data: existingGames } = await supabase
    .from('cbb_games')
    .select('game_id')
    .limit(1);

  if (!existingGames) {
    console.log('❌ Could not access cbb_games table');
    return;
  }

  console.log('✅ Table access confirmed');
  console.log('\nNote: You need to run the SQL migration manually using Supabase dashboard or CLI.');
  console.log('The SQL file is: add-scrape-tracking.sql\n');

  console.log('Steps:');
  console.log('1. Go to Supabase Dashboard > SQL Editor');
  console.log('2. Copy contents of add-scrape-tracking.sql');
  console.log('3. Run the SQL');
  console.log('\nOr use Supabase CLI:');
  console.log('  supabase db push');
}

main().catch(console.error);
