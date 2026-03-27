#!/usr/bin/env node
/**
 * Second-pass headshot fix for teams with unique site structures:
 *   - LSU: data-bg attribute on .thumb-image.lazy div
 *   - Kentucky: itemprop="image" content attr (duplicate URL fix)
 *   - Penn State: NUXT table, photos need JS render
 *   - Clemson: WordPress/WMT, fully JS-rendered
 *   - California, Illinois, Maryland: SIDEARM, needs Playwright render
 *   - Arkansas: No photos on roster page → scrape ESPN roster page
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const normName = name => {
  if (!name) return '';
  if (name.includes(',')) {
    const [last, first] = name.split(',').map(s => s.trim());
    name = `${first} ${last}`;
  }
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
};

function matchAndQueue(dbPitchers, scraped) {
  const map = new Map(scraped.map(p => [normName(p.name), p.headshot]));
  const updates = [];
  for (const p of dbPitchers) {
    const key = normName(p.name);
    if (map.has(key)) { updates.push({ pitcher_id: p.pitcher_id, headshot: map.get(key) }); continue; }
    const parts = key.split(' ');
    if (parts.length >= 2) {
      const last = parts[parts.length - 1], init = parts[0][0];
      for (const [sk, url] of map) {
        const sp = sk.split(' ');
        if (sp[sp.length-1] === last && sp[0][0] === init) { updates.push({ pitcher_id: p.pitcher_id, headshot: url }); break; }
      }
    }
  }
  return updates;
}

async function applyUpdates(updates) {
  let count = 0;
  for (const u of updates) {
    const { error } = await supabase.from('cbb_pitchers').update({ headshot: u.headshot }).eq('pitcher_id', u.pitcher_id);
    if (!error) count++;
  }
  return count;
}

async function getMissing(teamId) {
  const { data } = await supabase.from('cbb_pitchers').select('pitcher_id, name').eq('team_id', teamId).or('headshot.is.null,headshot.eq.');
  return data || [];
}

// ─── LSU: data-bg on .thumb-image.lazy ───────────────────────────────────────
async function scrapeLSU(page) {
  await page.goto('https://lsusports.net/sports/baseball/roster/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  return await page.evaluate(() => {
    const results = [];
    for (const item of document.querySelectorAll('.roster-list_item')) {
      const nameEl = item.querySelector('.roster-list_item_info_name');
      if (!nameEl) continue;
      const imgDiv = item.querySelector('.thumb-image[data-bg], .thumb-image.lazy[data-bg]');
      const src = imgDiv?.dataset?.bg || imgDiv?.getAttribute('data-bg');
      if (!src || src.startsWith('data:')) continue;
      // Resolve relative URLs
      const headshot = src.startsWith('http') ? src : `https://lsusports.net${src}`;
      results.push({ name: nameEl.textContent.trim(), headshot });
    }
    return results;
  });
}

// ─── Kentucky: itemprop attributes ───────────────────────────────────────────
async function scrapeKentucky(page) {
  await page.goto('https://ukathletics.com/sports/baseball/roster', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  return await page.evaluate(() => {
    const results = [];
    for (const item of document.querySelectorAll('[itemprop="athlete"], .roster__item.roster-item')) {
      const nameEl = item.querySelector('[itemprop="name"]');
      const imgEl = item.querySelector('[itemprop="image"]');
      if (!nameEl) continue;
      let src = imgEl?.getAttribute('content') || imgEl?.src;
      if (!src) continue;
      // Fix duplicate domain: "https://ukathletics.com/https://ukathletics.com/..."
      src = src.replace(/^https?:\/\/[^/]+\/https?:\/\//, 'https://');
      if (src.startsWith('data:')) continue;
      // Upgrade resolution
      src = src.replace(/\/fit\/\d+\/\d+\//, '/fit/500/500/');
      results.push({ name: nameEl.getAttribute('content') || nameEl.textContent.trim(), headshot: src });
    }
    return results;
  });
}

// ─── Penn State: NUXT table with lazy-loaded photos ──────────────────────────
async function scrapePennState(page) {
  await page.goto('https://gopsusports.com/sports/baseball/roster', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  // Scroll through the whole page to trigger lazy loading
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000);
  return await page.evaluate(() => {
    const results = [];
    // Try table rows first
    for (const row of document.querySelectorAll('tr')) {
      const nameEl = row.querySelector('.table__roster-name span, .table__roster-name a');
      if (!nameEl) continue;
      const imgEl = row.querySelector('.table__roster-photo img, img');
      const src = imgEl?.src || imgEl?.getAttribute('data-src');
      if (!src || src.startsWith('data:')) {
        // No photo loaded yet, still add without headshot to know name matched
        results.push({ name: nameEl.textContent.trim(), headshot: null });
        continue;
      }
      results.push({ name: nameEl.textContent.trim(), headshot: src });
    }
    // Also try card view
    if (results.length === 0) {
      for (const card of document.querySelectorAll('.s-person-card, .roster-card')) {
        const nameEl = card.querySelector('a[href*="/roster/"], .s-person-details__personal-single-line');
        const img = card.querySelector('img');
        if (!nameEl) continue;
        const src = img?.dataset?.src || img?.src;
        results.push({ name: nameEl.textContent.trim(), headshot: src || null });
      }
    }
    return results;
  });
}

// ─── Clemson: JS-rendered WordPress site ─────────────────────────────────────
async function scrapeClemson(page) {
  await page.goto('https://clemsontigers.com/sports/baseball/roster', { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait for content to load
  await page.waitForTimeout(6000);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(800);
  }
  return await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    // Try various card selectors
    const cards = document.querySelectorAll('.s-person-card, .roster-card, [class*="player-card"], [class*="roster-item"]');
    for (const card of cards) {
      const nameEl = card.querySelector('a[href*="/roster/"], a[href*="/player/"], h3, h4, .name');
      const img = card.querySelector('img');
      if (!nameEl) continue;
      const name = nameEl.textContent.trim();
      if (seen.has(name)) continue; seen.add(name);
      const src = img?.dataset?.src || img?.src || null;
      if (src && !src.startsWith('data:')) results.push({ name, headshot: src });
    }
    // Fallback: any link with player in href + nearby img
    if (results.length === 0) {
      for (const link of document.querySelectorAll('a[href*="/roster/"]')) {
        const name = link.textContent.trim();
        if (!name || seen.has(name) || name.length < 4) continue;
        seen.add(name);
        const container = link.closest('li, tr, article, div') || link.parentElement;
        const img = container?.querySelector('img');
        const src = img?.dataset?.src || img?.src;
        if (src && !src.startsWith('data:')) results.push({ name, headshot: src });
      }
    }
    return results;
  });
}

// ─── SIDEARM (CA, IL, MD): needs JS render ───────────────────────────────────
async function scrapeSidearm(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(700);
  }
  return await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    // Card view
    for (const card of document.querySelectorAll('.s-person-card')) {
      const nameEl = card.querySelector('a[href*="/roster/"], a[href*="/player/"]');
      if (!nameEl) continue;
      const name = nameEl.textContent.replace(/Jersey Number \d+/i, '').trim();
      if (seen.has(name)) continue; seen.add(name);
      const img = card.querySelector('img.s-person-card__photo, img');
      const src = img?.dataset?.src || img?.src;
      if (src && !src.startsWith('data:')) results.push({ name, headshot: src });
    }

    // SIDEARM table rows
    if (results.length === 0) {
      for (const row of document.querySelectorAll('.sidearm-roster-player')) {
        const nameEl = row.querySelector('.sidearm-roster-player-name a');
        if (!nameEl) continue;
        const name = nameEl.textContent.trim();
        if (seen.has(name)) continue; seen.add(name);
        const img = row.querySelector('img');
        const src = img?.dataset?.src || img?.src;
        if (src && !src.startsWith('data:')) results.push({ name, headshot: src });
      }
    }

    // .sidearm-roster-player-position style (alternate SIDEARM)
    if (results.length === 0) {
      for (const row of document.querySelectorAll('[class*="sidearm-roster-player"]')) {
        const nameEl = row.querySelector('a');
        if (!nameEl) continue;
        const name = nameEl.textContent.trim();
        if (seen.has(name) || name.length < 4) continue; seen.add(name);
        const img = row.querySelector('img');
        const src = img?.dataset?.src || img?.src;
        if (src && !src.startsWith('data:')) results.push({ name, headshot: src });
      }
    }
    return results;
  });
}

// ─── Arkansas ESPN fallback ───────────────────────────────────────────────────
// Arkansas has no photos on their roster table. Use ESPN's roster page instead.
async function scrapeArkansasESPN(page) {
  // ESPN college baseball team 8 = Arkansas
  const url = 'https://www.espn.com/college-baseball/team/roster/_/id/8';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(600);
  }
  return await page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll('tr.Table__TR');
    for (const row of rows) {
      const nameEl = row.querySelector('td a.AnchorLink');
      const imgEl = row.querySelector('img.Image, img[alt*="Headshot"], td img');
      if (!nameEl) continue;
      const name = nameEl.textContent.trim();
      const src = imgEl?.src || imgEl?.getAttribute('data-src');
      if (src && !src.includes('placeholder') && !src.startsWith('data:')) {
        // Upgrade ESPN images to hi-res
        const hiRes = src.replace(/\/w\d+\/h\d+\//, '/w500/h500/');
        results.push({ name, headshot: hiRes });
      }
    }
    return results;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🖼️  FIXING REMAINING HEADSHOTS (PASS 2)');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  let total = 0;

  const tasks = [
    { team_id: '85',  name: 'LSU',            fn: p => scrapeLSU(p) },
    { team_id: '82',  name: 'Kentucky',        fn: p => scrapeKentucky(p) },
    { team_id: '414', name: 'Penn State',      fn: p => scrapePennState(p) },
    { team_id: '117', name: 'Clemson',         fn: p => scrapeClemson(p) },
    { team_id: '65',  name: 'California',      fn: p => scrapeSidearm(p, 'https://calbears.com/sports/baseball/roster') },
    { team_id: '153', name: 'Illinois',        fn: p => scrapeSidearm(p, 'https://fightingillini.com/sports/baseball/roster') },
    { team_id: '87',  name: 'Maryland',        fn: p => scrapeSidearm(p, 'https://umterps.com/sports/baseball/roster') },
    { team_id: '58',  name: 'Arkansas (ESPN)', fn: p => scrapeArkansasESPN(p) },
  ];

  try {
    for (const task of tasks) {
      const missing = await getMissing(task.team_id);
      console.log(`\n📋 ${task.name} [${task.team_id}] — ${missing.length} missing`);
      if (missing.length === 0) { console.log('  ✅ Already complete'); continue; }

      const page = await browser.newPage();
      let scraped = [];
      try {
        scraped = await task.fn(page);
      } catch (e) {
        console.log(`  ❌ Error: ${e.message}`);
      } finally {
        await page.close().catch(() => {});
      }

      // Filter out nulls
      const withPhoto = scraped.filter(p => p.headshot);
      console.log(`  🌐 ${withPhoto.length} with photos (${scraped.length} total players)`);

      if (withPhoto.length === 0) { console.log('  ⚠️  No photos found'); continue; }

      const updates = matchAndQueue(missing, withPhoto);
      console.log(`  🔗 ${updates.length} matched`);

      if (updates.length > 0) {
        const count = await applyUpdates(updates);
        console.log(`  ✅ Updated ${count} headshots`);
        total += count;
      } else {
        console.log('  ⚠️  No name matches');
        // Show a few sample names for debugging
        console.log('  DB names:', missing.slice(0,3).map(p=>p.name).join(', '));
        console.log('  Scraped:', withPhoto.slice(0,3).map(p=>p.name).join(', '));
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total headshots updated: ${total}`);
}

main().catch(console.error);
