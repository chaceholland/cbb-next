#!/usr/bin/env node
/**
 * Add Southern Miss to cbb_teams and scrape their 2026 roster
 * Team ID: 192, Conference: Sun Belt
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

const TEAM = {
  team_id: '192',
  name: 'Southern Miss Golden Eagles',
  display_name: 'Southern Miss',
  conference: 'Sun Belt',
  logo: '/logos/192.png'
};

const ROSTER_URL = 'https://southernmiss.com/sports/baseball/roster';

async function upsertTeam() {
  console.log('📋 Upserting Southern Miss into cbb_teams...');
  const { error } = await supabase
    .from('cbb_teams')
    .upsert(TEAM, { onConflict: 'team_id' });

  if (error) {
    throw new Error(`Failed to upsert team: ${error.message}`);
  }
  console.log('✅ Southern Miss added to cbb_teams\n');
}

async function scrapeRoster(browser) {
  console.log(`🌐 Scraping roster from: ${ROSTER_URL}\n`);
  const page = await browser.newPage();

  try {
    await page.goto(ROSTER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const rosterData = await page.evaluate(() => {
      const players = [];

      // PRIORITY 1: Card view (has headshots)
      const cardContainer = document.querySelector('.c-rosterpage__players--card-view');
      if (cardContainer) {
        const playerCards = cardContainer.querySelectorAll('.s-person-card');

        for (const card of playerCards) {
          const nameLink = card.querySelector('a[href*="/roster/"], a[href*="/player/"]');
          if (!nameLink) continue;

          const nameText = nameLink.textContent?.trim() || '';
          const name = nameText.replace(/Jersey Number \d+/i, '').trim();

          const img = card.querySelector('img');
          const headshot = img?.getAttribute('src') || null;

          const cardText = card.textContent || '';

          let position = null;
          const posMatch = cardText.match(/Position\s+([A-Z\/]+)/);
          if (posMatch) position = posMatch[1];

          let number = null;
          const numMatch = cardText.match(/Jersey Number\s+(\d+)/);
          if (numMatch) number = numMatch[1];

          let height = null;
          const heightMatch = cardText.match(/Height\s+([\d'"\s]+)/);
          if (heightMatch) height = heightMatch[1].trim();

          let weight = null;
          const weightMatch = cardText.match(/Weight\s+(\d+)\s*lbs/);
          if (weightMatch) weight = weightMatch[1];

          let year = null;
          const yearMatch = cardText.match(/Academic Year\s+([\w.-]+)/);
          if (yearMatch) year = yearMatch[1];

          let hometown = null;
          const hometownMatch = cardText.match(/Hometown\s+([^]+?)(?:Last School|Previous School|$)/);
          if (hometownMatch) hometown = hometownMatch[1].trim();

          let batsThrows = null;
          const btMatch = cardText.match(/\b([LR])[-\/]([LR])\b/);
          if (btMatch) batsThrows = btMatch[0];

          players.push({ name, display_name: name, number, position, headshot, height, weight, year, hometown, bats_throws: batsThrows });
        }

        return players;
      }

      // FALLBACK: Table view
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        if (rows.length === 0) continue;

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td, th'));
          if (cells.length < 3) continue;

          const cellTexts = cells.map(c => c.textContent?.trim() || '');
          let name = null, number = null, position = null, headshot = null;
          let height = null, weight = null, year = null, hometown = null, batsThrows = null;

          for (const cell of cells) {
            const link = cell.querySelector('a[href*="/roster/"], a[href*="/player/"]');
            if (link) {
              name = link.textContent?.trim();
              const img = cell.querySelector('img');
              if (img) {
                const src = img.getAttribute('src');
                if (src && !src.includes('logo') && !src.includes('team')) headshot = src;
              }
              break;
            }
          }

          if (!name) {
            for (const text of cellTexts) {
              if (!/^\d{1,3}$/.test(text) && !/^\d+[-']/.test(text) && text.split(' ').length >= 2 && text.length > 5) {
                name = text;
                break;
              }
            }
          }

          if (!name) continue;

          if (cellTexts.length > 0 && /^\d{1,2}$/.test(cellTexts[0])) number = cellTexts[0];

          for (let i = 0; i < cells.length; i++) {
            const text = cellTexts[i];
            if (!text) continue;
            const label = cells[i].getAttribute('data-label')?.toLowerCase() || '';

            if (label.includes('pos')) position = text;
            else if (label.includes('height') || label.includes('ht')) height = text;
            else if (label.includes('weight') || label.includes('wt')) weight = text;
            else if (label.includes('year') || label.includes('class') || label.includes('yr')) year = text;
            else if (label.includes('hometown') || label.includes('home')) hometown = text;
            else if (label.includes('b/t') || (label.includes('bat') && label.includes('throw'))) batsThrows = text;
            else {
              if (!position && /^(P|RHP|LHP|C|1B|2B|3B|SS|OF|INF|UTIL)$/i.test(text)) position = text;
              else if (!height && /\d+[-']\s*\d+/.test(text)) height = text;
              else if (!weight && /^(1[5-9]\d|[2-3]\d{2})(lbs?)?$/i.test(text)) weight = text.replace(/lbs?/i, '').trim();
              else if (!year && /^(r-)?(fr|so|jr|sr|freshman|sophomore|junior|senior)\.?$/i.test(text)) year = text;
              else if (!batsThrows && /^[LR][-\/][LR]$/i.test(text)) batsThrows = text;
              else if (!hometown && text.length > 10 && (text.includes(',') || text.includes('/'))) hometown = text;
            }
          }

          players.push({ name, display_name: name, number, position, headshot, height, weight, year, hometown, bats_throws: batsThrows });
        }

        if (players.length > 0) break;
      }

      return players;
    });

    await page.close();

    const pitchers = rosterData.filter(p => p.position && /^(P|RHP|LHP)$/i.test(p.position));
    console.log(`Found ${rosterData.length} total players, ${pitchers.length} pitchers\n`);

    if (pitchers.length === 0) {
      console.log('⚠️  No pitchers found. All positions found:');
      const positions = [...new Set(rosterData.map(p => p.position).filter(Boolean))];
      console.log('  ', positions.join(', ') || 'none');
    }

    return pitchers;
  } catch (err) {
    await page.close();
    throw err;
  }
}

async function insertPitchers(pitchers) {
  if (pitchers.length === 0) {
    console.log('⚠️  No pitchers to insert.\n');
    return;
  }

  // Remove any existing pitchers for this team first
  console.log('🗑️  Removing any existing Southern Miss pitchers...');
  const { error: deleteError } = await supabase
    .from('cbb_pitchers')
    .delete()
    .eq('team_id', TEAM.team_id);

  if (deleteError) {
    throw new Error(`Failed to delete existing pitchers: ${deleteError.message}`);
  }

  console.log('📥 Inserting pitchers...');
  const pitcherRecords = pitchers.map((p, i) => ({
    pitcher_id: `${TEAM.team_id}-P${i + 1}`,
    team_id: TEAM.team_id,
    name: p.name,
    display_name: p.display_name || p.name,
    number: p.number || null,
    position: p.position,
    headshot: p.headshot || null,
    height: p.height || null,
    weight: p.weight || null,
    year: p.year || null,
    hometown: p.hometown || null,
    bats_throws: p.bats_throws || null
  }));

  const { error } = await supabase.from('cbb_pitchers').insert(pitcherRecords);
  if (error) {
    throw new Error(`Failed to insert pitchers: ${error.message}`);
  }

  console.log(`✅ Inserted ${pitcherRecords.length} pitchers\n`);

  // Show what was inserted
  for (const p of pitcherRecords) {
    console.log(`  [${p.number || '--'}] ${p.name} (${p.position}) ${p.year || ''} ${p.hometown ? '— ' + p.hometown : ''}`);
  }
}

async function main() {
  console.log('⚾ Adding Southern Miss to CBB Pitcher Tracker');
  console.log('='.repeat(60));
  console.log();

  await upsertTeam();

  const browser = await chromium.launch({ headless: true });
  try {
    const pitchers = await scrapeRoster(browser);
    await insertPitchers(pitchers);
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Done! Southern Miss should now appear on Rosters page.');
  console.log('   For Schedule: run your game scraper to pick up USM games.');
  console.log('='.repeat(60));
}

main().catch(console.error);
