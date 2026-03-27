#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { chromium } from 'playwright';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Test the improved parsing on Alabama
async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Loading Alabama roster...');
    await page.goto('https://rolltide.com/sports/baseball/roster', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    const rosterData = await page.evaluate(() => {
      const players = [];
      const tables = document.querySelectorAll('table');

      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        if (rows.length === 0) continue;

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td, th'));
          if (cells.length < 4) continue;

          const cellTexts = cells.map(c => c.textContent?.trim() || '');

          // Find name cell
          let nameIdx = -1;
          let name = null;

          for (let i = 0; i < cells.length && i < 5; i++) {
            const cell = cells[i];
            const text = cellTexts[i];

            if (/^\d{1,3}$/.test(text)) continue;

            if (cell.querySelector('a[href*="/roster/"], a[href*="/player/"]') ||
                (text.split(' ').length >= 2 && text.split(' ').length <= 4 && text.length > 5)) {
              nameIdx = i;
              name = text;
              break;
            }
          }

          if (!name || nameIdx === -1) continue;

          let height = null, weight = null, year = null, hometown = null, batsThrows = null, position = null;

          for (let i = 0; i < cellTexts.length; i++) {
            const text = cellTexts[i];
            if (!text || i === nameIdx) continue;

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
            } else {
              if (!height && /\d+[-']\s*\d+/.test(text)) {
                height = text;
              } else if (!weight && /^(1[5-9]\d|[2-3]\d{2})(\s*lbs?)?$/i.test(text)) {
                weight = text;
              } else if (!year && /^(r-)?(fr|so|jr|sr|freshman|sophomore|junior|senior)\.?$/i.test(text)) {
                year = text;
              } else if (!batsThrows && /^[LR][-\/][LR]$/i.test(text)) {
                batsThrows = text;
              } else if (!position && /^(P|RHP|LHP|C|1B|2B|3B|SS|OF|INF|UTIL)$/i.test(text)) {
                position = text;
              } else if (!hometown && text.length > 10 && (text.includes(',') || text.includes('/'))) {
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

        if (players.length > 0) break;
      }

      return players;
    });

    console.log(`\nFound ${rosterData.length} players\n`);

    // Show pitchers only
    const pitchers = rosterData.filter(p => p.position?.includes('P') || p.position === 'RHP' || p.position === 'LHP');
    console.log(`Found ${pitchers.length} pitchers:\n`);

    pitchers.slice(0, 10).forEach(p => {
      console.log(`${p.name}`);
      console.log(`  Position: ${p.position || 'N/A'}`);
      console.log(`  Height: ${p.height || 'N/A'}, Weight: ${p.weight || 'N/A'}`);
      console.log(`  Year: ${p.year || 'N/A'}`);
      console.log(`  Hometown: ${p.hometown || 'N/A'}`);
      console.log(`  B/T: ${p.batsThrows || 'N/A'}`);
      console.log();
    });

    await browser.close();
  } catch (error) {
    console.error('Error:', error);
    await browser.close();
  }
}

test();
