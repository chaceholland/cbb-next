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
  console.log('Adding cache-busting version parameter to all logo URLs...\n');

  const version = Date.now();

  const { data: teams, error: fetchError } = await supabase
    .from('cbb_teams')
    .select('team_id, logo');

  if (fetchError) {
    console.error('Error fetching teams:', fetchError);
    return;
  }

  console.log(`Updating ${teams.length} teams...\n`);

  let updated = 0;
  let failed = 0;

  for (const team of teams) {
    if (!team.logo) continue;

    // Remove existing version parameter if any
    const baseLogo = team.logo.split('?')[0];
    const newLogo = `${baseLogo}?v=${version}`;

    const { error } = await supabase
      .from('cbb_teams')
      .update({ logo: newLogo })
      .eq('team_id', team.team_id);

    if (error) {
      console.log(`  ✗ ${team.team_id}: ${error.message}`);
      failed++;
    } else {
      process.stdout.write(`\r  Updated: ${++updated}/${teams.length}`);
    }
  }

  console.log(`\n\n✅ Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
}

main().catch(console.error);
