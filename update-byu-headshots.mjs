/**
 * Scrape and update BYU pitcher headshots from their official roster page
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

const BYU_ROSTER_URL = 'https://byucougars.com/sports/baseball/roster';
const BYU_TEAM_ID = '127';

async function scrapeHeadshots() {
  console.log('🔍 Scraping BYU headshots...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(BYU_ROSTER_URL, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Scroll to load all images
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= scrollHeight; y += 500) {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1500);

    // Extract pitcher names and profile URLs from roster table
    const pitcherProfiles = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return [];

      const pitchers = [];
      const rows = table.querySelectorAll('tbody tr');

      rows.forEach(row => {
        const cells = [...row.querySelectorAll('td, th')];
        if (cells.length >= 3) {
          // Column 1 is TH with name and profile link
          const nameCell = cells[1];
          const positionCell = cells[2];

          const nameLink = nameCell?.querySelector('a');
          const name = nameLink?.textContent?.trim();
          const profileUrl = nameLink?.href;
          const position = positionCell?.textContent?.trim();

          // Check if it's a pitcher
          if (position && position.includes('Hand Pitcher')) {
            pitchers.push({
              name: name,
              profileUrl: profileUrl
            });
          }
        }
      });

      return pitchers;
    });

    console.log(`🎯 Found ${pitcherProfiles.length} pitchers in roster table\n`);

    // Visit each pitcher's profile page to get their headshot
    const headshotList = [];

    for (const pitcher of pitcherProfiles) {
      try {
        console.log(`  Visiting ${pitcher.name}...`);
        await page.goto(pitcher.profileUrl, { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(2000);

        // Extract headshot from profile page
        const headshot = await page.evaluate(() => {
          // Look for the main player image
          const images = [...document.querySelectorAll('img')];

          for (const img of images) {
            const src = img.src || '';
            const alt = img.alt?.trim();

            // Look for images that are likely player headshots
            if ((src.includes('byucougars.com') || src.includes('sidearmdev.com')) &&
                (src.includes('/roster/') || src.includes('/player/') || src.includes('headshot'))) {
              return src;
            }

            // Also check for large images with player name in alt
            if ((src.includes('byucougars.com') || src.includes('sidearmdev.com')) &&
                alt && img.naturalWidth > 200) {
              return src;
            }
          }

          return null;
        });

        if (headshot) {
          headshotList.push({
            name: pitcher.name,
            headshot: headshot
          });
          console.log(`    ✅ Found headshot`);
        } else {
          console.log(`    ⚠️  No headshot found`);
        }

        await page.waitForTimeout(500); // Be nice to the server
      } catch (error) {
        console.log(`    ❌ Error visiting profile: ${error.message}`);
      }
    }

    console.log(`\n📸 Collected ${headshotList.length} player headshots\n`);

    // Get BYU pitchers from database
    const { data: dbPitchers, error: dbError } = await supabase
      .from('cbb_pitchers')
      .select('pitcher_id, name, display_name, headshot')
      .eq('team_id', BYU_TEAM_ID);

    if (dbError) {
      console.error('❌ Error fetching BYU pitchers:', dbError.message);
      return 0;
    }

    console.log(`🎯 Found ${dbPitchers.length} BYU pitchers in database\n`);

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
        // Replace 100x100 with 600x600 for better quality
        let headshotUrl = match.headshot;
        if (headshotUrl.includes('width=100') && headshotUrl.includes('height=100')) {
          headshotUrl = headshotUrl
            .replace(/width=100/g, 'width=600')
            .replace(/height=100/g, 'height=600');
        }

        updates.push({
          pitcher_id: dbPitcher.pitcher_id,
          name: dbName,
          headshot: headshotUrl,
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
    console.error('❌ Error scraping BYU headshots:', error);
    return 0;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🏀 BYU Headshot Update\n');
  console.log('='.repeat(50) + '\n');

  const headshotsUpdated = await scrapeHeadshots();

  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ Complete! ${headshotsUpdated} BYU pitcher headshots updated`);
  console.log('\n🔄 Redeploy to Vercel to see changes\n');
}

main().catch(console.error);
