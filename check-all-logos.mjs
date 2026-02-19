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
    .select('team_id, display_name, logo')
    .order('display_name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total teams: ${data.length}\n`);

  const withLogos = data.filter(t => t.logo && t.logo.startsWith('/logos/'));
  const withoutLogos = data.filter(t => !t.logo || !t.logo.startsWith('/logos/'));

  console.log(`Teams with /logos/ paths: ${withLogos.length}`);
  console.log(`Teams without /logos/ paths: ${withoutLogos.length}\n`);

  if (withoutLogos.length > 0) {
    console.log('Teams missing logo paths:');
    withoutLogos.forEach(t => console.log(`  ${t.team_id}: ${t.display_name} -> ${t.logo || 'NULL'}`));
  }

  console.log('\nSample teams with logos:');
  withLogos.slice(0, 5).forEach(t => console.log(`  ${t.team_id}: ${t.display_name} -> ${t.logo}`));
}

main().catch(console.error);
