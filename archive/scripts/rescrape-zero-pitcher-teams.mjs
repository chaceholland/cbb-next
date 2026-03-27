#!/usr/bin/env node
/**
 * Rescrape the 16 teams that have zero pitchers in the database.
 *
 * Two strategies:
 *   1. Teams with good data in ~/baseball-scrape-results/ → import from file
 *   2. Teams without position data → Playwright rescrape with expanded selectors
 *
 * Run: node rescrape-zero-pitcher-teams.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SCRAPE_RESULTS_DIR = join(process.env.HOME, 'baseball-scrape-results');

// pitcher position regex — broad to catch all variants
const PITCHER_RE = /^(P|RHP|LHP|SP|RP|pitcher|right.?hand|left.?hand)/i;

// ─── Team config ─────────────────────────────────────────────────────────────

const TEAMS = [
  // Teams with good data already in baseball-scrape-results/
  { team_id: '59',  name: 'Arizona State',            dir: 'arizona-state',  strategy: 'file' },
  { team_id: '55',  name: 'Auburn',                   dir: 'auburn',         strategy: 'file' },
  { team_id: '127', name: 'BYU',                      dir: 'byu',            strategy: 'file' },
  { team_id: '161', name: 'Cincinnati Bearcats',       dir: 'cincinnati',     strategy: 'file' },
  { team_id: '64',  name: 'Stanford Cardinal',         dir: 'stanford',       strategy: 'file' },
  { team_id: '131', name: 'Virginia',                  dir: 'virginia',       strategy: 'file' },

  // Teams that need a fresh Playwright scrape
  { team_id: '60',  name: 'Arizona Wildcats',          url: 'https://arizonawildcats.com/sports/baseball/roster',   strategy: 'scrape' },
  { team_id: '58',  name: 'Arkansas',                  url: 'https://arkansasrazorbacks.com/sports/baseball/roster', strategy: 'scrape' },
  { team_id: '65',  name: 'California Golden Bears',   url: 'https://calbears.com/sports/baseball/roster',           strategy: 'scrape' },
  { team_id: '77',  name: 'Georgia Tech Yellow Jackets', url: 'https://ramblinwreck.com/sports/baseball/roster',    strategy: 'scrape' },
  { team_id: '153', name: 'Illinois',                  url: 'https://fightingillini.com/sports/baseball/roster',     strategy: 'scrape' },
  { team_id: '85',  name: 'LSU',                       url: 'https://lsusports.net/sports/baseball/roster',          strategy: 'scrape' },
  { team_id: '87',  name: 'Maryland',                  url: 'https://umterps.com/sports/baseball/roster',            strategy: 'scrape' },
  { team_id: '176', name: 'Miami',                     url: 'https://hurricanesports.com/sports/baseball/roster',    strategy: 'scrape' },
  { team_id: '193', name: 'South Carolina',            url: 'https://gamecocksonline.com/sports/baseball/roster',    strategy: 'scrape' },
  { team_id: '132', name: 'Virginia Tech',              url: 'https://hokiesports.com/sports/baseball/roster',       strategy: 'scrape' },
];

// ─── File-based import ────────────────────────────────────────────────────────

function loadFromFile(team) {
  const path = join(SCRAPE_RESULTS_DIR, team.dir, 'roster.json');
  if (!existsSync(path)) {
    console.log(`  ⚠️  No file found at ${path}`);
    return [];
  }
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const all = Array.isArray(raw) ? raw : (raw.athletes || raw.players || raw.roster || []);
  const pitchers = all.filter(p => p.position && PITCHER_RE.test(p.position));
  return pitchers.map(p => ({
    name: p.name,
    display_name: p.display_name || p.name,
    number: p.jersey_number || p.number || null,
    position: p.position || null,
    headshot: p.headshot_url || p.headshot || null,
    height: p.height || null,
    weight: p.weight || null,
    year: p.year_class || p.year || null,
    hometown: p.hometown || null,
    bats_throws: p.bats_throws || null,
  }));
}

// ─── Playwright scrape ────────────────────────────────────────────────────────

async function scrapeWithPlaywright(page, team) {
  console.log(`  → Visiting ${team.url}`);
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const players = await page.evaluate(() => {
    const results = [];

    // ── Pattern 1: SIDEARM card view (.c-rosterpage__players--card-view) ──
    const cardContainer = document.querySelector('.c-rosterpage__players--card-view');
    if (cardContainer) {
      const cards = cardContainer.querySelectorAll('.s-person-card');
      for (const card of cards) {
        const nameLink = card.querySelector('a[href*="/roster/"], a[href*="/player/"]');
        if (!nameLink) continue;
        const name = nameLink.textContent.trim().replace(/Jersey Number \d+/i, '').trim();
        const img = card.querySelector('img');
        const headshot = img?.getAttribute('src') || null;
        const cardText = card.textContent || '';

        const posMatch = cardText.match(/Position\s+([A-Z][^\n\t]{0,30}?)(?:\s+Jersey|\s+Height|\s+Weight|\s+Academic|\s+Hometown|$)/m);
        const numMatch = cardText.match(/Jersey Number\s+(\d+)/);
        const heightMatch = cardText.match(/Height\s+([\d'"\-\s]+)/);
        const weightMatch = cardText.match(/Weight\s+(\d+)\s*lbs?/i);
        const yearMatch = cardText.match(/Academic Year\s+([\w.\-]+)/);
        const hometownMatch = cardText.match(/Hometown\s+([^\n\t]+)/);
        const btMatch = cardText.match(/\b([LR])[-\/]([LR])\b/);

        results.push({
          name,
          number: numMatch?.[1] || null,
          position: posMatch?.[1]?.trim() || null,
          headshot,
          height: heightMatch?.[1]?.trim() || null,
          weight: weightMatch?.[1] || null,
          year: yearMatch?.[1] || null,
          hometown: hometownMatch?.[1]?.trim() || null,
          bats_throws: btMatch?.[0] || null,
        });
      }
      if (results.length > 0) return results;
    }

    // ── Pattern 2: SIDEARM table with .sidearm-roster-player-* classes ──
    const sidearmRows = document.querySelectorAll(
      '.sidearm-roster-player, tr.s-person-details, .c-rosterpage__players .s-table__row'
    );
    if (sidearmRows.length > 0) {
      for (const row of sidearmRows) {
        const nameEl = row.querySelector('.sidearm-roster-player-name a, .s-person-details__name a, a[data-bind*="name"]');
        if (!nameEl) continue;
        const name = nameEl.textContent.trim();

        const posEl = row.querySelector(
          '.sidearm-roster-player-position, .sidearm-roster-player-position-long-short, [data-label="POS"], [data-label="Position"]'
        );
        // Prefer the abbreviated span ("RHP") if available
        const abbrEl = posEl?.querySelector('.hide-on-medium, .hide-on-small-down');
        const position = (abbrEl?.textContent.trim() || posEl?.textContent.trim() || null);

        const imgEl = row.querySelector('img');
        const headshot = imgEl?.getAttribute('src') || null;

        const numEl = row.querySelector('.sidearm-roster-player-jersey, [data-label="#"], [data-label="No."]');
        const heightEl = row.querySelector('[data-label="Height"], [data-label="Ht."], .sidearm-roster-player-height');
        const weightEl = row.querySelector('[data-label="Weight"], [data-label="Wt."], .sidearm-roster-player-weight');
        const yearEl = row.querySelector('[data-label="Year"], [data-label="Yr."], .sidearm-roster-player-academic-year');
        const hometownEl = row.querySelector('[data-label="Hometown"], .sidearm-roster-player-hometown');
        const btEl = row.querySelector('[data-label="B/T"], [data-label="Bats/Throws"]');

        results.push({
          name,
          number: numEl?.textContent.trim() || null,
          position: position?.split('\n')[0].trim() || null,
          headshot,
          height: heightEl?.textContent.trim() || null,
          weight: weightEl?.textContent.trim() || null,
          year: yearEl?.textContent.trim() || null,
          hometown: hometownEl?.textContent.trim() || null,
          bats_throws: btEl?.textContent.trim() || null,
        });
      }
      if (results.length > 0) return results;
    }

    // ── Pattern 3: LSU / custom .roster-list_item_info layout ──
    const rosterItems = document.querySelectorAll('.roster-list_item, .roster-player, .roster-card');
    if (rosterItems.length > 0) {
      for (const item of rosterItems) {
        const nameEl = item.querySelector('.roster-list_item_info_name, .roster-player-name, h3, h4');
        if (!nameEl) continue;
        const name = nameEl.textContent.trim();

        const posEl = item.querySelector('.roster-list_item_info_position, .roster-player-position');
        const position = posEl?.textContent.trim() || null;

        const imgEl = item.querySelector('img');
        const headshot = imgEl?.src || null;

        const statsEl = item.querySelector('.roster-list_item_info_stats ul, .roster-player-stats');
        const statsList = statsEl ? Array.from(statsEl.querySelectorAll('li')).map(li => li.textContent.trim()) : [];

        results.push({
          name,
          number: null,
          position,
          headshot,
          height: statsList[0] || null,
          weight: statsList[1] || null,
          year: statsList[2] || null,
          hometown: null,
          bats_throws: null,
        });
      }
      if (results.length > 0) return results;
    }

    // ── Pattern 4: Generic table fallback with data-label attributes ──
    for (const table of document.querySelectorAll('table')) {
      const rows = table.querySelectorAll('tbody tr');
      if (rows.length < 5) continue;

      const tableResults = [];
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 3) continue;

        let name = null, number = null, position = null, headshot = null;
        let height = null, weight = null, year = null, hometown = null, bats_throws = null;

        for (const cell of cells) {
          const label = cell.getAttribute('data-label')?.toLowerCase() || '';
          const text = cell.textContent.trim();

          if (!name) {
            const link = cell.querySelector('a');
            if (link) name = link.textContent.trim();
          }
          if (!headshot) {
            const img = cell.querySelector('img');
            if (img?.src && img.src.includes('http') && !img.src.includes('logo')) headshot = img.src;
          }
          if (label.includes('no') || label === '#') number = text;
          else if (label.includes('pos')) position = text;
          else if (label.includes('ht') || label.includes('height')) height = text;
          else if (label.includes('wt') || label.includes('weight')) weight = text;
          else if (label.includes('yr') || label.includes('year') || label.includes('class')) year = text;
          else if (label.includes('home')) hometown = text;
          else if (label.includes('b/t') || label.includes('bat')) bats_throws = text;
        }

        // Fallback: positional guessing for tables without data-labels
        if (!position && !name) {
          const texts = cells.map(c => c.textContent.trim());
          if (/^\d{1,2}$/.test(texts[0])) number = texts[0];
          name = texts[1] || texts[0];
          position = texts[2] || null;
        }

        if (name && name.length > 2) {
          tableResults.push({ name, number, position, headshot, height, weight, year, hometown, bats_throws });
        }
      }

      if (tableResults.length >= 5) return tableResults;
    }

    return results;
  });

  // Filter to pitchers using broad regex
  const PITCHER_RE_STR = /pitcher|^RHP$|^LHP$|^P$|right.hand|left.hand/i;
  const pitchers = players.filter(p => p.position && PITCHER_RE_STR.test(p.position));

  if (pitchers.length === 0) {
    console.log(`  ⚠️  Found ${players.length} players but 0 pitchers. Positions seen: ${[...new Set(players.map(p=>p.position).filter(Boolean))].slice(0,10).join(', ')}`);
  }

  return pitchers.map(p => ({
    name: p.name,
    display_name: p.name,
    number: p.number,
    position: p.position,
    headshot: p.headshot,
    height: p.height,
    weight: p.weight,
    year: p.year,
    hometown: p.hometown,
    bats_throws: p.bats_throws,
  }));
}

// ─── Database insert ──────────────────────────────────────────────────────────

async function insertPitchers(team, pitchers) {
  if (pitchers.length === 0) return 0;

  const records = pitchers.map((p, i) => ({
    pitcher_id: `${team.team_id}-P${i + 1}`,
    team_id: team.team_id,
    name: p.name,
    display_name: p.display_name || p.name,
    number: p.number || null,
    position: p.position || null,
    headshot: p.headshot || null,
    height: p.height || null,
    weight: p.weight || null,
    year: p.year || null,
    hometown: p.hometown || null,
    bats_throws: p.bats_throws || null,
    espn_link: null,
  }));

  const { error } = await supabase.from('cbb_pitchers').insert(records);
  if (error) {
    console.log(`  ❌ Insert error: ${error.message}`);
    return 0;
  }
  return records.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('⚾ RESCRAPING ZERO-PITCHER TEAMS');
  console.log('='.repeat(60));
  console.log();

  let browser = null;
  let totalInserted = 0;
  const summary = [];

  try {
    // Only launch browser if we have teams to scrape
    const needsPlaywright = TEAMS.some(t => t.strategy === 'scrape');
    if (needsPlaywright) {
      browser = await chromium.launch({ headless: true });
    }

    for (const team of TEAMS) {
      console.log(`\n📋 ${team.name} [${team.team_id}] — ${team.strategy}`);

      let pitchers = [];

      if (team.strategy === 'file') {
        pitchers = loadFromFile(team);
        console.log(`  📂 Found ${pitchers.length} pitchers from file`);
      } else {
        const page = await browser.newPage();
        try {
          pitchers = await scrapeWithPlaywright(page, team);
          console.log(`  🌐 Scraped ${pitchers.length} pitchers`);
        } finally {
          await page.close().catch(() => {});
        }
      }

      if (pitchers.length > 0) {
        const inserted = await insertPitchers(team, pitchers);
        console.log(`  ✅ Inserted ${inserted} pitchers`);
        totalInserted += inserted;
        summary.push({ team: team.name, pitchers: inserted, status: 'success' });
      } else {
        console.log(`  ⚠️  No pitchers found — skipping insert`);
        summary.push({ team: team.name, pitchers: 0, status: 'failed' });
      }
    }

  } finally {
    if (browser) await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  for (const s of summary) {
    const icon = s.status === 'success' ? '✅' : '❌';
    console.log(`${icon} ${s.team}: ${s.pitchers} pitchers`);
  }
  console.log(`\nTotal inserted: ${totalInserted} pitchers`);
}

main().catch(console.error);
