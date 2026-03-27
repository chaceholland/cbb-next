#!/usr/bin/env node
/**
 * Fix Arkansas headshots by fetching individual player profile pages.
 * Photos are hosted on wp-content/uploads — only on individual profile pages.
 * Uses profile_url from ~/baseball-scrape-results/arkansas/roster.json,
 * falling back to slug construction from name.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TEAM_ID = '58';
const BASE = 'https://arkansasrazorbacks.com/roster';

const normName = n => n ? n.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim() : '';

const nameToSlug = name => name.toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .trim();

async function getPhotoFromProfilePage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    return await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      // Prefer WP-uploaded player photos (look for BSB in URL or player name in alt)
      const player = imgs.find(i =>
        i.src && i.src.includes('wp-content/uploads') &&
        (i.src.includes('BSB') || i.src.includes('baseball')) &&
        !i.src.includes('logo') && !i.src.includes('brand')
      );
      if (player) return player.src;
      // Fallback: any WP upload that isn't a logo/banner
      const any = imgs.find(i =>
        i.src && i.src.includes('wp-content/uploads') &&
        !i.src.includes('logo') && !i.src.includes('brand') &&
        !i.src.includes('sponsor') && !i.src.includes('stadium')
      );
      return any?.src || null;
    });
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('⚾ FIXING ARKANSAS HEADSHOTS\n');

  // Load scrape data for name→URL mapping
  const scrapeFile = join(os.homedir(), 'baseball-scrape-results/arkansas/roster.json');
  const scrapeData = JSON.parse(readFileSync(scrapeFile, 'utf8'));
  const urlMap = new Map(
    scrapeData.athletes
      .filter(a => a.profile_url)
      .map(a => [normName(a.name), a.profile_url])
  );
  console.log(`Profile URLs from scrape: ${urlMap.size}`);

  // Get DB pitchers missing headshots
  const { data: missing } = await supabase
    .from('cbb_pitchers')
    .select('pitcher_id, name')
    .eq('team_id', TEAM_ID)
    .or('headshot.is.null,headshot.eq.');

  console.log(`Pitchers missing headshots: ${missing?.length || 0}`);
  if (!missing?.length) { console.log('Nothing to update'); return; }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let updated = 0;
  for (const pitcher of missing) {
    const key = normName(pitcher.name);
    // Try scrape URL first, then construct from name
    const profileUrl = urlMap.get(key) || `${BASE}/${nameToSlug(pitcher.name)}/`;

    const photo = await getPhotoFromProfilePage(page, profileUrl);
    if (photo) {
      const { error } = await supabase
        .from('cbb_pitchers')
        .update({ headshot: photo })
        .eq('pitcher_id', pitcher.pitcher_id);
      if (!error) {
        console.log(`  ✅ ${pitcher.name}`);
        updated++;
      }
    } else {
      console.log(`  ⚠️  ${pitcher.name} — no photo (${profileUrl})`);
    }
  }

  await page.close();
  await browser.close();

  console.log(`\n✅ Updated ${updated} Arkansas headshots`);
}

main().catch(console.error);
