#!/usr/bin/env node
/**
 * Rescrape specific teams for data quality issues
 * - Rutgers: headshots
 * - Texas: all data
 * - Alabama: pitcher numbers
 * - Arizona State: all data
 * - West Virginia: specific pitchers
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

const TEAM_URLS = {
  'Rutgers': 'https://scarletknights.com/sports/baseball/roster',
  'Texas': 'https://texassports.com/sports/baseball/roster',
  'Alabama': 'https://rolltide.com/sports/baseball/roster',
  'Arizona State': 'https://thesundevils.com/sports/baseball/roster',
  'West Virginia': 'https://wvusports.com/sports/baseball/roster',
};

const normalizeName = name => name?.toLowerCase()
  .replace(/\s*-\s*p\s*/g, ' ')
  .replace(/[^a-z\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '';

async function scrapeTeamData(browser, teamName, pitchers, options = {}) {
  const { headshotsOnly = false, numbersOnly = false, specificPitchers = null } = options;

  const url = TEAM_URLS[teamName];
  if (!url) {
    console.log(`  ⏭️  No URL configured for ${teamName}`);
    return { updated: 0, skipped: pitchers.length };
  }

  console.log(`\n  Visiting: ${url}\n`);

  const page = await browser.newPage();
  const results = { updated: 0, skipped: 0 };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const rosterData = await page.evaluate(() => {
      const players = [];
      const tables = document.querySelectorAll('table');

      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        if (rows.length === 0) continue;

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td, th'));
          if (cells.length < 4) continue;

          const cellTexts = cells.map(c => c.textContent?.trim() || '');

          // Find name and headshot
          let name = null, headshot = null, number = null;

          for (let i = 0; i < cells.length && i < 5; i++) {
            const cell = cells[i];
            const text = cellTexts[i];

            // Jersey number (first column, 1-2 digits)
            if (i === 0 && /^\d{1,2}$/.test(text)) {
              number = text;
            }

            // Skip if it's just a number
            if (/^\d{1,3}$/.test(text)) continue;

            // Look for name with link or headshot
            const link = cell.querySelector('a[href*="/roster/"], a[href*="/player/"]');
            const img = cell.querySelector('img');

            if (link || (text.split(' ').length >= 2 && text.split(' ').length <= 4 && text.length > 5)) {
              name = text;

              // Try to find headshot
              if (img) {
                const src = img.getAttribute('src');
                if (src && !src.includes('logo') && !src.includes('team')) {
                  headshot = src;
                }
              }
              break;
            }
          }

          if (!name) continue;

          // Parse remaining data
          let height = null, weight = null, year = null, hometown = null, batsThrows = null, position = null;

          for (let i = 0; i < cellTexts.length; i++) {
            const text = cellTexts[i];
            if (!text) continue;

            const label = cells[i].getAttribute('data-label')?.toLowerCase() || '';

            if (label.includes('height') || label.includes('ht')) {
              height = text;
            } else if (label.includes('weight') || label.includes('wt')) {
              weight = text;
            } else if (label.includes('year') || label.includes('class') || label.includes('yr')) {
              year = text;
            } else if (label.includes('hometown') || label.includes('home')) {
              hometown = text;
            } else if (label.includes('b/t') || (label.includes('bat') && label.includes('throw'))) {
              batsThrows = text;
            } else if (label.includes('pos')) {
              position = text;
            } else {
              if (!height && /\d+[-']\s*\d+/.test(text)) {
                height = text;
              } else if (!weight && /^(1[5-9]\d|[2-3]\d{2})(\s*lbs?)?$/i.test(text)) {
                weight = text;
              } else if (!year && /^(r-)?(fr|so|jr|sr|freshman|sophomore|junior|senior)\.?$/i.test(text)) {
                year = text;
              } else if (!batsThrows && /^[LR][-\/][LR]$/i.test(text)) {
                batsThrows = text;
              } else if (!position && /^(P|RHP|LHP|C|1B|2B|3B|SS|OF|INF|UTIL)$/i.test(text)) {
                position = text;
              } else if (!hometown && text.length > 10 && (text.includes(',') || text.includes('/'))) {
                hometown = text;
              }
            }
          }

          players.push({
            name,
            number,
            headshot,
            height,
            weight,
            year,
            hometown,
            batsThrows,
            position
          });
        }

        if (players.length > 0) break;
      }

      return players;
    });

    console.log(`Found ${rosterData.length} players on roster page\n`);

    if (rosterData.length === 0) {
      console.log(`⚠️  No data found on roster page\n`);
      results.skipped = pitchers.length;
      await page.close();
      return results;
    }

    console.log('Matching pitchers and updating database:\n');

    // Filter pitchers if only specific ones requested
    let pitchersToUpdate = pitchers;
    if (specificPitchers) {
      pitchersToUpdate = pitchers.filter(p =>
        specificPitchers.some(name => normalizeName(p.name) === normalizeName(name))
      );
    }

    for (const pitcher of pitchersToUpdate) {
      const normalizedPitcherName = normalizeName(pitcher.name);

      const matches = rosterData.filter(player => {
        const normalizedPlayerName = normalizeName(player.name);
        return normalizedPlayerName === normalizedPitcherName;
      });

      if (matches.length === 0) {
        console.log(`  ⏭️  ${pitcher.name}: No match found`);
        results.skipped++;
        continue;
      }

      const match = matches[0];
      const updates = {};

      // Update based on options
      if (headshotsOnly) {
        if (!pitcher.headshot && match.headshot) {
          updates.headshot = match.headshot;
        }
      } else if (numbersOnly) {
        if (!pitcher.number && match.number) {
          updates.number = match.number;
        }
      } else {
        // Update all fields
        if (!pitcher.headshot && match.headshot) updates.headshot = match.headshot;
        if (!pitcher.number && match.number) updates.number = match.number;
        if (!pitcher.height && match.height) updates.height = match.height;
        if (!pitcher.weight && match.weight) updates.weight = match.weight;
        if (!pitcher.year && match.year) updates.year = match.year;
        if (!pitcher.hometown && match.hometown) updates.hometown = match.hometown;
        if (!pitcher.bats_throws && match.batsThrows) updates.bats_throws = match.batsThrows;
        if (!pitcher.position && match.position) updates.position = match.position;
      }

      if (Object.keys(updates).length === 0) {
        console.log(`  ⏭️  ${pitcher.name}: No new data to add`);
        results.skipped++;
        continue;
      }

      const { error } = await supabase
        .from('cbb_pitchers')
        .update(updates)
        .eq('pitcher_id', pitcher.pitcher_id);

      if (error) {
        console.log(`  ❌ ${pitcher.name}: Update failed - ${error.message}`);
      } else {
        const updatedFields = Object.keys(updates).join(', ');
        console.log(`  ✅ ${pitcher.name}: Updated ${updatedFields}`);
        results.updated++;
      }
    }

    await page.close();
  } catch (error) {
    console.error(`  ❌ Error scraping ${teamName}:`, error.message);
    await page.close();
  }

  return results;
}

async function main() {
  console.log('🔍 Starting targeted rescraping for specific teams\n');
  console.log('='.repeat(80));

  // Get team data
  const { data: teams } = await supabase.from('cbb_teams').select('*');
  const teamMap = new Map(teams.map(t => [t.name || t.display_name, t.team_id]));

  const browser = await chromium.launch({ headless: true });

  // Rutgers - headshots only
  console.log('\n\n📸 RUTGERS - Rescraping headshots');
  console.log('='.repeat(80));
  const rutgersId = teamMap.get('Rutgers');
  if (rutgersId) {
    const { data: rutgersPitchers } = await supabase
      .from('cbb_pitchers')
      .select('*')
      .eq('team_id', rutgersId)
      .is('headshot', null);

    console.log(`Found ${rutgersPitchers.length} Rutgers pitchers missing headshots`);
    const r1 = await scrapeTeamData(browser, 'Rutgers', rutgersPitchers, { headshotsOnly: true });
    console.log(`\n📊 Rutgers: ${r1.updated} updated, ${r1.skipped} skipped`);
  }

  // Texas - all data
  console.log('\n\n🤠 TEXAS - Rescraping all data');
  console.log('='.repeat(80));
  const texasId = teamMap.get('Texas');
  if (texasId) {
    const { data: texasPitchers } = await supabase
      .from('cbb_pitchers')
      .select('*')
      .eq('team_id', texasId);

    console.log(`Found ${texasPitchers.length} Texas pitchers`);
    const r2 = await scrapeTeamData(browser, 'Texas', texasPitchers);
    console.log(`\n📊 Texas: ${r2.updated} updated, ${r2.skipped} skipped`);
  }

  // Alabama - numbers only
  console.log('\n\n🐘 ALABAMA - Rescraping pitcher numbers');
  console.log('='.repeat(80));
  const alabamaId = teamMap.get('Alabama');
  if (alabamaId) {
    const { data: alabamaPitchers } = await supabase
      .from('cbb_pitchers')
      .select('*')
      .eq('team_id', alabamaId)
      .is('number', null);

    console.log(`Found ${alabamaPitchers.length} Alabama pitchers missing numbers`);
    const r3 = await scrapeTeamData(browser, 'Alabama', alabamaPitchers, { numbersOnly: true });
    console.log(`\n📊 Alabama: ${r3.updated} updated, ${r3.skipped} skipped`);
  }

  // Arizona State - all data
  console.log('\n\n🔱 ARIZONA STATE - Rescraping all data');
  console.log('='.repeat(80));
  const asuId = teamMap.get('Arizona State');
  if (asuId) {
    const { data: asuPitchers } = await supabase
      .from('cbb_pitchers')
      .select('*')
      .eq('team_id', asuId);

    console.log(`Found ${asuPitchers.length} Arizona State pitchers`);
    const r4 = await scrapeTeamData(browser, 'Arizona State', asuPitchers);
    console.log(`\n📊 Arizona State: ${r4.updated} updated, ${r4.skipped} skipped`);
  }

  // West Virginia - specific pitchers
  console.log('\n\n⛰️  WEST VIRGINIA - Rescraping specific pitchers');
  console.log('='.repeat(80));
  const wvuId = teamMap.get('West Virginia');
  if (wvuId) {
    const { data: wvuPitchers } = await supabase
      .from('cbb_pitchers')
      .select('*')
      .eq('team_id', wvuId);

    const specificPitchers = [
      'Benjamin - P Hudson',
      'Cole Fehrman',
      'Griffin Kirn',
      'Jack Kartsonas',
      'Robby Porco'
    ];

    console.log(`Targeting ${specificPitchers.length} specific West Virginia pitchers`);
    const r5 = await scrapeTeamData(browser, 'West Virginia', wvuPitchers, { specificPitchers });
    console.log(`\n📊 West Virginia: ${r5.updated} updated, ${r5.skipped} skipped`);
  }

  await browser.close();

  console.log('\n\n' + '='.repeat(80));
  console.log('✅ TARGETED RESCRAPING COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
