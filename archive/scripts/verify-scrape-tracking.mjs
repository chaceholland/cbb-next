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

async function verifyTracking() {
  console.log('🔍 Verifying scrape tracking migration...\n');

  // Check for games with scrape status
  const { data: gamesWithStatus, error } = await supabase
    .from('cbb_games')
    .select('game_id, date, scrape_status, last_scrape_attempt, scrape_attempts')
    .not('scrape_status', 'is', null)
    .order('last_scrape_attempt', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${gamesWithStatus.length} games with scrape tracking data\n`);

  // Show sample of recently checked games
  console.log('📊 Recently checked games:');
  console.log('─'.repeat(100));

  gamesWithStatus.forEach(game => {
    const date = new Date(game.date).toLocaleDateString();
    const lastChecked = game.last_scrape_attempt
      ? new Date(game.last_scrape_attempt).toLocaleString()
      : 'Never';

    console.log(`Game ID: ${game.game_id} (${date})`);
    console.log(`  Status: ${game.scrape_status}`);
    console.log(`  Last checked: ${lastChecked}`);
    console.log(`  Attempts: ${game.scrape_attempts || 0}`);
    console.log('');
  });

  // Get status summary
  const { data: statusCounts } = await supabase
    .from('cbb_games')
    .select('scrape_status')
    .not('scrape_status', 'is', null);

  const summary = statusCounts.reduce((acc, game) => {
    acc[game.scrape_status] = (acc[game.scrape_status] || 0) + 1;
    return acc;
  }, {});

  console.log('─'.repeat(100));
  console.log('\n📈 Status Summary:');
  Object.entries(summary).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} games`);
  });
}

verifyTracking();
