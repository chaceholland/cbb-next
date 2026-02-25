#!/usr/bin/env node
/**
 * Rescrape headshots for the next batch of worst teams
 * Uses improved name normalization to handle " - P" patterns
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
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

// Improved name normalization - handles " - P" patterns
const norm = name => name?.toLowerCase()
  .replace(/\s*-\s*p\s*/g, ' ')  // Remove " - P" pattern
  .replace(/[^a-z\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '';

// Next batch of worst teams
const TEAMS_CONFIG = [
  {
    team_id: '113',
    team_name: 'Oregon State',
    roster_url: 'https://osubeavers.com/sports/baseball/roster',
    missing_count: 6
  },
  {
    team_id: '52',
    team_name: 'Clemson',
    roster_url: 'https://clemsontigers.com/sports/baseball/roster',
    missing_count: 13
  },
  {
    team_id: '2579',
    team_name: 'South Carolina',
    roster_url: 'https://gamecocksonline.com/sports/baseball/roster',
    missing_count: 12
  },
  {
    team_id: '12',
    team_name: 'Arizona Wildcats',
    roster_url: 'https://arizonawildcats.com/sports/baseball/roster',
    missing_count: 9
  },
  {
    team_id: '152',
    team_name: 'NC State',
    roster_url: 'https://gopack.com/sports/baseball/roster',
    missing_count: 9
  },
  {
    team_id: '153',
    team_name: 'North Carolina',
    roster_url: 'https://goheels.com/sports/baseball/roster',
    missing_count: 8
  },
  {
    team_id: '85',
    team_name: 'Miami',
    roster_url: 'https://hurricanesports.com/sports/baseball/roster',
    missing_count: 7
  },
  {
    team_id: '66',
    team_name: 'USC',
    roster_url: 'https://usctrojans.com/sports/baseball/roster',
    missing_count: 7
  }
];

async function scrapeSchoolRosterPage(page, config) {
  try {
    console.log(`  Visiting: ${config.roster_url}`);
    await page.goto(config.roster_url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy loading
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1000);
    }

    // Extract player data - try multiple strategies
    const players = await page.evaluate(() => {
      const results = [];

      // Strategy 1: Sidearm Sports roster cards (most common format)
      const cards = document.querySelectorAll('.s-person-card, .roster-card, .sidearm-roster-player');
      for (const card of cards) {
        const nameEl = card.querySelector('.s-person-details__personal-single-line, .sidearm-roster-player-name, h3, .name');
        const imgEl = card.querySelector('img.s-person-card__photo, img.lazyload, img');
        const positionEl = card.querySelector('.s-person-details__bio-stats-item, .position');

        if (nameEl && imgEl) {
          const name = nameEl.textContent?.trim();
          const position = positionEl?.textContent?.trim() || '';
          let headshot = imgEl.dataset?.src || imgEl.src;

          // Check if it's a pitcher
          if (position && (position.includes('P') || position.includes('RHP') || position.includes('LHP'))) {
            if (headshot && !headshot.includes('placeholder') && !headshot.includes('data:image')) {
              // Clean up URL
              headshot = headshot.split('?')[0];
              results.push({ name, headshot });
            }
          }
        }
      }

      // Strategy 2: Table-based rosters
      if (results.length === 0) {
        const tables = document.querySelectorAll('table.sidearm-table, table.roster-table, table');
        for (const table of tables) {
          const rows = table.querySelectorAll('tbody tr');
          for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const nameCell = cells[1] || cells[0];
              const positionCell = cells[2] || cells[1];
              const imgEl = row.querySelector('img');

              const nameEl = nameCell.querySelector('a, span');
              const name = nameEl?.textContent?.trim();
              const position = positionCell?.textContent?.trim() || '';

              if (name && imgEl && (position.includes('P') || position.includes('RHP') || position.includes('LHP'))) {
                let headshot = imgEl.dataset?.src || imgEl.src;
                if (headshot && !headshot.includes('placeholder') && !headshot.includes('data:image')) {
                  headshot = headshot.split('?')[0];
                  results.push({ name, headshot });
                }
              }
            }
          }
        }
      }

      // Strategy 3: Link-based rosters with images
      if (results.length === 0) {
        const links = document.querySelectorAll('a[href*="/roster/"]');
        for (const link of links) {
          const imgEl = link.querySelector('img');
          const nameEl = link.querySelector('.name, h3, h4, span');

          if (imgEl && nameEl) {
            const name = nameEl.textContent?.trim();
            let headshot = imgEl.dataset?.src || imgEl.src;

            if (headshot && !headshot.includes('placeholder') && !headshot.includes('data:image')) {
              headshot = headshot.split('?')[0];
              results.push({ name, headshot });
            }
          }
        }
      }

      return results;
    });

    return players;
  } catch (error) {
    console.log(`    ⚠️  Failed to load page: ${error.message}`);
    return [];
  }
}

async function scrapeTeamHeadshots(browser, config) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 Scraping: ${config.team_name} (${config.missing_count} missing)`);
  console.log(`${'='.repeat(80)}\n`);

  // Get pitchers missing headshots
  const { data: pitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('pitcher_id, name, display_name, headshot')
    .eq('team_id', config.team_id)
    .or('headshot.is.null,headshot.eq.');

  if (error) {
    console.error(`❌ Error fetching pitchers: ${error.message}`);
    return { updated: 0, failed: 0, skipped: 0 };
  }

  if (!pitchers || pitchers.length === 0) {
    console.log('✅ No pitchers missing headshots');
    return { updated: 0, failed: 0, skipped: 0 };
  }

  console.log(`Found ${pitchers.length} pitchers missing headshots\n`);

  const page = await browser.newPage();

  // Scrape roster page
  const schoolPlayers = await scrapeSchoolRosterPage(page, config);
  console.log(`\nFound ${schoolPlayers.length} players with headshots on roster page\n`);

  if (schoolPlayers.length === 0) {
    console.log(`⚠️  No headshots found on roster page\n`);
    await page.close();
    return { updated: 0, failed: pitchers.length, skipped: 0 };
  }

  // Create name-to-headshot map
  const headshotMap = new Map();
  schoolPlayers.forEach(p => {
    headshotMap.set(norm(p.name), p.headshot);
  });

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  // Match and update
  console.log('Matching pitchers and updating database:\n');
  for (const pitcher of pitchers) {
    const pitcherName = pitcher.display_name || pitcher.name;
    const normalizedName = norm(pitcherName);

    let headshot = headshotMap.get(normalizedName);

    // Try fuzzy matching
    if (!headshot) {
      for (const [schoolName, schoolHeadshot] of headshotMap.entries()) {
        if (schoolName.includes(normalizedName) || normalizedName.includes(schoolName)) {
          headshot = schoolHeadshot;
          break;
        }
      }
    }

    if (headshot) {
      const { error: updateError } = await supabase
        .from('cbb_pitchers')
        .update({ headshot })
        .eq('pitcher_id', pitcher.pitcher_id);

      if (updateError) {
        console.log(`  ❌ ${pitcherName}: Failed to update`);
        failed++;
      } else {
        console.log(`  ✅ ${pitcherName}: Updated`);
        updated++;
      }
    } else {
      console.log(`  ⏭️  ${pitcherName}: No match found`);
      skipped++;
    }
  }

  await page.close();

  console.log(`\n📊 ${config.team_name} Summary: ${updated} updated, ${skipped} skipped, ${failed} failed\n`);

  return { updated, failed, skipped };
}

async function main() {
  console.log('🚀 Starting rescraping for next batch of worst teams\n');
  console.log(`Teams to process: ${TEAMS_CONFIG.length}`);
  console.log(`Total missing headshots: ${TEAMS_CONFIG.reduce((sum, t) => sum + t.missing_count, 0)}\n`);

  const browser = await chromium.launch({ headless: true });

  const results = {
    totalUpdated: 0,
    totalFailed: 0,
    totalSkipped: 0,
    teamResults: []
  };

  try {
    for (const config of TEAMS_CONFIG) {
      const result = await scrapeTeamHeadshots(browser, config);
      results.totalUpdated += result.updated;
      results.totalFailed += result.failed;
      results.totalSkipped += result.skipped;
      results.teamResults.push({
        team_name: config.team_name,
        ...result
      });

      // Delay between teams
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(80));
  console.log('📈 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`\nTotal headshots updated: ${results.totalUpdated}`);
  console.log(`Total skipped (no match): ${results.totalSkipped}`);
  console.log(`Total failed: ${results.totalFailed}`);

  const successRate = results.totalUpdated / (results.totalUpdated + results.totalSkipped + results.totalFailed) * 100;
  console.log(`Success rate: ${successRate.toFixed(1)}%\n`);

  // Save results
  fs.writeFileSync(
    'next-worst-teams-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('💾 Saved results to: next-worst-teams-results.json\n');
}

main().catch(console.error);
