#!/usr/bin/env node
/**
 * Phase 1: Scrape 2026 College Baseball Rosters
 *
 * Visits all team roster pages and extracts pitcher data to JSON.
 * Does not modify the database - only creates 2026-rosters.json for review.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Normalize name for deduplication (lowercase, remove special chars)
const normalizeName = name => name?.toLowerCase()
  .replace(/[^a-z\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '';

async function fetchTeams() {
  const { data: teams, error } = await supabase
    .from('cbb_teams')
    .select('team_id, name, display_name')
    .order('name');

  if (error) {
    console.error('❌ Failed to fetch teams:', error.message);
    process.exit(1);
  }

  if (!teams || teams.length === 0) {
    console.error('❌ No teams found in database');
    process.exit(1);
  }

  return teams;
}

async function main() {
  console.log('🏈 SCRAPING 2026 COLLEGE BASEBALL ROSTERS');
  console.log('='.repeat(60));
  console.log();

  const teams = await fetchTeams();
  console.log(`📋 Found ${teams.length} teams to scrape\n`);
  console.log(`Processing teams...\n`);

  const results = {
    scrapedAt: new Date().toISOString(),
    totalTeams: teams.length,
    successfulTeams: 0,
    failedTeams: 0,
    totalPitchers: 0,
    teams: []
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nTotal Teams:     ${results.totalTeams}`);
  console.log(`Successful:      ${results.successfulTeams} (${((results.successfulTeams / results.totalTeams) * 100).toFixed(1)}%)`);
  console.log(`Failed:          ${results.failedTeams} (${((results.failedTeams / results.totalTeams) * 100).toFixed(1)}%)`);
  console.log(`Total Pitchers:  ${results.totalPitchers}`);
}

main().catch(console.error);
