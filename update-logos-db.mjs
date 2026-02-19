#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Updating team logos in Supabase...\n');

  const sql = fs.readFileSync('./update-team-logos.sql', 'utf8');
  const updates = sql.trim().split('\n').filter(line => line.trim());

  console.log(`Total updates: ${updates.length}\n`);

  let completed = 0;
  let failed = 0;

  for (const update of updates) {
    // Extract team_id and logo path from UPDATE statement
    const match = update.match(/logo = '([^']+)' WHERE team_id = '([^']+)'/);
    if (!match) {
      console.log('Skipping invalid line:', update);
      continue;
    }

    const [, logo, teamId] = match;

    try {
      const { error } = await supabase
        .from('cbb_teams')
        .update({ logo })
        .eq('team_id', teamId);

      if (error) throw error;
      completed++;
      process.stdout.write(`\r  Updated: ${completed}/${updates.length}`);
    } catch (err) {
      failed++;
      console.log(`\n  Failed ${teamId}:`, err.message);
    }
  }

  console.log(`\n\n✅ Completed: ${completed}`);
  console.log(`❌ Failed: ${failed}`);
}

main().catch(console.error);
