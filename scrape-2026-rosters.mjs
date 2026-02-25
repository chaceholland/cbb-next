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

  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nTotal Teams:     ${results.totalTeams}`);
  console.log(`Successful:      ${results.successfulTeams} (${((results.successfulTeams / results.totalTeams) * 100).toFixed(1)}%)`);
  console.log(`Failed:          ${results.failedTeams} (${((results.failedTeams / results.totalTeams) * 100).toFixed(1)}%)`);
  console.log(`Total Pitchers:  ${results.totalPitchers}`);
}

main().catch(console.error);
