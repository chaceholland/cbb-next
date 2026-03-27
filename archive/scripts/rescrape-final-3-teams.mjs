/**
 * Fix the final 3 teams with custom scrapers
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

const norm = name => name?.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim() ?? '';

const TEAMS = [
  { name: 'California Golden Bears', team_id: '65', url: 'https://calbears.com/sports/baseball/roster' },
  { name: 'Texas A&M', team_id: '123', url: 'https://12thman.com/sports/baseball/roster' },
  { name: 'Arizona Wildcats', team_id: '60', url: 'https://arizonawildcats.com/sports/baseball/roster' }
];

async function scrapeTeamRoster(browser, team) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Scraping ${team.name}...`);
  console.log(`URL: ${team.url}\n`);

  const page = await browser.newPage();

  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('⏳ Waiting for content to load...');
    await page.waitForTimeout(8000);

    // Aggressive scrolling
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(2000);
    }

    const players = await page.evaluate((teamName) => {
      const results = [];

      // Texas A&M specific format: #, Name, Position, Height, Weight, Year, B/T, Hometown
      if (teamName === 'Texas A&M') {
        const table = document.querySelector('table');
        if (table) {
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 7) {
              const position = cells[2]?.textContent?.trim();

              if (position && (position.includes('RHP') || position.includes('LHP') || position === 'P')) {
                results.push({
                  name: cells[1]?.textContent?.trim(),
                  position: position,
                  height: cells[3]?.textContent?.trim() || '',
                  weight: cells[4]?.textContent?.trim() || '',
                  year: cells[5]?.textContent?.trim() || '',
                  bats_throws: cells[6]?.textContent?.trim() || '',
                  hometown: cells[7]?.textContent?.trim() || ''
                });
              }
            }
          });
        }
        return results;
      }

      // Standard format for California and Arizona
      const table = document.querySelector('table');
      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 3) {
            const name = cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim();
            const position = cells[2]?.textContent?.trim();

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

      return results;
    }, team.name);

    console.log(`📊 Found ${players.length} pitchers on roster page`);

    if (players.length === 0) {
      console.log('⚠️  No pitchers found - roster may not have loaded\n');
      return 0;
    }

    const { data: dbPitchers, error: dbError } = await supabase
      .from('cbb_pitchers')
      .select('pitcher_id, name, display_name, position, year, height, weight, hometown, bats_throws')
      .eq('team_id', team.team_id);

    if (dbError) {
      console.error(`❌ Error fetching ${team.name} pitchers:`, dbError.message);
      return 0;
    }

    console.log(`🎯 Found ${dbPitchers.length} pitchers in database`);

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
        if (match.position && !dbPitcher.position) updateData.position = match.position;

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
  console.log('🔧 Final 3 Teams Re-scrape\n');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });

  let totalUpdates = 0;

  for (const team of TEAMS) {
    const updates = await scrapeTeamRoster(browser, team);
    totalUpdates += updates;
  }

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Complete! ${totalUpdates} pitchers fixed`);
  console.log('\n🔄 Ready to deploy\n');
}

main().catch(console.error);
