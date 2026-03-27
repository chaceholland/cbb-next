#!/usr/bin/env node
/**
 * Rescrape headshots from ESPN team roster pages
 * Works for teams with poor coverage by scraping entire roster pages
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

// Normalize name for matching
const norm = name => name?.toLowerCase()
  .replace(/[^a-z\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '';

// Load teams needing rescraping
const teamsToRescrape = JSON.parse(fs.readFileSync('teams-needing-headshot-rescrape.json', 'utf8'));

async function scrapeEspnRosterPage(page, teamId) {
  const url = `https://www.espn.com/college-baseball/team/roster/_/id/${teamId}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000); // Wait for dynamic content

    // Scroll to load lazy images
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);

    // Extract player data from roster table
    const players = await page.evaluate(() => {
      const results = [];

      // Try multiple selectors for ESPN roster tables
      const tables = document.querySelectorAll('table, .Table, .roster-table');

      for (const table of tables) {
        const rows = table.querySelectorAll('tr');

        for (const row of rows) {
          // Look for player name and image
          const nameCell = row.querySelector('td a[href*="/player/"], td .athleteName, td .AthleteName');
          const imgElement = row.querySelector('img.Image, img.PlayerImage, img[alt*="Headshot"], img');

          if (nameCell && imgElement) {
            const name = nameCell.textContent?.trim();
            let headshot = imgElement.src || imgElement.getAttribute('data-src');

            // Skip placeholder images
            if (headshot && !headshot.includes('placeholder') &&
                !headshot.includes('default') &&
                !headshot.includes('data:image') &&
                headshot.includes('espn')) {

              // Clean up image URL - get higher resolution version
              headshot = headshot
                .replace(/&w=\d+/g, '&w=400')
                .replace(/&h=\d+/g, '&h=400')
                .replace(/\/w\d+\//g, '/w400/')
                .split('?')[0] + '?w=400&h=400';

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

async function scrapeTeamHeadshots(browser, team) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 Scraping: ${team.team_name} (${team.coverage_pct}% coverage)`);
  console.log(`   ESPN URL: https://www.espn.com/college-baseball/team/roster/_/id/${team.team_id}`);
  console.log(`${'='.repeat(80)}\n`);

  // Get pitchers for this team that are missing headshots
  const { data: pitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('pitcher_id, name, display_name, headshot')
    .eq('team_id', team.team_id)
    .or('headshot.is.null,headshot.eq.');

  if (error) {
    console.error(`❌ Error fetching pitchers: ${error.message}`);
    return { updated: 0, failed: 0, skipped: 0 };
  }

  if (!pitchers || pitchers.length === 0) {
    console.log('✅ No pitchers missing headshots');
    return { updated: 0, failed: 0, skipped: 0 };
  }

  console.log(`Found ${pitchers.length} pitchers missing headshots`);

  const page = await browser.newPage();

  // Scrape ESPN roster page
  console.log(`\nScraping ESPN roster page...`);
  const espnPlayers = await scrapeEspnRosterPage(page, team.team_id);
  console.log(`Found ${espnPlayers.length} players with headshots on ESPN\n`);

  if (espnPlayers.length === 0) {
    console.log(`⚠️  No headshots found on ESPN roster page\n`);
    await page.close();
    return { updated: 0, failed: pitchers.length, skipped: 0 };
  }

  // Create name-to-headshot map
  const headshotMap = new Map();
  espnPlayers.forEach(p => {
    headshotMap.set(norm(p.name), p.headshot);
  });

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  // Match database pitchers with ESPN data
  console.log('Matching pitchers and updating database:\n');
  for (const pitcher of pitchers) {
    const pitcherName = pitcher.display_name || pitcher.name;
    const normalizedName = norm(pitcherName);

    // Try to find match in ESPN data
    let headshot = headshotMap.get(normalizedName);

    // Try partial matching if exact match fails
    if (!headshot) {
      for (const [espnName, espnHeadshot] of headshotMap.entries()) {
        // Check if names are similar (both directions)
        if (espnName.includes(normalizedName) || normalizedName.includes(espnName)) {
          headshot = espnHeadshot;
          break;
        }
      }
    }

    if (headshot) {
      // Update database
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

  console.log(`\n📊 ${team.team_name} Summary: ${updated} updated, ${skipped} skipped, ${failed} failed\n`);

  return { updated, failed, skipped };
}

async function main() {
  console.log('🚀 Starting ESPN roster page scraping for teams with poor coverage\n');
  console.log(`Teams to process: ${teamsToRescrape.length}\n`);

  const browser = await chromium.launch({ headless: true });

  const results = {
    totalUpdated: 0,
    totalFailed: 0,
    totalSkipped: 0,
    teamResults: []
  };

  try {
    for (const team of teamsToRescrape) {
      const result = await scrapeTeamHeadshots(browser, team);
      results.totalUpdated += result.updated;
      results.totalFailed += result.failed;
      results.totalSkipped += result.skipped;
      results.teamResults.push({
        team_name: team.team_name,
        ...result
      });

      // Delay between teams to be respectful
      await new Promise(resolve => setTimeout(resolve, 3000));
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

  // Save detailed results
  fs.writeFileSync(
    'espn-roster-scrape-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('💾 Saved detailed results to: espn-roster-scrape-results.json\n');

  // Run coverage analysis again
  console.log('Running coverage analysis...\n');
  const { spawn } = await import('child_process');
  spawn('node', ['analyze-headshot-coverage.mjs'], { stdio: 'inherit' });
}

main().catch(console.error);
