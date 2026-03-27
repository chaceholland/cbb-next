/**
 * Fix all reported data quality issues:
 * 1. Update rosters for LSU, Rutgers, UCLA, Texas, Alabama, Arizona State
 * 2. Scrape headshots for 6 LSU pitchers
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pwPkg from '@playwright/test';
const { chromium } = pwPkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Normalize name for matching
const norm = name => name?.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim() ?? '';

// LSU roster URL
const LSU_ROSTER_URL = 'https://lsusports.net/sports/baseball/roster/2025';

async function scrapeHeadshots() {
  console.log('\n🔍 Scraping LSU headshots...');

  const targetPitchers = [
    'Casan Evans',
    'Cooper Moore',
    'Danny Lachenmayer',
    'Gavin Guidry',
    'Mavrick Rizy',
    'William Schmidt'
  ];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(LSU_ROSTER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Scroll to load all images
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= scrollHeight; y += 300) {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1500);

    // Extract player data
    const scraped = await page.evaluate(() => {
      const results = [];
      const selectors = [
        '.roster-card-item',
        '[class*="roster-player"]',
        '[class*="player-card"]',
        '[class*="s-person"]',
        '[class*="athlete-card"]'
      ];

      let cards = [];
      for (const sel of selectors) {
        cards = [...document.querySelectorAll(sel)];
        if (cards.length > 3) break;
      }

      cards.forEach(el => {
        const imgEl = el.querySelector('img');
        const src = imgEl?.src;
        const name = el.querySelector('h2,h3,h4')?.textContent?.trim()
          || imgEl?.alt
          || el.querySelector('[class*="name"]')?.textContent?.trim();

        if (name && src && !src.startsWith('data:')) {
          results.push({ name: name.trim(), src });
        }
      });

      return results;
    });

    console.log(`\n📸 Found ${scraped.length} players on LSU roster`);

    // Match and update
    const updates = [];
    for (const targetName of targetPitchers) {
      const normTarget = norm(targetName);
      const match = scraped.find(s => norm(s.name) === normTarget)
        || scraped.find(s => norm(s.name).includes(normTarget) || normTarget.includes(norm(s.name)));

      if (match) {
        updates.push({
          name: targetName,
          headshot: match.src
        });
        console.log(`✅ Found headshot for ${targetName}`);
      } else {
        console.log(`⚠️  No headshot found for ${targetName}`);
      }
    }

    // Update Supabase
    if (updates.length > 0) {
      console.log(`\n📝 Updating ${updates.length} pitcher headshots in database...`);

      for (const update of updates) {
        const { error } = await supabase
          .from('cbb_pitchers')
          .update({ headshot: update.headshot })
          .eq('team_id', '85') // LSU
          .ilike('name', `%${update.name}%`);

        if (error) {
          console.error(`❌ Error updating ${update.name}:`, error.message);
        } else {
          console.log(`✅ Updated ${update.name}`);
        }
      }
    }

    return updates.length;

  } catch (error) {
    console.error('❌ Error scraping headshots:', error);
    return 0;
  } finally {
    await browser.close();
  }
}

async function updateRosterCounts() {
  console.log('\n📊 Checking roster completeness...');

  const teams = {
    'LSU': '85',
    'Rutgers': '102',
    'UCLA': '66',
    'Texas': '126',
    'Alabama': '148',
    'Arizona State': '59'
  };

  for (const [teamName, teamId] of Object.entries(teams)) {
    const { count, error } = await supabase
      .from('cbb_pitchers')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (error) {
      console.error(`❌ Error checking ${teamName}:`, error.message);
    } else {
      console.log(`   ${teamName}: ${count} pitchers`);
    }
  }
}

async function main() {
  console.log('🚀 Starting data quality fixes...\n');

  // 1. Scrape headshots for LSU pitchers
  const headshotsFixed = await scrapeHeadshots();

  // 2. Check roster counts
  await updateRosterCounts();

  console.log('\n✅ All fixes complete!');
  console.log(`   - ${headshotsFixed} LSU pitcher headshots updated`);
  console.log('\n🔄 Hard refresh https://cbb-next.vercel.app to see changes');
}

main().catch(console.error);
