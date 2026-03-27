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

// Load teams.json from old tracker
const teamsData = JSON.parse(fs.readFileSync('../CBB/data/teams.json', 'utf8'));

async function main() {
  console.log('Seeding all teams to cbb_teams table...\n');

  const teamsToInsert = teamsData.teams
    .filter(t => t.logo && t.logo.startsWith('/logos/')) // Only teams with local logos
    .map(t => ({
      team_id: t.id,
      name: t.name,
      display_name: t.shortName || t.name,
      conference: t.conference || null,
      logo: t.logo.split('?')[0] // Remove version parameter
    }));

  console.log(`Total teams to insert: ${teamsToInsert.length}\n`);

  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < teamsToInsert.length; i += batchSize) {
    const batch = teamsToInsert.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('cbb_teams')
      .upsert(batch, { onConflict: 'team_id' })
      .select();

    if (error) {
      console.error(`Batch ${i / batchSize + 1} error:`, error);
    } else {
      const count = data.length;
      inserted += count;
      process.stdout.write(`\r  Processed: ${Math.min(i + batchSize, teamsToInsert.length)}/${teamsToInsert.length}`);
    }
  }

  console.log(`\n\n✅ Done!`);
  console.log(`Total teams in database: ${inserted}`);
}

main().catch(console.error);
