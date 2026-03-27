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
  const { data, error } = await supabase
    .from('cbb_teams')
    .select('team_id, name, logo')
    .order('team_id')
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample teams:');
    data.forEach(t => console.log(`  ${t.team_id}: ${t.name} -> ${t.logo}`));
  }
}

main().catch(console.error);
