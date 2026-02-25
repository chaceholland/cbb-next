#!/usr/bin/env node
/**
 * Comprehensive Bio Data Scraper
 * Scrapes height, weight, year, hometown, bats/throws for pitchers missing bio data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chromium } from 'playwright';
import fs from 'fs';

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

// Team roster URL mapping
const ROSTER_URLS = {
  'Alabama': 'https://rolltide.com/sports/baseball/roster',
  'Arizona State': 'https://thesundevils.com/sports/baseball/roster',
  'Arizona Wildcats': 'https://arizonawildcats.com/sports/baseball/roster',
  'Arkansas': 'https://arkansasrazorbacks.com/sports/baseball/roster',
  'Auburn': 'https://auburntigers.com/sports/baseball/roster',
  'Baylor': 'https://baylorbears.com/sports/baseball/roster',
  'BYU': 'https://byucougars.com/sports/baseball/roster',
  'California Golden Bears': 'https://calbears.com/sports/baseball/roster',
  'Cincinnati Bearcats': 'https://gobearcats.com/sports/baseball/roster',
  'Clemson': 'https://clemsontigers.com/sports/baseball/roster',
  'Duke': 'https://goduke.com/sports/baseball/roster',
  'Florida': 'https://floridagators.com/sports/baseball/roster',
  'Florida State': 'https://seminoles.com/sports/baseball/roster',
  'Georgia': 'https://georgiadogs.com/sports/baseball/roster',
  'Georgia Tech Yellow Jackets': 'https://ramblinwreck.com/sports/baseball/roster',
  'Houston': 'https://uhcougars.com/sports/baseball/roster',
  'Illinois': 'https://fightingillini.com/sports/baseball/roster',
  'Indiana': 'https://iuhoosiers.com/sports/baseball/roster',
  'Iowa': 'https://hawkeyesports.com/sports/baseball/roster',
  'Kansas': 'https://kuathletics.com/sports/baseball/roster',
  'Kansas State': 'https://kstatesports.com/sports/baseball/roster',
  'Kentucky': 'https://ukathletics.com/sports/baseball/roster',
  'Louisville': 'https://gocards.com/sports/baseball/roster',
  'LSU': 'https://lsusports.net/sports/baseball/roster',
  'Maryland': 'https://umterps.com/sports/baseball/roster',
  'Miami': 'https://hurricanesports.com/sports/baseball/roster',
  'Michigan': 'https://mgoblue.com/sports/baseball/roster',
  'Michigan State': 'https://msuspartans.com/sports/baseball/roster',
  'Minnesota': 'https://gophersports.com/sports/baseball/roster',
  'Mississippi State': 'https://hailstate.com/sports/baseball/roster',
  'Missouri': 'https://mutigers.com/sports/baseball/roster',
  'NC State': 'https://gopack.com/sports/baseball/roster',
  'Nebraska': 'https://huskers.com/sports/baseball/roster',
  'North Carolina': 'https://goheels.com/sports/baseball/roster',
  'Northwestern': 'https://nusports.com/sports/baseball/roster',
  'Notre Dame': 'https://und.com/sports/baseball/roster',
  'Ohio State': 'https://ohiostatebuckeyes.com/sports/baseball/roster',
  'Oklahoma': 'https://soonersports.com/sports/baseball/roster',
  'Oklahoma State': 'https://okstate.com/sports/baseball/roster',
  'Ole Miss': 'https://olemisssports.com/sports/baseball/roster',
  'Oregon': 'https://goducks.com/sports/baseball/roster',
  'Oregon State': 'https://osubeavers.com/sports/baseball/roster',
  'Penn State Nittany Lions': 'https://gopsusports.com/sports/baseball/roster',
  'Pittsburgh': 'https://pittsburghpanthers.com/sports/baseball/roster',
  'Purdue Boilermakers': 'https://purduesports.com/sports/baseball/roster',
  'Rutgers': 'https://scarletknights.com/sports/baseball/roster',
  'South Carolina': 'https://gamecocksonline.com/sports/baseball/roster',
  'Stanford Cardinal': 'https://gostanford.com/sports/baseball/roster',
  'TCU': 'https://gofrogs.com/sports/baseball/roster',
  'Tennessee': 'https://utsports.com/sports/baseball/roster',
  'Texas': 'https://texassports.com/sports/baseball/roster',
  'Texas A&M': 'https://12thman.com/sports/baseball/roster',
  'Texas Tech': 'https://texastech.com/sports/baseball/roster',
  'UCLA': 'https://uclabruins.com/sports/baseball/roster',
  'USC': 'https://usctrojans.com/sports/baseball/roster',
  'Utah': 'https://utahutes.com/sports/baseball/roster',
  'Vanderbilt': 'https://vucommodores.com/sports/baseball/roster',
  'Virginia': 'https://virginiasports.com/sports/baseball/roster',
  'Virginia Tech': 'https://hokiesports.com/sports/baseball/roster',
  'Wake Forest': 'https://godemon.com/sports/baseball/roster',
  'Washington': 'https://gohuskies.com/sports/baseball/roster',
  'Washington State': 'https://wsucougars.com/sports/baseball/roster',
  'West Virginia': 'https://wvusports.com/sports/baseball/roster',
};

// Normalize name for matching
const normalizeName = name => name?.toLowerCase()
  .replace(/\s*-\s*p\s*/g, ' ')
  .replace(/[^a-z\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '';

// Parse height from various formats
function parseHeight(heightStr) {
  if (!heightStr) return null;

  // Handle formats like: 6-2, 6'2", 6' 2", 6-2", etc.
  const match = heightStr.match(/(\d+)[-'\s]+(\d+)/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return heightStr;
}

// Parse weight
function parseWeight(weightStr) {
  if (!weightStr) return null;

  // Extract just the number
  const match = weightStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Normalize year/class
function normalizeYear(yearStr) {
  if (!yearStr) return null;

  const normalized = yearStr.toLowerCase();
  if (normalized.includes('fr') || normalized.includes('freshman')) return 'Fr.';
  if (normalized.includes('so') || normalized.includes('sophomore')) return 'So.';
  if (normalized.includes('jr') || normalized.includes('junior')) return 'Jr.';
  if (normalized.includes('sr') || normalized.includes('senior')) return 'Sr.';
  if (normalized.includes('r-fr')) return 'R-Fr.';
  if (normalized.includes('r-so')) return 'R-So.';
  if (normalized.includes('r-jr')) return 'R-Jr.';
  if (normalized.includes('r-sr')) return 'R-Sr.';

  return yearStr;
}

async function scrapeBioDataForTeam(browser, teamName, pitchers) {
  const url = ROSTER_URLS[teamName];

  if (!url) {
    console.log(`  ⏭️  No roster URL configured for ${teamName}`);
    return { updated: 0, skipped: pitchers.length, failed: 0 };
  }

  console.log(`\n  Visiting: ${url}\n`);

  const page = await browser.newPage();
  const results = { updated: 0, skipped: 0, failed: 0 };

  try {
    // Use domcontentloaded instead of networkidle for faster loading
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000); // Give time for dynamic content to load

    // Strategy: Parse any table with roster data
    const rosterData = await page.evaluate(() => {
      const players = [];

      // Find all tables and try to parse them
      const tables = document.querySelectorAll('table');

      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        if (rows.length === 0) continue;

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td, th'));
          if (cells.length < 4) continue; // Need at least 4 columns for meaningful data

          const cellTexts = cells.map(c => c.textContent?.trim() || '');

          // Find name cell (usually has a link, or is longer text)
          let nameIdx = -1;
          let name = null;

          for (let i = 0; i < cells.length && i < 5; i++) {
            const cell = cells[i];
            const text = cellTexts[i];

            // Skip if it's a number only (jersey number)
            if (/^\d{1,3}$/.test(text)) continue;

            // Look for link to player profile or longer text that looks like a name
            if (cell.querySelector('a[href*="/roster/"], a[href*="/player/"]') ||
                (text.split(' ').length >= 2 && text.split(' ').length <= 4 && text.length > 5)) {
              nameIdx = i;
              name = text;
              break;
            }
          }

          if (!name || nameIdx === -1) continue;

          // Parse remaining cells by pattern matching
          let height = null, weight = null, year = null, hometown = null, batsThrows = null, position = null;

          for (let i = 0; i < cellTexts.length; i++) {
            const text = cellTexts[i];
            if (!text || i === nameIdx) continue;

            // Check data-label attribute first
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
            }
            // Pattern matching if no data-label
            else {
              // Height: 6-2, 6'2", 6' 2'', etc
              if (!height && /\d+[-']\s*\d+/.test(text)) {
                height = text;
              }
              // Weight: 150-350 lbs range (realistic for baseball players)
              else if (!weight && /^(1[5-9]\d|[2-3]\d{2})(\s*lbs?)?$/i.test(text)) {
                weight = text;
              }
              // Year: Fr., So., Jr., Sr., R-Fr., etc
              else if (!year && /^(r-)?(fr|so|jr|sr|freshman|sophomore|junior|senior)\.?$/i.test(text)) {
                year = text;
              }
              // B/T: R/R, L/L, R/L, R-R, L-L, R-L, etc
              else if (!batsThrows && /^[LR][-\/][LR]$/i.test(text)) {
                batsThrows = text;
              }
              // Position: P, RHP, LHP, etc (short codes)
              else if (!position && /^(P|RHP|LHP|C|1B|2B|3B|SS|OF|INF|UTIL)$/i.test(text)) {
                position = text;
              }
              // Hometown: longer text with comma or slash (city, state / school)
              else if (!hometown && text.length > 10 && (text.includes(',') || text.includes('/'))) {
                hometown = text;
              }
            }
          }

          players.push({
            name,
            height,
            weight,
            year,
            hometown,
            batsThrows,
            position
          });
        }

        // If we found players in this table, don't check other tables
        if (players.length > 0) break;
      }

      return players;
    });

    console.log(`Found ${rosterData.length} players with bio data on roster page\n`);

    if (rosterData.length === 0) {
      console.log(`⚠️  No bio data found on roster page\n`);
      results.skipped = pitchers.length;
      await page.close();
      return results;
    }

    console.log('Matching pitchers and updating database:\n');

    // Match and update each pitcher
    for (const pitcher of pitchers) {
      const normalizedPitcherName = normalizeName(pitcher.name);

      // Find best match
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

      // Prepare update data - only update fields that are currently null/empty
      const updates = {};

      if (!pitcher.height && match.height) {
        updates.height = parseHeight(match.height);
      }
      if (!pitcher.weight && match.weight) {
        updates.weight = parseWeight(match.weight);
      }
      if (!pitcher.year && match.year) {
        updates.year = normalizeYear(match.year);
      }
      if (!pitcher.hometown && match.hometown) {
        updates.hometown = match.hometown;
      }
      if (!pitcher.bats_throws && match.batsThrows) {
        updates.bats_throws = match.batsThrows;
      }

      if (Object.keys(updates).length === 0) {
        console.log(`  ⏭️  ${pitcher.name}: No new bio data to add`);
        results.skipped++;
        continue;
      }

      // Update database
      const { error } = await supabase
        .from('cbb_pitchers')
        .update(updates)
        .eq('pitcher_id', pitcher.pitcher_id);

      if (error) {
        console.log(`  ❌ ${pitcher.name}: Update failed - ${error.message}`);
        results.failed++;
      } else {
        const updatedFields = Object.keys(updates).join(', ');
        console.log(`  ✅ ${pitcher.name}: Updated ${updatedFields}`);
        results.updated++;
      }
    }

    await page.close();
  } catch (error) {
    console.error(`  ❌ Error scraping ${teamName}:`, error.message);
    results.failed = pitchers.length;
    await page.close();
  }

  return results;
}

async function main() {
  console.log('🔍 Starting Bio Data Scraping\n');
  console.log('=' .repeat(80));

  // Fetch teams
  const { data: teams } = await supabase
    .from('cbb_teams')
    .select('*');

  const teamMap = new Map(teams.map(t => [t.team_id, t.name || t.display_name]));

  // Fetch pitchers missing bio data
  const { data: pitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .or('height.is.null,weight.is.null,year.is.null,hometown.is.null,bats_throws.is.null');

  if (error) {
    console.error('❌ Error fetching pitchers:', error);
    return;
  }

  // Add team names
  const pitchersWithTeams = pitchers.map(p => ({
    ...p,
    team_name: teamMap.get(p.team_id) || 'Unknown'
  }));

  console.log(`\nFound ${pitchersWithTeams.length} pitchers missing bio data\n`);

  // Group by team
  const teamGroups = new Map();
  for (const pitcher of pitchersWithTeams) {
    if (!teamGroups.has(pitcher.team_name)) {
      teamGroups.set(pitcher.team_name, []);
    }
    teamGroups.get(pitcher.team_name).push(pitcher);
  }

  console.log(`Grouped into ${teamGroups.size} teams\n`);
  console.log('=' .repeat(80));

  // Sort teams by number of pitchers needing bio data (descending)
  const sortedTeams = Array.from(teamGroups.entries())
    .sort((a, b) => b[1].length - a[1].length);

  const browser = await chromium.launch({ headless: true });
  const allResults = {
    totalUpdated: 0,
    totalFailed: 0,
    totalSkipped: 0,
    teamResults: []
  };

  for (const [teamName, teamPitchers] of sortedTeams) {
    console.log(`\n${'=' .repeat(80)}`);
    console.log(`🎯 Scraping: ${teamName} (${teamPitchers.length} missing bio data)`);
    console.log('=' .repeat(80));

    const results = await scrapeBioDataForTeam(browser, teamName, teamPitchers);

    console.log(`\n📊 ${teamName} Summary: ${results.updated} updated, ${results.skipped} skipped, ${results.failed} failed`);

    allResults.totalUpdated += results.updated;
    allResults.totalFailed += results.failed;
    allResults.totalSkipped += results.skipped;
    allResults.teamResults.push({
      team_name: teamName,
      ...results
    });
  }

  await browser.close();

  // Final summary
  console.log(`\n${'=' .repeat(80)}`);
  console.log('📈 FINAL RESULTS');
  console.log('=' .repeat(80));
  console.log(`\nTotal bio fields updated: ${allResults.totalUpdated}`);
  console.log(`Total skipped (no match): ${allResults.totalSkipped}`);
  console.log(`Total failed: ${allResults.totalFailed}`);
  console.log(`Success rate: ${((allResults.totalUpdated / (allResults.totalUpdated + allResults.totalSkipped + allResults.totalFailed)) * 100).toFixed(1)}%`);

  // Save results
  fs.writeFileSync('bio-scrape-results.json', JSON.stringify(allResults, null, 2));
  console.log(`\n💾 Saved results to: bio-scrape-results.json`);

  // Run updated audit
  console.log('\n📊 Running updated audit...\n');
  const { spawn } = await import('child_process');
  spawn('node', ['comprehensive-team-audit.mjs'], { stdio: 'inherit' });
}

main().catch(console.error);
