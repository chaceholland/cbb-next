#!/usr/bin/env node
/**
 * Test bio data scraping on a single team to debug parsing
 */

import { chromium } from 'playwright';

async function testTeam(url, teamName) {
  console.log(`Testing: ${teamName}`);
  console.log(`URL: ${url}\n`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Loading page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    console.log('Page loaded. Extracting roster data...\n');

    // Take screenshot for debugging
    await page.screenshot({ path: `test-roster-${teamName.replace(/\s+/g, '-')}.png`, fullPage: true });

    //Try multiple strategies
    const results = await page.evaluate(() => {
      const strategies = {};

      // Strategy 1: Standard Sidearm roster table
      strategies.sidearm_table = [];
      const sidearmRows = document.querySelectorAll('table.roster tbody tr, .sidearm-roster-players tbody tr');
      for (const row of sidearmRows) {
        const nameCell = row.querySelector('td.name, td[data-label="Name"], a.sidearm-roster-player-name');
        if (!nameCell) continue;

        const cells = row.querySelectorAll('td');
        const player = {
          name: nameCell.textContent?.trim(),
          cells: Array.from(cells).map(c => ({
            label: c.getAttribute('data-label'),
            text: c.textContent?.trim()
          }))
        };
        strategies.sidearm_table.push(player);
      }

      // Strategy 2: Check for any table rows
      strategies.any_table = [];
      const allRows = document.querySelectorAll('table tbody tr');
      if (allRows.length > 0 && allRows.length < 100) {
        for (const row of allRows) {
          const cells = row.querySelectorAll('td, th');
          strategies.any_table.push({
            cells: Array.from(cells).map(c => ({
              label: c.getAttribute('data-label') || c.className,
              text: c.textContent?.trim(),
              html: c.innerHTML.substring(0, 100)
            }))
          });
        }
      }

      // Strategy 3: Look for specific patterns
      strategies.patterns = {
        hasHeightPattern: !!document.body.innerHTML.match(/\d+[-']\d+/),
        hasWeightPattern: !!document.body.innerHTML.match(/\d{2,3}\s*lbs?/i),
        hasYearPattern: !!document.body.innerHTML.match(/freshman|sophomore|junior|senior|fr\.|so\.|jr\.|sr\./i),
        hasHometownPattern: !!document.body.innerHTML.match(/hometown|home town/i),
      };

      // Strategy 4: Check page structure
      strategies.structure = {
        hasSidearmRoster: !!document.querySelector('.sidearm-roster-players'),
        hasRosterTable: !!document.querySelector('table.roster'),
        hasAnyTable: !!document.querySelector('table'),
        tableCount: document.querySelectorAll('table').length,
        mainClasses: document.querySelector('main, .main, #main')?.className || 'none'
      };

      return strategies;
    });

    console.log('='.repeat(80));
    console.log('STRATEGY RESULTS:\n');
    console.log(JSON.stringify(results, null, 2));
    console.log('='.repeat(80));

    console.log(`\nScreenshot saved to: test-roster-${teamName.replace(/\s+/g, '-')}.png`);
    console.log('\nPress Enter to close browser...');

    // Keep browser open for manual inspection
    await new Promise(resolve => process.stdin.once('data', resolve));

    await browser.close();
  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

// Test on a team that should have bio data
const testCases = [
  { url: 'https://rolltide.com/sports/baseball/roster', name: 'Alabama' },
  // { url: 'https://clemsontigers.com/sports/baseball/roster', name: 'Clemson' },
  // { url: 'https://purduesports.com/sports/baseball/roster', name: 'Purdue' },
];

(async () => {
  for (const test of testCases) {
    await testTeam(test.url, test.name);
  }
})();
