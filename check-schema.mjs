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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
  console.log('🔍 Checking cbb_games table schema...\n');

  const { data, error } = await supabase
    .from('cbb_games')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('📋 Available columns in cbb_games:');
    columns.forEach(col => console.log(`  - ${col}`));

    console.log('\n🔍 Checking for scrape tracking columns:');
    const trackingCols = ['last_scrape_attempt', 'scrape_attempts', 'scrape_status'];
    trackingCols.forEach(col => {
      if (columns.includes(col)) {
        console.log(`  ✅ ${col} exists`);
      } else {
        console.log(`  ❌ ${col} missing`);
      }
    });
  } else {
    console.log('⚠️  No games found in database');
  }
}

checkSchema();
