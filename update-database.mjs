import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
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
  'Texas': { id: '126', url: 'https://texassports.com/sports/baseball/roster' }
};

const norm = name => name?.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim() ?? '';

async function scrapeTeamRoster(teamName, teamId, url, browser) {
  console.log(`\n🔍 Scraping ${teamName}...`);
  
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    
    const players = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      let rosterTable = null;
      
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        if (!rosterTable || rows.length > rosterTable.querySelectorAll('tr').length) {
          if (rows.length > 10) {
            rosterTable = table;
          }
        }
      });
      
      if (!rosterTable) return [];
      
      const rows = rosterTable.querySelectorAll('tr');
      const players = [];
      
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        if (cells.length >= 4) {
          const number = cells[0]?.textContent?.trim();
          const name = cells[1]?.textContent?.trim();
          const position = cells[2]?.textContent?.trim();
          const year = cells[3]?.textContent?.trim();
          const height = cells[4]?.textContent?.trim();
          const weight = cells[5]?.textContent?.trim();
          const batsThrows = cells[6]?.textContent?.trim();
          const hometown = cells[7]?.textContent?.trim();
          
          if (position && (position.includes('RHP') || position.includes('LHP') || position.toLowerCase().includes('pitch'))) {
            players.push({
              number,
              name,
              position,
              year,
              height,
              weight,
              batsThrows,
              hometown
            });
          }
        }
      }
      
      return players;
    });
    
    console.log(`   ✅ Found ${players.length} pitchers`);
    return players;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return [];
  } finally {
    await page.close();
  }
}

async function updateDatabase(teamName, teamId, scrapedPlayers) {
  console.log(`\n📝 Updating ${teamName} in database...`);
  
  const { data: dbPitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .eq('team_id', teamId);
  
  if (error) {
    console.error(`   ❌ Error fetching from DB: ${error.message}`);
    return;
  }
  
  let updated = 0;
  let errors = 0;
  
  for (const scraped of scrapedPlayers) {
    const normScraped = norm(scraped.name);
    const dbMatch = dbPitchers.find(db => {
      const normDb = norm(db.name || db.display_name);
      return normDb === normScraped || normDb.includes(normScraped) || normScraped.includes(normDb);
    });
    
    if (dbMatch) {
      // Build update object with only non-null scraped values
      const updates = {};
      
      if (scraped.number && !dbMatch.number) updates.number = scraped.number;
      if (scraped.year && !dbMatch.year) updates.year = scraped.year;
      if (scraped.height && !dbMatch.height) updates.height = scraped.height;
      if (scraped.weight && !dbMatch.weight) updates.weight = scraped.weight;
      if (scraped.batsThrows && !dbMatch.bats_throws) updates.bats_throws = scraped.batsThrows;
      if (scraped.hometown && !dbMatch.hometown) updates.hometown = scraped.hometown;
      
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('cbb_pitchers')
          .update(updates)
          .eq('pitcher_id', dbMatch.pitcher_id);
        
        if (updateError) {
          console.error(`   ❌ Error updating ${scraped.name}:`, updateError.message);
          errors++;
        } else {
          console.log(`   ✅ Updated ${scraped.name} (${Object.keys(updates).length} fields)`);
          updated++;
        }
      }
    }
  }
  
  console.log(`\n   📊 Summary: ${updated} updated, ${errors} errors`);
  return { updated, errors };
}

async function main() {
  console.log('🚀 Updating database with scraped roster data...\n');
  
  const browser = await chromium.launch({ headless: true });
  const results = {};
  
  for (const [teamName, { id, url }] of Object.entries(TEAMS)) {
    const scrapedPlayers = await scrapeTeamRoster(teamName, id, url, browser);
    const result = await updateDatabase(teamName, id, scrapedPlayers);
    results[teamName] = result;
  }
  
  await browser.close();
  
  console.log('\n\n========== FINAL SUMMARY ==========\n');
  let totalUpdated = 0;
  let totalErrors = 0;
  
  for (const [teamName, result] of Object.entries(results)) {
    if (result) {
      console.log(`${teamName}: ${result.updated} pitchers updated, ${result.errors} errors`);
      totalUpdated += result.updated;
      totalErrors += result.errors;
    }
  }
  
  console.log(`\nTotal: ${totalUpdated} pitchers updated across 3 teams`);
  
  if (totalErrors > 0) {
    console.log(`⚠️  ${totalErrors} errors encountered`);
  } else {
    console.log('\n✅ All updates completed successfully!');
    console.log('\n🔄 Hard refresh https://cbb-next.vercel.app to see changes');
  }
}

main().catch(console.error);
