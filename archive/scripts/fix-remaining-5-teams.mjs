#!/usr/bin/env node
/**
 * Fix the 5 remaining teams with zero pitchers:
 *   - Arkansas    (JS-rendered WordPress/custom site)
 *   - Georgia Tech (JS-rendered)
 *   - Miami       (static HTML, .player__meta structure)
 *   - South Carolina (static HTML, .text-wrapper / .position structure)
 *   - Virginia Tech  (Nuxt.js static HTML)
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

const PITCHER_RE = /pitcher|^RHP$|^LHP$|^P$|right.hand|left.hand/i;

const TEAMS = [
  { team_id: '58',  name: 'Arkansas',              url: 'https://arkansasrazorbacks.com/sport/m-basebl/roster/' },
  { team_id: '77',  name: 'Georgia Tech',           url: 'https://ramblinwreck.com/sports/m-basebl/roster/' },
  { team_id: '176', name: 'Miami',                  url: 'https://hurricanesports.com/sports/baseball/roster/' },
  { team_id: '193', name: 'South Carolina',         url: 'https://gamecocksonline.com/sports/baseball/roster/' },
  { team_id: '132', name: 'Virginia Tech',          url: 'https://hokiesports.com/sports/baseball/roster/' },
];

async function scrapeTeam(page, team) {
  console.log(`  → ${team.url}`);
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const players = await page.evaluate(() => {
    const results = [];

    // ── Georgia Tech / figcaption: <figcaption><span>RHP</span><a>Name</a></figcaption> ──
    const figCaptions = document.querySelectorAll('figcaption');
    if (figCaptions.length > 10) {
      for (const fig of figCaptions) {
        const posEl = fig.querySelector('span');
        const nameLink = fig.querySelector('a');
        if (!nameLink) continue;
        const name = nameLink.textContent.trim();
        const position = posEl?.textContent.trim() || null;
        // Get number from figure icon
        const figure = fig.closest('figure, li, .roster-item');
        const numEl = figure?.querySelector('.icon span, [class*="number"]');
        results.push({ name, position, number: numEl?.textContent.replace('#','').trim() || null, headshot: null, height: null, weight: null, year: null, hometown: null, bats_throws: null });
      }
      if (results.length > 5) return results;
    }

    // ── Arkansas / standard HTML table (class="table") ──
    const tables = document.querySelectorAll('table.table, table[data-init="datatable"]');
    for (const table of tables) {
      const rows = table.querySelectorAll('tbody tr');
      if (rows.length < 5) continue;
      const tableResults = [];
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 3) continue;
        const nameLink = cells[1]?.querySelector('a') || cells.find(c => c.querySelector('a'))?.querySelector('a');
        if (!nameLink) continue;
        const name = nameLink.textContent.trim();
        const number = cells[0]?.textContent.trim() || null;
        const position = cells[2]?.textContent.trim() || null;
        const year = cells[3]?.textContent.trim() || null;
        const height = cells[4]?.textContent.trim() || null;
        const weight = cells[5]?.textContent.trim() || null;
        tableResults.push({ name, number, position, headshot: null, height, weight, year, hometown: null, bats_throws: null });
      }
      if (tableResults.length >= 5) return tableResults;
    }

    // ── Miami: .player__meta span (position before h3) ──
    const playerMetas = document.querySelectorAll('.player__meta, .player-card__meta');
    if (playerMetas.length > 0) {
      for (const meta of playerMetas) {
        const nameLink = meta.querySelector('h3 a, h4 a');
        const posEl = meta.querySelector('span');
        if (!nameLink) continue;
        const name = nameLink.textContent.trim();
        const position = posEl?.textContent.trim() || null;
        const imgEl = meta.closest('[class*="player"]')?.querySelector('img');
        results.push({ name, position, headshot: imgEl?.src || null, number: null, height: null, weight: null, year: null, hometown: null, bats_throws: null });
      }
      if (results.length > 5) return results;
    }

    // ── South Carolina: .text-wrapper with .position and .person__name ──
    const textWrappers = document.querySelectorAll('.text-wrapper');
    if (textWrappers.length > 0) {
      for (const wrap of textWrappers) {
        const nameLink = wrap.querySelector('.person__name a, h3 a, h4 a');
        const posEl = wrap.querySelector('.position');
        const numEl = wrap.querySelector('.number');
        const infoEl = wrap.querySelector('.info, p.info');
        if (!nameLink) continue;
        const name = nameLink.textContent.trim();
        const position = posEl?.textContent.trim() || null;
        const number = numEl?.textContent.trim() || null;
        const infoText = infoEl?.textContent || '';
        // info usually: "6'3" / 192 lbs / Freshman / R/L"
        const parts = infoText.split('/').map(p => p.trim().replace(/&nbsp;/g, ''));
        const btMatch = infoText.match(/\b([LR])\/([LR])\b/);
        results.push({
          name, position, number, headshot: null,
          height: parts[0] || null,
          weight: parts[1]?.replace(/\s*lbs?\s*/i, '').trim() || null,
          year: parts[2] || null,
          hometown: null,
          bats_throws: btMatch?.[0] || null,
        });
      }
      if (results.length > 5) return results;
    }

    // ── Virginia Tech / Nuxt: .roster-player-list-profile-field--position ──
    const vtItems = document.querySelectorAll('[class*="roster-player-list-item"], [class*="roster-player-card"]');
    if (vtItems.length > 0) {
      for (const item of vtItems) {
        const nameEl = item.querySelector('[class*="name"], h3, h4, a');
        const posEl = item.querySelector('[class*="position"]');
        const numEl = item.querySelector('[class*="number"], [class*="jersey"]');
        const heightEl = item.querySelector('[class*="height"]');
        const weightEl = item.querySelector('[class*="weight"]');
        const yearEl = item.querySelector('[class*="year"], [class*="class"]');
        const hometownEl = item.querySelector('[class*="hometown"], [class*="city"]');
        if (!nameEl) continue;
        results.push({
          name: nameEl.textContent.trim(),
          position: posEl?.textContent.trim() || null,
          number: numEl?.textContent.trim() || null,
          headshot: item.querySelector('img')?.src || null,
          height: heightEl?.textContent.trim() || null,
          weight: weightEl?.textContent.trim() || null,
          year: yearEl?.textContent.trim() || null,
          hometown: hometownEl?.textContent.trim() || null,
          bats_throws: null,
        });
      }
      if (results.length > 5) return results;
    }

    // ── SIDEARM card view ──
    const cardContainer = document.querySelector('.c-rosterpage__players--card-view');
    if (cardContainer) {
      for (const card of cardContainer.querySelectorAll('.s-person-card')) {
        const nameLink = card.querySelector('a[href*="/roster/"], a[href*="/player/"]');
        if (!nameLink) continue;
        const name = nameLink.textContent.trim().replace(/Jersey Number \d+/i, '').trim();
        const cardText = card.textContent || '';
        const posMatch = cardText.match(/Position\s+([A-Z][^\n\t]{0,30}?)(?:\s+Jersey|\s+Height|\s+Weight|\s+Academic|\s+Hometown|$)/m);
        const numMatch = cardText.match(/Jersey Number\s+(\d+)/);
        const heightMatch = cardText.match(/Height\s+([\d'"\-\s]+)/);
        const weightMatch = cardText.match(/Weight\s+(\d+)\s*lbs?/i);
        const yearMatch = cardText.match(/Academic Year\s+([\w.\-]+)/);
        const hometownMatch = cardText.match(/Hometown\s+([^\n\t]+)/);
        const btMatch = cardText.match(/\b([LR])[-\/]([LR])\b/);
        results.push({
          name, number: numMatch?.[1] || null, position: posMatch?.[1]?.trim() || null,
          headshot: card.querySelector('img')?.getAttribute('src') || null,
          height: heightMatch?.[1]?.trim() || null, weight: weightMatch?.[1] || null,
          year: yearMatch?.[1] || null, hometown: hometownMatch?.[1]?.trim() || null,
          bats_throws: btMatch?.[0] || null,
        });
      }
      if (results.length > 0) return results;
    }

    // ── SIDEARM table rows ──
    const sidearmRows = document.querySelectorAll('.sidearm-roster-player');
    if (sidearmRows.length > 0) {
      for (const row of sidearmRows) {
        const nameEl = row.querySelector('.sidearm-roster-player-name a');
        if (!nameEl) continue;
        const posEl = row.querySelector('.sidearm-roster-player-position');
        const abbrEl = posEl?.querySelector('.hide-on-medium');
        results.push({
          name: nameEl.textContent.trim(),
          position: (abbrEl?.textContent.trim() || posEl?.textContent.trim() || null),
          number: row.querySelector('.sidearm-roster-player-jersey')?.textContent.trim() || null,
          headshot: row.querySelector('img')?.src || null,
          height: row.querySelector('[data-label="Height"], [data-label="Ht."]')?.textContent.trim() || null,
          weight: row.querySelector('[data-label="Weight"], [data-label="Wt."]')?.textContent.trim() || null,
          year: row.querySelector('[data-label="Year"], [data-label="Yr."]')?.textContent.trim() || null,
          hometown: row.querySelector('[data-label="Hometown"]')?.textContent.trim() || null,
          bats_throws: row.querySelector('[data-label="B/T"]')?.textContent.trim() || null,
        });
      }
      if (results.length > 0) return results;
    }

    // ── Generic table fallback ──
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
          if (!name) { const link = cell.querySelector('a'); if (link) name = link.textContent.trim(); }
          if (!headshot) { const img = cell.querySelector('img'); if (img?.src?.includes('http') && !img.src.includes('logo')) headshot = img.src; }
          if (label.includes('no') || label === '#') number = text;
          else if (label.includes('pos')) position = text;
          else if (label.includes('ht') || label.includes('height')) height = text;
          else if (label.includes('wt') || label.includes('weight')) weight = text;
          else if (label.includes('yr') || label.includes('year') || label.includes('class')) year = text;
          else if (label.includes('home')) hometown = text;
          else if (label.includes('b/t') || label.includes('bat')) bats_throws = text;
        }
        if (name && name.length > 2) tableResults.push({ name, number, position, headshot, height, weight, year, hometown, bats_throws });
      }
      if (tableResults.length >= 5) return tableResults;
    }

    return results;
  });

  const pitchers = players.filter(p => p.position && PITCHER_RE.test(p.position));
  const allPositions = [...new Set(players.map(p => p.position).filter(Boolean))];
  console.log(`  Found ${players.length} players → ${pitchers.length} pitchers`);
  if (pitchers.length === 0 && players.length > 0) {
    console.log(`  Positions: ${allPositions.slice(0, 10).join(', ')}`);
  }
  return pitchers;
}

async function insertPitchers(team, pitchers) {
  if (pitchers.length === 0) return 0;
  const records = pitchers.map((p, i) => ({
    pitcher_id: `${team.team_id}-P${i + 1}`,
    team_id: team.team_id,
    name: p.name,
    display_name: p.name,
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
  if (error) { console.log(`  ❌ ${error.message}`); return 0; }
  return records.length;
}

async function main() {
  console.log('⚾ FIXING 5 REMAINING TEAMS');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  let total = 0;

  try {
    for (const team of TEAMS) {
      console.log(`\n📋 ${team.name} [${team.team_id}]`);
      const page = await browser.newPage();
      try {
        const pitchers = await scrapeTeam(page, team);
        if (pitchers.length > 0) {
          const inserted = await insertPitchers(team, pitchers);
          console.log(`  ✅ Inserted ${inserted} pitchers`);
          total += inserted;
        } else {
          console.log(`  ⚠️  No pitchers found`);
        }
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total inserted: ${total} pitchers`);
}

main().catch(console.error);
