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

const supabase = createClient(supabaseUrl, supabaseKey);

const TEAMS = {
  'Rutgers': { id: '102', url: 'https://scarletknights.com/sports/baseball/roster' },
  'UCLA': { id: '66', url: 'https://uclabruins.com/sports/baseball/roster' },
  'Texas': { id: '126', url: 'https://texassports.com/sports/baseball/roster' },
  'Alabama': { id: '148', url: 'https://rolltide.com/sports/baseball/roster' },
  'Arizona State': { id: '59', url: 'https://thesundevils.com/sports/baseball/roster' }
};

const norm = name => name?.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim() ?? '';

async function scrapeTeamRoster(teamName, teamId, url) {
  console.log(`\n🔍 Scraping ${teamName} roster from ${url}...`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Scroll to load all content
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= scrollHeight; y += 500) {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(2000);
    
    const players = await page.evaluate(() => {
      const results = [];
      
      // Try multiple selector patterns
      const selectors = [
        '.sidearm-roster-player',
        '[class*="roster-player"]',
        '[class*="player-card"]',
        '.s-person-card',
        '[data-player]'
      ];
      
      let cards = [];
      for (const sel of selectors) {
        cards = [...document.querySelectorAll(sel)];
        if (cards.length > 5) break;
      }
      
      console.log(`Found ${cards.length} player cards`);
      
      cards.forEach(card => {
        const name = card.querySelector('h2, h3, .sidearm-roster-player-name, [class*="name"]')?.textContent?.trim();
        const number = card.querySelector('.sidearm-roster-player-jersey-number, [class*="number"], [class*="jersey"]')?.textContent?.trim();
        const position = card.querySelector('.sidearm-roster-player-position, [class*="position"]')?.textContent?.trim();
        const year = card.querySelector('.sidearm-roster-player-academic-year, [class*="year"], [class*="class"]')?.textContent?.trim();
        const hometown = card.querySelector('.sidearm-roster-player-hometown, [class*="hometown"]')?.textContent?.trim();
        
        // Height/Weight often combined
        const heightWeight = card.querySelector('.sidearm-roster-player-height-weight, [class*="height"]')?.textContent?.trim();
        const img = card.querySelector('img');
        const headshot = img?.src || img?.getAttribute('data-src');
        
        if (name && (position?.toLowerCase().includes('pitch') || position?.toLowerCase().includes('rhp') || position?.toLowerCase().includes('lhp'))) {
          results.push({
            name,
            number,
            position,
            year,
            hometown,
            heightWeight,
            headshot: headshot && !headshot.includes('logo') ? headshot : null
          });
        }
      });
      
      return results;
    });
    
    console.log(`   Found ${players.length} pitchers`);
    return players;
    
  } catch (error) {
    console.error(`   ❌ Error scraping ${teamName}:`, error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function compareWithDatabase(teamName, teamId, scrapedPlayers) {
  console.log(`\n📊 Comparing ${teamName} data with database...`);
  
  const { data: dbPitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .eq('team_id', teamId);
  
  if (error) {
    console.error(`   ❌ Error fetching ${teamName} from database:`, error.message);
    return;
  }
  
  console.log(`   Database: ${dbPitchers.length} pitchers`);
  console.log(`   Scraped: ${scrapedPlayers.length} pitchers\n`);
  
  // Match scraped to database
  const matched = [];
  const newPlayers = [];
  
  for (const scraped of scrapedPlayers) {
    const normScraped = norm(scraped.name);
    const dbMatch = dbPitchers.find(db => {
      const normDb = norm(db.name || db.display_name);
      return normDb === normScraped || normDb.includes(normScraped) || normScraped.includes(normDb);
    });
    
    if (dbMatch) {
      matched.push({ scraped, db: dbMatch });
    } else {
      newPlayers.push(scraped);
    }
  }
  
  console.log(`   ✅ Matched: ${matched.length}`);
  console.log(`   🆕 New players found: ${newPlayers.length}`);
  
  if (newPlayers.length > 0) {
    console.log('\n   New Players:');
    newPlayers.forEach(p => console.log(`      - ${p.name} (${p.position})`));
  }
  
  // Check for differences in matched players
  const differences = [];
  for (const { scraped, db } of matched) {
    const diffs = [];
    
    if (scraped.number && scraped.number !== db.number?.toString()) {
      diffs.push(`number: DB="${db.number}" → Scraped="${scraped.number}"`);
    }
    if (scraped.headshot && scraped.headshot !== db.headshot) {
      diffs.push(`headshot: updated`);
    }
    if (scraped.year && scraped.year !== db.year) {
      diffs.push(`year: DB="${db.year}" → Scraped="${scraped.year}"`);
    }
    
    if (diffs.length > 0) {
      differences.push({ name: scraped.name, diffs });
    }
  }
  
  if (differences.length > 0) {
    console.log(`\n   📝 Differences found in ${differences.length} players:`);
    differences.forEach(({ name, diffs }) => {
      console.log(`      ${name}:`);
      diffs.forEach(d => console.log(`         - ${d}`));
    });
  }
  
  // Missing from scrape
  const missing = dbPitchers.filter(db => {
    const normDb = norm(db.name || db.display_name);
    return !scrapedPlayers.some(s => {
      const normScraped = norm(s.name);
      return normDb === normScraped || normDb.includes(normScraped) || normScraped.includes(normDb);
    });
  });
  
  if (missing.length > 0) {
    console.log(`\n   ⚠️  Missing from scrape (in DB but not on website): ${missing.length}`);
    missing.forEach(p => console.log(`      - ${p.name || p.display_name}`));
  }
  
  return { matched, newPlayers, differences, missing };
}

async function main() {
  console.log('🚀 Starting team roster rescraping...\n');
  
  const allResults = {};
  
  for (const [teamName, { id, url }] of Object.entries(TEAMS)) {
    const scrapedPlayers = await scrapeTeamRoster(teamName, id, url);
    const comparison = await compareWithDatabase(teamName, id, scrapedPlayers);
    allResults[teamName] = { scrapedPlayers, comparison };
  }
  
  console.log('\n\n========== SUMMARY ==========\n');
  for (const [teamName, { comparison }] of Object.entries(allResults)) {
    if (comparison) {
      console.log(`${teamName}:`);
      console.log(`   Matched: ${comparison.matched.length}`);
      console.log(`   New: ${comparison.newPlayers.length}`);
      console.log(`   Differences: ${comparison.differences.length}`);
      console.log(`   Missing: ${comparison.missing.length}`);
    }
  }
}

main().catch(console.error);
