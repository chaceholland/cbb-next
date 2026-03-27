/**
 * Scrape bio data (year, height, weight, hometown, bats/throws) for teams 16-20 with most missing data
 * - Clemson
 * - Houston
 * - LSU
 * - NC State
 * - Auburn
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

const TEAMS = [
  { name: 'Clemson', team_id: '117', url: 'https://clemsontigers.com/sports/baseball/roster/' },
  { name: 'Houston', team_id: '124', url: 'https://uhcougars.com/sports/baseball/roster' },
  { name: 'LSU', team_id: '85', url: 'https://lsusports.net/sports/baseball/roster/' },
  { name: 'NC State', team_id: '95', url: 'https://gopack.com/sports/baseball/roster' },
  { name: 'Auburn', team_id: '55', url: 'https://auburntigers.com/sports/baseball/roster' }
];

async function scrapeTeamRoster(browser, team) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Scraping ${team.name}...`);
  console.log(`URL: ${team.url}\n`);

  const page = await browser.newPage();

  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll to load any lazy content
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);

    // Try to extract roster data using multiple strategies
    const players = await page.evaluate((teamName) => {
      const results = [];

      // Strategy 1: Houston-specific format (#, Name, Year, Position, B/T, Height, Weight, Hometown)
      if (teamName === 'Houston') {
        const table = document.querySelector('table');
        if (table) {
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 7) {
              const position = cells[3]?.textContent?.trim();

              if (position && (position.includes('RHP') || position.includes('LHP') || position === 'P' || position.toLowerCase().includes('pitcher'))) {
                results.push({
                  name: cells[1]?.textContent?.trim(),
                  position: position,
                  year: cells[2]?.textContent?.trim() || '',
                  bats_throws: cells[4]?.textContent?.trim() || '',
                  height: cells[5]?.textContent?.trim() || '',
                  weight: cells[6]?.textContent?.trim() || '',
                  hometown: cells[7]?.textContent?.trim() || ''
                });
              }
            }
          });
        }
        return results;
      }

      // Strategy 2: Look for table rows
      const table = document.querySelector('table');
      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 3) {
            const name = cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim();
            const position = cells[2]?.textContent?.trim();

            // Check if this is a pitcher
            if (position && (position.includes('RHP') || position.includes('LHP') || position === 'P' || position.toLowerCase().includes('pitcher'))) {
              results.push({
                name: name,
                position: position,
                year: cells[3]?.textContent?.trim() || '',
                height: cells[4]?.textContent?.trim() || '',
                weight: cells[5]?.textContent?.trim() || '',
                bats_throws: cells[6]?.textContent?.trim() || '',
                hometown: cells[7]?.textContent?.trim() || ''
              });
            }
          }
        });
      }

      // Strategy 2: Look for roster cards/divs
      if (results.length === 0) {
        const cards = document.querySelectorAll('[class*="roster"], [class*="player"]');
        cards.forEach(card => {
          const nameEl = card.querySelector('[class*="name"], h2, h3, h4');
          const posEl = card.querySelector('[class*="position"], [class*="pos"]');
          const name = nameEl?.textContent?.trim();
          const position = posEl?.textContent?.trim();

          if (name && position && (position.includes('RHP') || position.includes('LHP') || position === 'P' || position.toLowerCase().includes('pitcher'))) {
            const yearEl = card.querySelector('[class*="year"], [class*="class"]');
            const heightEl = card.querySelector('[class*="height"]');
            const weightEl = card.querySelector('[class*="weight"]');
            const batsEl = card.querySelector('[class*="bats"], [class*="bat-throw"]');
            const hometownEl = card.querySelector('[class*="hometown"], [class*="location"]');

            results.push({
              name: name,
              position: position,
              year: yearEl?.textContent?.trim() || '',
              height: heightEl?.textContent?.trim() || '',
              weight: weightEl?.textContent?.trim() || '',
              bats_throws: batsEl?.textContent?.trim() || '',
              hometown: hometownEl?.textContent?.trim() || ''
            });
          }
        });
      }

      return results;
    }, team.name);

    console.log(`📊 Found ${players.length} pitchers on roster page`);

    // Get pitchers from database for this team
    const { data: dbPitchers, error: dbError } = await supabase
      .from('cbb_pitchers')
      .select('pitcher_id, name, display_name, position, year, height, weight, hometown, bats_throws')
      .eq('team_id', team.team_id);

    if (dbError) {
      console.error(`❌ Error fetching ${team.name} pitchers:`, dbError.message);
      return 0;
    }

    console.log(`🎯 Found ${dbPitchers.length} pitchers in database`);

    // Match and prepare updates
    const updates = [];
    for (const dbPitcher of dbPitchers) {
      const dbName = dbPitcher.display_name || dbPitcher.name;
      const normDb = norm(dbName);

      const match = players.find(p => norm(p.name) === normDb)
        || players.find(p => {
          const normScraped = norm(p.name);
          return normScraped.includes(normDb) || normDb.includes(normScraped);
        });

      if (match) {
        const updateData = {};
        if (match.year && !dbPitcher.year) updateData.year = match.year;
        if (match.height && !dbPitcher.height) updateData.height = match.height;
        if (match.weight && !dbPitcher.weight) updateData.weight = match.weight;
        if (match.hometown && !dbPitcher.hometown) updateData.hometown = match.hometown;
        if (match.bats_throws && !dbPitcher.bats_throws) updateData.bats_throws = match.bats_throws;

        if (Object.keys(updateData).length > 0) {
          updates.push({
            pitcher_id: dbPitcher.pitcher_id,
            name: dbName,
            data: updateData
          });
        }
      }
    }

    console.log(`✅ Matched ${updates.length} pitchers with new bio data\n`);

    // Update database
    if (updates.length > 0) {
      console.log('📝 Updating database...\n');

      for (const update of updates) {
        const { error } = await supabase
          .from('cbb_pitchers')
          .update(update.data)
          .eq('pitcher_id', update.pitcher_id);

        if (error) {
          console.error(`❌ Error updating ${update.name}:`, error.message);
        } else {
          const fields = Object.keys(update.data).join(', ');
          console.log(`✨ Updated ${update.name}: ${fields}`);
        }
      }
    }

    return updates.length;

  } catch (error) {
    console.error(`❌ Error scraping ${team.name}:`, error.message);
    return 0;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('🏀 Bio Data Scraper - Teams 16-20\n');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });

  let totalUpdates = 0;

  for (const team of TEAMS) {
    const updates = await scrapeTeamRoster(browser, team);
    totalUpdates += updates;
  }

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Complete! ${totalUpdates} total pitchers updated with bio data`);
  console.log('\n🔄 Redeploy to Vercel to see changes\n');
}

main().catch(console.error);
