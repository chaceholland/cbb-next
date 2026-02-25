#!/usr/bin/env node
/**
 * Phase 1: Scrape 2026 College Baseball Rosters
 *
 * Visits all team roster pages and extracts pitcher data to JSON.
 * Does not modify the database - only creates 2026-rosters.json for review.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Team roster URL mapping - maps team names to their 2026 roster URLs
const TEAM_URL_MAP = {
  'Alabama': 'https://rolltide.com/sports/baseball/roster',
  'Arizona State': 'https://thesundevils.com/sports/baseball/roster',
  'Arizona Wildcats': 'https://arizonawildcats.com/sports/baseball/roster',
  'Arkansas': 'https://arkansasrazorbacks.com/sports/baseball/roster',
  'Auburn': 'https://auburntigers.com/sports/baseball/roster',
  'Baylor': 'https://baylorbears.com/sports/baseball/roster',
  'Boston College': 'https://bceagles.com/sports/baseball/roster',
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
  'Wake Forest': 'https://godeacs.com/sports/baseball/roster',
  'Washington': 'https://gohuskies.com/sports/baseball/roster',
  'Washington State': 'https://wsucougars.com/sports/baseball/roster',
  'West Virginia': 'https://wvusports.com/sports/baseball/roster',
};

// Normalize name for deduplication (lowercase, remove special chars)
const normalizeName = name => name?.toLowerCase()
  .replace(/[^a-z\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '';

async function fetchTeams() {
  const { data: teams, error } = await supabase
    .from('cbb_teams')
    .select('team_id, name, display_name')
    .order('name');

  if (error) {
    console.error('❌ Failed to fetch teams:', error.message);
    process.exit(1);
  }

  if (!teams || teams.length === 0) {
    console.error('❌ No teams found in database');
    process.exit(1);
  }

  return teams;
}

async function scrapeTeamRoster(browser, team) {
  const teamResult = {
    team_id: team.team_id,
    team_name: team.name || team.display_name,
    url: team.roster_url,
    status: 'pending',
    pitchers: []
  };

  if (!team.roster_url) {
    teamResult.status = 'failed';
    teamResult.error = 'No roster URL configured';
    return teamResult;
  }

  const page = await browser.newPage();

  try {
    // Navigate to roster page
    await page.goto(team.roster_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000); // Wait for dynamic content

    // Extract roster data
    const rosterData = await page.evaluate(() => {
      const players = [];
      const tables = document.querySelectorAll('table');

      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        if (rows.length === 0) continue;

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td, th'));
          if (cells.length < 3) continue;

          const cellTexts = cells.map(c => c.textContent?.trim() || '');

          // Extract player data
          let name = null, number = null, position = null, headshot = null;
          let height = null, weight = null, year = null, hometown = null, batsThrows = null;

          // Find name with link
          for (const cell of cells) {
            const link = cell.querySelector('a[href*="/roster/"], a[href*="/player/"]');
            if (link) {
              name = link.textContent?.trim();

              // Try to find headshot
              const img = cell.querySelector('img');
              if (img) {
                const src = img.getAttribute('src');
                if (src && !src.includes('logo') && !src.includes('team')) {
                  headshot = src;
                }
              }
              break;
            }
          }

          // Fallback name extraction
          if (!name) {
            for (const text of cellTexts) {
              if (!/^\d{1,3}$/.test(text) &&
                  !/^\d+[-']/.test(text) &&
                  text.split(' ').length >= 2 &&
                  text.length > 5) {
                name = text;
                break;
              }
            }
          }

          if (!name) continue;

          // Extract number (first cell, 1-2 digits)
          if (cellTexts.length > 0 && /^\d{1,2}$/.test(cellTexts[0])) {
            number = cellTexts[0];
          }

          // Extract other fields
          for (let i = 0; i < cells.length; i++) {
            const text = cellTexts[i];
            if (!text) continue;

            const label = cells[i].getAttribute('data-label')?.toLowerCase() || '';

            // Use data-label when available
            if (label.includes('pos')) {
              position = text;
            } else if (label.includes('height') || label.includes('ht')) {
              height = text;
            } else if (label.includes('weight') || label.includes('wt')) {
              weight = text;
            } else if (label.includes('year') || label.includes('class') || label.includes('yr')) {
              year = text;
            } else if (label.includes('hometown') || label.includes('home')) {
              hometown = text;
            } else if (label.includes('b/t') || (label.includes('bat') && label.includes('throw'))) {
              batsThrows = text;
            } else {
              // Pattern matching fallbacks
              if (!position && /^(P|RHP|LHP|C|1B|2B|3B|SS|OF|INF|UTIL)$/i.test(text)) {
                position = text;
              } else if (!height && /\d+[-']\s*\d+/.test(text)) {
                height = text;
              } else if (!weight && /^(1[5-9]\d|[2-3]\d{2})(lbs?)?$/i.test(text)) {
                weight = text.replace(/lbs?/i, '').trim();
              } else if (!year && /^(r-)?(fr|so|jr|sr|freshman|sophomore|junior|senior)\.?$/i.test(text)) {
                year = text;
              } else if (!batsThrows && /^[LR][-\/][LR]$/i.test(text)) {
                batsThrows = text;
              } else if (!hometown && text.length > 10 && (text.includes(',') || text.includes('/'))) {
                hometown = text;
              }
            }
          }

          players.push({
            name,
            display_name: name,
            number,
            position,
            headshot,
            height,
            weight,
            year,
            hometown,
            bats_throws: batsThrows
          });
        }

        if (players.length > 0) break; // Found roster table
      }

      return players;
    });

    // Filter for pitchers only
    const pitchers = rosterData.filter(p =>
      p.position && /^(P|RHP|LHP)$/i.test(p.position)
    );

    teamResult.pitchers = pitchers;
    teamResult.status = 'success';

    if (pitchers.length === 0) {
      teamResult.status = 'warning';
      teamResult.error = '0 pitchers found';
    }

    return teamResult;

  } catch (error) {
    teamResult.status = 'failed';
    teamResult.error = error.message;
    return teamResult;
  } finally {
    try {
      await page.close();
    } catch (closeError) {
      // Ignore close errors - page may not exist
    }
  }
}

async function main() {
  console.log('🏈 SCRAPING 2026 COLLEGE BASEBALL ROSTERS');
  console.log('='.repeat(60));
  console.log();

  const teams = await fetchTeams();
  console.log(`📋 Found ${teams.length} teams to scrape\n`);
  console.log(`Processing teams...\n`);

  const results = {
    scrapedAt: new Date().toISOString(),
    totalTeams: teams.length,
    successfulTeams: 0,
    failedTeams: 0,
    totalPitchers: 0,
    teams: []
  };

  const browser = await chromium.launch({ headless: true });

  for (const team of teams) {
    // Add URL from mapping to team object
    const teamName = team.name || team.display_name;
    const roster_url = TEAM_URL_MAP[teamName];

    const teamWithUrl = {
      ...team,
      roster_url
    };

    const teamResult = await scrapeTeamRoster(browser, teamWithUrl);
    results.teams.push(teamResult);

    if (teamResult.status === 'success') {
      results.successfulTeams++;
      results.totalPitchers += teamResult.pitchers.length;
      console.log(`✅ ${teamResult.team_name} (${teamResult.pitchers.length} pitchers)`);
    } else if (teamResult.status === 'warning') {
      results.successfulTeams++;
      console.log(`⚠️  ${teamResult.team_name} - ${teamResult.error}`);
    } else {
      results.failedTeams++;
      console.log(`❌ ${teamResult.team_name} - ${teamResult.error}`);
    }
  }

  await browser.close();

  // Save results to JSON
  const outputPath = join(__dirname, '2026-rosters.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nTotal Teams:     ${results.totalTeams}`);
  console.log(`Successful:      ${results.successfulTeams} (${((results.successfulTeams / results.totalTeams) * 100).toFixed(1)}%)`);
  console.log(`Failed:          ${results.failedTeams} (${((results.failedTeams / results.totalTeams) * 100).toFixed(1)}%)`);
  console.log(`Total Pitchers:  ${results.totalPitchers}`);
  console.log(`\nResults saved to: 2026-rosters.json\n`);

  // Show failed teams if any
  const failedTeams = results.teams.filter(t => t.status === 'failed');
  if (failedTeams.length > 0) {
    console.log('⚠️  Failed teams:');
    failedTeams.forEach(t => {
      console.log(`  - ${t.team_name} (${t.error})`);
    });
    console.log();
  }

  // Show warnings
  const warningTeams = results.teams.filter(t => t.status === 'warning');
  if (warningTeams.length > 0) {
    console.log('⚠️  Teams with warnings:');
    warningTeams.forEach(t => {
      console.log(`  - ${t.team_name} (${t.error})`);
    });
    console.log();
  }

  // Validation warnings
  if (results.successfulTeams === 0) {
    console.log('❌ CRITICAL: No teams scraped successfully!');
    process.exit(1);
  }

  const successRate = (results.successfulTeams / results.totalTeams) * 100;
  if (successRate < 80) {
    console.log(`⚠️  WARNING: Success rate is ${successRate.toFixed(1)}% (below 80% threshold)`);
    console.log('   Consider investigating parsing issues before proceeding to Phase 2\n');
  }

  console.log('✅ Ready for Phase 2: Run replace-with-2026-rosters.mjs\n');
}

main().catch(console.error);
