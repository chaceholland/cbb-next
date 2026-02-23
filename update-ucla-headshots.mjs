/**
 * Scrape and update UCLA pitcher headshots from their official roster page
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
const norm = name => name?.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim() ?? '';

const UCLA_ROSTER_URL = 'https://uclabruins.com/sports/baseball/roster';
const UCLA_TEAM_ID = '66';

async function scrapeHeadshots() {
  console.log('🔍 Scraping UCLA headshots...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(UCLA_ROSTER_URL, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Scroll to load all images
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= scrollHeight; y += 500) {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1500);

    // Extract player headshots
    const scraped = await page.evaluate(() => {
      const results = [];
      const debug = [];

      // First, get names from the roster table
      const table = document.querySelector('table');
      const pitcherNames = [];

      if (table) {
        const rows = table.querySelectorAll('tr');
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].querySelectorAll('td');
          if (cells.length >= 3) {
            const name = cells[1]?.textContent?.trim();
            const position = cells[2]?.textContent?.trim();
            if (name && (position === 'RHP' || position === 'LHP')) {
              pitcherNames.push(name);
            }
          }
        }
      }

      // Now find images by decoding their URLs and matching filenames to last names
      const allImages = [...document.querySelectorAll('img')];
      const seen = new Set();

      allImages.forEach(img => {
        const alt = img.alt?.trim();
        const src = img.src || '';

        // Only process UCLA roster images
        if (!src.includes('dxbhsrqyrr690.cloudfront.net') || !src.includes('2026')) {
          return;
        }

        // Debug: collect some samples
        if (debug.length < 10) {
          debug.push({ alt: alt || '(empty)', src: src.substring(0, 150) });
        }

        // Extract filename from URL-encoded parameter
        try {
          const urlMatch = src.match(/url=([^&]+)/);
          if (urlMatch) {
            const decodedUrl = decodeURIComponent(urlMatch[1]);
            const filename = decodedUrl.split('/').pop()?.replace('.png', '') || '';

            // Match filename to pitcher last names
            for (const fullName of pitcherNames) {
              const nameParts = fullName.split(' ');
              const lastName = nameParts[nameParts.length - 1];

              // Handle names with apostrophes (O'Connor -> O_Connor)
              const normalizedFileName = filename.replace('_', "'");
              const normalizedLastName = lastName.replace("'", "_");

              if (filename === lastName ||
                  filename === normalizedLastName ||
                  normalizedFileName === lastName) {
                if (!seen.has(fullName)) {
                  seen.add(fullName);
                  results.push({
                    name: fullName,
                    headshot: src
                  });
                  break;
                }
              }
            }
          }
        } catch (e) {
          // Skip if URL parsing fails
        }
      });

      return { results, debug, pitcherCount: pitcherNames.length };
    });

    console.log('🐛 Debug sample images:', JSON.stringify(scraped.debug, null, 2));
    console.log(`🎯 Found ${scraped.pitcherCount} pitchers in roster table\n`);

    const headshotList = scraped.results;
    console.log(`📸 Matched ${headshotList.length} player headshots on UCLA roster\n`);

    // Get UCLA pitchers from database
    const { data: dbPitchers, error: dbError } = await supabase
      .from('cbb_pitchers')
      .select('pitcher_id, name, display_name, headshot')
      .eq('team_id', UCLA_TEAM_ID);

    if (dbError) {
      console.error('❌ Error fetching UCLA pitchers:', dbError.message);
      return 0;
    }

    console.log(`🎯 Found ${dbPitchers.length} UCLA pitchers in database\n`);

    // Match and update
    const updates = [];
    for (const dbPitcher of dbPitchers) {
      const dbName = dbPitcher.display_name || dbPitcher.name;
      const normDb = norm(dbName);

      const match = headshotList.find(s => norm(s.name) === normDb)
        || headshotList.find(s => {
          const normScraped = norm(s.name);
          return normScraped.includes(normDb) || normDb.includes(normScraped);
        });

      if (match) {
        updates.push({
          pitcher_id: dbPitcher.pitcher_id,
          name: dbName,
          headshot: match.headshot,
          current: dbPitcher.headshot
        });
      }
    }

    console.log(`✅ Matched ${updates.length} pitchers with headshots\n`);

    // Update Supabase
    if (updates.length > 0) {
      console.log('📝 Updating headshots in database...\n');

      for (const update of updates) {
        const { error } = await supabase
          .from('cbb_pitchers')
          .update({ headshot: update.headshot })
          .eq('pitcher_id', update.pitcher_id);

        if (error) {
          console.error(`❌ Error updating ${update.name}:`, error.message);
        } else {
          const status = update.current ? '🔄' : '✨';
          console.log(`${status} Updated ${update.name}`);
        }
      }
    }

    return updates.length;

  } catch (error) {
    console.error('❌ Error scraping UCLA headshots:', error);
    return 0;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🏀 UCLA Headshot Update\n');
  console.log('='.repeat(50) + '\n');

  const headshotsUpdated = await scrapeHeadshots();

  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ Complete! ${headshotsUpdated} UCLA pitcher headshots updated`);
  console.log('\n🔄 Hard refresh https://cbb-next.vercel.app to see changes\n');
}

main().catch(console.error);
