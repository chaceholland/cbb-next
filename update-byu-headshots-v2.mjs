/**
 * Scrape BYU pitcher headshots with proper lazy-loading handling
 * BYU uses Vue.js lazy-loading, so we need to wait for images to load
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
  console.log('🔍 Scraping BYU headshots with lazy-load handling...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(BYU_ROSTER_URL, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract pitcher names and profile URLs from roster table
    const pitcherProfiles = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return [];

      const pitchers = [];
      const rows = table.querySelectorAll('tbody tr');

      rows.forEach(row => {
        const cells = [...row.querySelectorAll('td, th')];
        if (cells.length >= 3) {
          const nameCell = cells[1];
          const positionCell = cells[2];

          const nameLink = nameCell?.querySelector('a');
          const name = nameLink?.textContent?.trim();
          const profileUrl = nameLink?.href;
          const position = positionCell?.textContent?.trim();

          if (position && position.includes('Hand Pitcher')) {
            pitchers.push({ name, profileUrl });
          }
        }
      });

      return pitchers;
    });

    console.log(`🎯 Found ${pitcherProfiles.length} pitchers in roster table\n`);

    const headshotList = [];

    for (const pitcher of pitcherProfiles) {
      try {
        console.log(`  Visiting ${pitcher.name}...`);
        await page.goto(pitcher.profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Wait for page to settle and scroll to trigger lazy loading
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(2000);

        // Try multiple strategies to find the mugshot
        const headshot = await page.evaluate(() => {
          const allImages = [...document.querySelectorAll('img')];

          // Strategy 1: Look for images with specific alt text patterns (26BSB, mug, etc.)
          for (const img of allImages) {
            const alt = img.alt || '';
            const src = img.currentSrc || img.src || '';

            if ((alt.includes('26BSB') || alt.includes('25BSB') || alt.includes('24BSB') ||
                 alt.includes('web mug') || alt.includes('mug.jpg')) &&
                src.includes('byucougars.com') &&
                !src.includes('data:image') &&
                img.naturalWidth > 100) {
              return src;
            }
          }

          // Strategy 2: Look for the player info section and find nearby images
          const playerSection = document.querySelector('[class*="player-header"]');
          if (playerSection) {
            const nearbyImages = playerSection.querySelectorAll('img');
            for (const img of nearbyImages) {
              const src = img.currentSrc || img.src || '';
              if (src.includes('byucougars.com') &&
                  !src.includes('data:image') &&
                  img.naturalWidth > 100 &&
                  img.naturalWidth < 800) { // Mugshots are smaller than action shots
                return src;
              }
            }
          }

          // Strategy 3: Find smallest loaded image (likely the mugshot vs action shot)
          const loadedImages = allImages
            .filter(img => {
              const src = img.currentSrc || img.src || '';
              return src.includes('byucougars.com') &&
                     !src.includes('data:image') &&
                     img.naturalWidth > 100;
            })
            .sort((a, b) => (a.naturalWidth * a.naturalHeight) - (b.naturalWidth * b.naturalHeight));

          if (loadedImages.length > 0) {
            // Take the smallest reasonable image (mugshot should be smaller than action shot)
            for (const img of loadedImages) {
              if (img.naturalWidth >= 200 && img.naturalWidth <= 800) {
                return img.currentSrc || img.src;
              }
            }
          }

          return null;
        });

        if (headshot) {
          headshotList.push({
            name: pitcher.name,
            headshot: headshot
          });
          console.log(`    ✅ Found headshot (${headshot.substring(0, 80)}...)`);
        } else {
          console.log(`    ⚠️  No headshot found`);
        }

        await page.waitForTimeout(500);
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
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
    console.error('❌ Error scraping BYU headshots:', error);
    return 0;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🏀 BYU Headshot Update v2 (with lazy-loading)\n');
  console.log('='.repeat(60) + '\n');

  const headshotsUpdated = await scrapeHeadshots();

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Complete! ${headshotsUpdated} BYU pitcher headshots updated`);
  console.log('\n🔄 Redeploy to Vercel to see changes\n');
}

main().catch(console.error);
