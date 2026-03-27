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

// Load the 64 tracked teams from pitchers.json
const pitchersData = JSON.parse(fs.readFileSync('../CBB/data/pitchers.json', 'utf8'));

async function main() {
  console.log('Resetting cbb_teams to 64 tracked teams from pitchers.json...\n');

  const teamsToUpsert = pitchersData.teams.map(t => ({
    team_id: String(t.teamId || t.team_id),
    name: t.team || t.name,
    display_name: t.team || t.name,
    conference: t.conference || null,
    logo: (t.logo || '').split('?')[0] // Remove version parameter
  }));

  console.log(`Upserting ${teamsToUpsert.length} teams...\n`);

  const { data, error } = await supabase
    .from('cbb_teams')
    .upsert(teamsToUpsert, { onConflict: 'team_id' })
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`✅ Updated ${data.length} teams`);

    // Verify count
    const { count } = await supabase
      .from('cbb_teams')
      .select('*', { count: 'exact', head: true });

    console.log(`Total teams in database: ${count}`);
  }
}

main().catch(console.error);
