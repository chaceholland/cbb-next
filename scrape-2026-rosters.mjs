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

async function main() {
  console.log('🏈 SCRAPING 2026 COLLEGE BASEBALL ROSTERS');
  console.log('='.repeat(60));
  console.log();

  // TODO: Implement scraping logic
}

main().catch(console.error);
