# 2026 Roster Scraping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all 2025 pitcher data with fresh 2026 rosters by scraping team roster pages in a two-phase approach.

**Architecture:** Phase 1 scrapes all team rosters to JSON for review. Phase 2 deletes old data and inserts new rosters after user confirmation. Resilient to individual team failures.

**Tech Stack:** Node.js, Playwright, Supabase, @supabase/supabase-js

---

## Task 1: Create Phase 1 Scraping Script Structure

**Files:**
- Create: `scrape-2026-rosters.mjs`

**Step 1: Create base script file with imports and config**

```javascript
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

async function main() {
  console.log('🏈 SCRAPING 2026 COLLEGE BASEBALL ROSTERS');
  console.log('='.repeat(60));
  console.log();

  // TODO: Implement scraping logic
}

main().catch(console.error);
```

**Step 2: Run to verify script structure**

Run: `node scrape-2026-rosters.mjs`

Expected: Prints header and exits without error

**Step 3: Commit base structure**

```bash
git add scrape-2026-rosters.mjs
git commit -m "feat: add Phase 1 scraping script structure

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Team Fetching Logic

**Files:**
- Modify: `scrape-2026-rosters.mjs`

**Step 1: Add function to fetch all teams from database**

Add after `normalizeName` function:

```javascript
async function fetchTeams() {
  const { data: teams, error } = await supabase
    .from('cbb_teams')
    .select('team_id, name, display_name, roster_url')
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
```

**Step 2: Update main function to fetch and display teams**

Replace `// TODO: Implement scraping logic` with:

```javascript
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
```

**Step 3: Run to verify team fetching**

Run: `node scrape-2026-rosters.mjs`

Expected: Shows team count and 0 successful/failed

**Step 4: Commit team fetching**

```bash
git add scrape-2026-rosters.mjs
git commit -m "feat: add team fetching from database

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Roster Scraping Function

**Files:**
- Modify: `scrape-2026-rosters.mjs`

**Step 1: Add roster scraping function**

Add after `fetchTeams` function:

```javascript
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

    await page.close();

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
    await page.close();
    teamResult.status = 'failed';
    teamResult.error = error.message;
    return teamResult;
  }
}
```

**Step 2: Run to verify function compiles**

Run: `node scrape-2026-rosters.mjs`

Expected: No syntax errors, runs successfully

**Step 3: Commit scraping function**

```bash
git add scrape-2026-rosters.mjs
git commit -m "feat: add roster page scraping function

Extracts pitcher data from team roster tables with fallback parsing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Integrate Scraping Loop

**Files:**
- Modify: `scrape-2026-rosters.mjs`

**Step 1: Add browser initialization and scraping loop**

In `main()` function, replace the section between team fetching and results display with:

```javascript
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
  const teamResult = await scrapeTeamRoster(browser, team);
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
```

**Step 2: Test scraping with a small subset**

Temporarily modify the team query to limit results:

```javascript
.select('team_id, name, display_name, roster_url')
.order('name')
.limit(3);  // Add this line temporarily
```

Run: `node scrape-2026-rosters.mjs`

Expected: Scrapes 3 teams successfully, shows pitcher counts

**Step 3: Remove limit and commit**

Remove the `.limit(3)` line, then commit:

```bash
git add scrape-2026-rosters.mjs
git commit -m "feat: integrate scraping loop with browser automation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add JSON Export and Final Reporting

**Files:**
- Modify: `scrape-2026-rosters.mjs`

**Step 1: Add JSON export after browser.close()**

Add after `await browser.close();`:

```javascript
// Save results to JSON
const outputPath = join(__dirname, '2026-rosters.json');
writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
```

**Step 2: Enhance final reporting section**

Replace the existing final reporting section with:

```javascript
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
```

**Step 3: Run full scraping**

Run: `node scrape-2026-rosters.mjs`

Expected: Scrapes all teams, creates 2026-rosters.json, shows summary

**Step 4: Verify JSON file structure**

Run: `head -50 2026-rosters.json`

Expected: Valid JSON with scrapedAt, totalTeams, teams array

**Step 5: Commit JSON export**

```bash
git add scrape-2026-rosters.mjs
git commit -m "feat: add JSON export and comprehensive reporting

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create Phase 2 Replacement Script Structure

**Files:**
- Create: `replace-with-2026-rosters.mjs`

**Step 1: Create base script with imports**

```javascript
#!/usr/bin/env node
/**
 * Phase 2: Replace Database with 2026 Rosters
 *
 * Reads 2026-rosters.json and replaces all pitcher data in the database.
 * WARNING: This deletes all existing pitcher and participation records!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper to get user confirmation
async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('📋 2026 ROSTER REPLACEMENT');
  console.log('='.repeat(60));
  console.log();

  // TODO: Implement replacement logic
}

main().catch(console.error);
```

**Step 2: Run to verify structure**

Run: `node replace-with-2026-rosters.mjs`

Expected: Prints header and exits

**Step 3: Commit base structure**

```bash
git add replace-with-2026-rosters.mjs
git commit -m "feat: add Phase 2 replacement script structure

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add JSON Loading and Summary Display

**Files:**
- Modify: `replace-with-2026-rosters.mjs`

**Step 1: Add JSON loading function**

Add after `confirm` function:

```javascript
function loadScrapedData() {
  const jsonPath = join(__dirname, '2026-rosters.json');

  if (!existsSync(jsonPath)) {
    console.error('❌ File not found: 2026-rosters.json');
    console.error('   Run scrape-2026-rosters.mjs first (Phase 1)\n');
    process.exit(1);
  }

  try {
    const json = readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(json);

    if (!data.totalPitchers || data.totalPitchers === 0) {
      console.error('❌ No pitchers found in scraped data');
      process.exit(1);
    }

    return data;
  } catch (error) {
    console.error('❌ Failed to read 2026-rosters.json:', error.message);
    process.exit(1);
  }
}
```

**Step 2: Add current database stats function**

Add after `loadScrapedData`:

```javascript
async function getCurrentStats() {
  const { count: pitcherCount } = await supabase
    .from('cbb_pitchers')
    .select('*', { count: 'exact', head: true });

  const { count: participationCount } = await supabase
    .from('cbb_pitcher_participation')
    .select('*', { count: 'exact', head: true });

  return {
    pitchers: pitcherCount || 0,
    participation: participationCount || 0
  };
}
```

**Step 3: Update main to show summary**

Replace `// TODO: Implement replacement logic` with:

```javascript
const scrapedData = loadScrapedData();
const currentStats = await getCurrentStats();

console.log('Source: 2026-rosters.json');
console.log(`Scraped: ${new Date(scrapedData.scrapedAt).toLocaleString()}\n`);

console.log(`Teams scraped:   ${scrapedData.successfulTeams}/${scrapedData.totalTeams} successful`);
console.log(`Total pitchers:  ${scrapedData.totalPitchers}\n`);

console.log('⚠️  WARNING: This will DELETE all existing pitcher data!\n');

console.log('Current database:');
console.log(`  - Pitchers: ${currentStats.pitchers.toLocaleString()}`);
console.log(`  - Participation records: ${currentStats.participation.toLocaleString()}\n`);

console.log('New data:');
console.log(`  - Pitchers: ${scrapedData.totalPitchers.toLocaleString()}\n`);

const confirmed = await confirm('Type \'yes\' to proceed with replacement: ');

if (!confirmed) {
  console.log('\n❌ Cancelled - No changes made to database\n');
  process.exit(0);
}

console.log('\n✅ Proceeding with replacement...\n');
```

**Step 4: Run to test summary (will exit at confirmation)**

Run: `node replace-with-2026-rosters.mjs`

Expected: Shows summary, prompts for confirmation, exits when typing anything except "yes"

**Step 5: Commit summary display**

```bash
git add replace-with-2026-rosters.mjs
git commit -m "feat: add JSON loading and summary display

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Database Deletion Logic

**Files:**
- Modify: `replace-with-2026-rosters.mjs`

**Step 1: Add deletion function**

Add after `getCurrentStats` function:

```javascript
async function deleteOldData() {
  console.log('🗑️  Deleting old data...');

  // Step 1: Delete participation records (child table)
  const { error: participationError } = await supabase
    .from('cbb_pitcher_participation')
    .delete()
    .neq('pitcher_id', '___MATCH_NOTHING___'); // Delete all records

  if (participationError) {
    console.error('❌ Failed to delete participation records:', participationError.message);
    process.exit(1);
  }

  const participationCount = (await getCurrentStats()).participation;
  console.log(`  ✅ Deleted ${participationCount} participation records`);

  // Step 2: Delete pitchers (parent table)
  const { error: pitcherError } = await supabase
    .from('cbb_pitchers')
    .delete()
    .neq('pitcher_id', '___MATCH_NOTHING___'); // Delete all records

  if (pitcherError) {
    console.error('❌ Failed to delete pitchers:', pitcherError.message);
    process.exit(1);
  }

  const pitcherCount = (await getCurrentStats()).pitchers;
  console.log(`  ✅ Deleted ${pitcherCount} pitchers\n`);
}
```

**Step 2: Add deletion call in main**

Add after the confirmation block:

```javascript
console.log('\n✅ Proceeding with replacement...\n');

await deleteOldData();

console.log('Deletion complete - ready for insertion\n');
```

**Step 3: Test deletion (CAREFUL - use test database if possible)**

If you have test data, run: `node replace-with-2026-rosters.mjs` and type "yes"

Expected: Deletes all pitcher records successfully

**Step 4: Commit deletion logic**

```bash
git add replace-with-2026-rosters.mjs
git commit -m "feat: add database deletion logic

Deletes participation records then pitchers to respect foreign keys

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Add Pitcher Insertion Logic

**Files:**
- Modify: `replace-with-2026-rosters.mjs`

**Step 1: Add insertion function**

Add after `deleteOldData` function:

```javascript
async function insertNewRosters(scrapedData) {
  console.log('📥 Inserting 2026 rosters...\n');

  let totalInserted = 0;

  for (const team of scrapedData.teams) {
    if (team.status !== 'success' || team.pitchers.length === 0) {
      continue;
    }

    // Generate pitcher IDs and prepare records
    const pitchersToInsert = team.pitchers.map((pitcher, index) => ({
      pitcher_id: `${team.team_id}-P${index + 1}`,
      team_id: team.team_id,
      name: pitcher.name,
      display_name: pitcher.display_name || pitcher.name,
      number: pitcher.number || null,
      position: pitcher.position || null,
      headshot: pitcher.headshot || null,
      height: pitcher.height || null,
      weight: pitcher.weight || null,
      year: pitcher.year || null,
      hometown: pitcher.hometown || null,
      bats_throws: pitcher.bats_throws || null
    }));

    // Batch insert for this team
    const { error } = await supabase
      .from('cbb_pitchers')
      .insert(pitchersToInsert);

    if (error) {
      console.log(`  ❌ ${team.team_name}: Failed to insert - ${error.message}`);
      continue;
    }

    console.log(`  ✅ ${team.team_name} (${pitchersToInsert.length} pitchers)`);
    totalInserted += pitchersToInsert.length;
  }

  return totalInserted;
}
```

**Step 2: Add insertion call and final reporting in main**

Replace `console.log('Deletion complete - ready for insertion\n');` with:

```javascript
const insertedCount = await insertNewRosters(scrapedData);

console.log('\n' + '='.repeat(60));
console.log('✅ REPLACEMENT COMPLETE');
console.log('='.repeat(60));
console.log(`\nInserted: ${insertedCount.toLocaleString()} pitchers across ${scrapedData.successfulTeams} teams\n`);

if (insertedCount !== scrapedData.totalPitchers) {
  console.log(`⚠️  Warning: Expected ${scrapedData.totalPitchers} pitchers but inserted ${insertedCount}`);
  console.log('   Some teams may have failed during insertion\n');
}
```

**Step 3: Test full replacement**

Run: `node replace-with-2026-rosters.mjs` and type "yes"

Expected: Deletes old data, inserts new rosters, shows completion

**Step 4: Verify data in database**

Run a quick query to check:

```javascript
// Create verify-2026-data.mjs temporarily
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data } = await supabase
  .from('cbb_pitchers')
  .select('team_id, name, position, year')
  .limit(10);

console.log(data);
```

Run: `node verify-2026-data.mjs`

Expected: Shows 2026 pitcher data with new IDs

**Step 5: Commit insertion logic**

```bash
git add replace-with-2026-rosters.mjs
git commit -m "feat: add pitcher insertion logic with batch operations

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Final Testing and Documentation

**Files:**
- Create: `docs/2026-roster-scraping-guide.md`

**Step 1: Create usage guide**

```markdown
# 2026 Roster Scraping Guide

## Overview

Two-phase system for replacing 2025 pitcher data with 2026 rosters.

## Phase 1: Scraping

Scrapes all team roster pages to JSON for review.

```bash
node scrape-2026-rosters.mjs
```

**Output:** `2026-rosters.json`

**Review checklist:**
- Check success rate (should be >80%)
- Verify total pitchers count seems reasonable
- Review failed teams list
- Check for teams with 0 pitchers (might be parsing issue)

## Phase 2: Replacement

⚠️  **WARNING:** Deletes all existing pitcher data!

```bash
node replace-with-2026-rosters.mjs
```

**Prompts for confirmation before deletion.**

## What Gets Deleted

- All records in `cbb_pitcher_participation` table
- All records in `cbb_pitchers` table

## What Gets Inserted

- All pitchers from successfully scraped teams
- Pitcher IDs in format: `{team_id}-P{index}`
- Only players with position P/RHP/LHP

## Error Handling

- Individual team failures don't stop the process
- Failed teams are logged but others continue
- Can re-run Phase 1 without affecting database
- Phase 2 requires confirmation before any changes

## Troubleshooting

**"No roster URL configured"**
- Team missing `roster_url` in `cbb_teams` table
- Update team record with correct URL

**"Timeout after 60s"**
- Roster page slow to load or unreachable
- Can re-run to retry specific team

**"0 pitchers found"**
- Roster page structure may have changed
- Check page manually to verify pitchers are listed
- May need to adjust parsing logic

**Success rate < 80%**
- Indicates widespread parsing issues
- Review several failed teams manually
- May need to update scraping patterns
```

**Step 2: Run full end-to-end test**

1. Run Phase 1: `node scrape-2026-rosters.mjs`
2. Review `2026-rosters.json`
3. Run Phase 2: `node replace-with-2026-rosters.mjs` (type "yes")
4. Verify database has new data

**Step 3: Commit documentation**

```bash
git add docs/2026-roster-scraping-guide.md
git commit -m "docs: add usage guide for 2026 roster scraping

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Step 4: Make scripts executable**

```bash
chmod +x scrape-2026-rosters.mjs replace-with-2026-rosters.mjs
git add scrape-2026-rosters.mjs replace-with-2026-rosters.mjs
git commit -m "chore: make scraping scripts executable

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Testing Checklist

Before considering complete:

- [ ] Phase 1 scrapes at least 80% of teams successfully
- [ ] JSON output has valid structure
- [ ] Phase 2 shows accurate summary before confirmation
- [ ] Deletion removes all old records
- [ ] Insertion creates pitcher records with correct IDs
- [ ] Database has new 2026 data after completion
- [ ] Failed teams are properly logged
- [ ] Can re-run Phase 1 without issues
- [ ] Confirmation prompt works correctly in Phase 2

## Success Criteria

1. ✅ Both scripts run without syntax errors
2. ✅ Phase 1 creates valid 2026-rosters.json
3. ✅ Phase 2 deletes old data safely (foreign keys respected)
4. ✅ Phase 2 inserts all scraped pitchers
5. ✅ Clear error messages for all failure cases
6. ✅ Documentation is complete and accurate
