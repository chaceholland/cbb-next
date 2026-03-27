import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';
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

async function scrapeTeamRoster(teamName, teamId, url, browser) {
  console.log(`\n🔍 Scraping ${teamName}...`);
  
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Scroll to load content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    
    const players = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      let rosterTable = null;
      
      // Find the table with most rows (likely the roster)
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        if (!rosterTable || rows.length > rosterTable.querySelectorAll('tr').length) {
          if (rows.length > 10) {  // Must have at least 10 rows
            rosterTable = table;
          }
        }
      });
      
      if (!rosterTable) return [];
      
      const rows = rosterTable.querySelectorAll('tr');
      const players = [];
      
      // Skip header row
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
          
          // Only include pitchers
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

async function compareWithDatabase(teamName, teamId, scrapedPlayers) {
  const { data: dbPitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .eq('team_id', teamId);
  
  if (error) {
    console.error(`   ❌ Error fetching from DB: ${error.message}`);
    return null;
  }
  
  console.log(`   📊 Database: ${dbPitchers.length} | Scraped: ${scrapedPlayers.length}`);
  
  const matched = [];
  const newPlayers = [];
  const differences = [];
  
  for (const scraped of scrapedPlayers) {
    const normScraped = norm(scraped.name);
    const dbMatch = dbPitchers.find(db => {
      const normDb = norm(db.name || db.display_name);
      return normDb === normScraped || normDb.includes(normScraped) || normScraped.includes(normDb);
    });
    
    if (dbMatch) {
      matched.push({ scraped, db: dbMatch });
      
      // Check for differences
      const diffs = [];
      if (scraped.number && scraped.number !== dbMatch.number?.toString()) {
        diffs.push({ field: 'number', db: dbMatch.number, scraped: scraped.number });
      }
      if (scraped.year && scraped.year !== dbMatch.year) {
        diffs.push({ field: 'year', db: dbMatch.year, scraped: scraped.year });
      }
      if (scraped.height && scraped.height !== dbMatch.height) {
        diffs.push({ field: 'height', db: dbMatch.height, scraped: scraped.height });
      }
      if (scraped.weight && scraped.weight !== dbMatch.weight) {
        diffs.push({ field: 'weight', db: dbMatch.weight, scraped: scraped.weight });
      }
      if (scraped.batsThrows && scraped.batsThrows !== dbMatch.bats_throws) {
        diffs.push({ field: 'bats_throws', db: dbMatch.bats_throws, scraped: scraped.batsThrows });
      }
      if (scraped.hometown && scraped.hometown !== dbMatch.hometown) {
        diffs.push({ field: 'hometown', db: dbMatch.hometown, scraped: scraped.hometown });
      }
      
      if (diffs.length > 0) {
        differences.push({ name: scraped.name, diffs });
      }
    } else {
      newPlayers.push(scraped);
    }
  }
  
  const missing = dbPitchers.filter(db => {
    const normDb = norm(db.name || db.display_name);
    return !scrapedPlayers.some(s => {
      const normScraped = norm(s.name);
      return normDb === normScraped || normDb.includes(normScraped) || normScraped.includes(normDb);
    });
  });
  
  return { matched, newPlayers, differences, missing, dbPitchers, scrapedPlayers };
}

async function main() {
  console.log('🚀 Starting comprehensive team rescraping...\n');
  
  const browser = await chromium.launch({ headless: true });
  const allResults = {};
  
  for (const [teamName, { id, url }] of Object.entries(TEAMS)) {
    const scrapedPlayers = await scrapeTeamRoster(teamName, id, url, browser);
    const comparison = await compareWithDatabase(teamName, id, scrapedPlayers);
    
    if (comparison) {
      allResults[teamName] = comparison;
      
      console.log(`   ✅ Matched: ${comparison.matched.length}`);
      console.log(`   🆕 New: ${comparison.newPlayers.length}`);
      console.log(`   📝 Differences: ${comparison.differences.length}`);
      console.log(`   ⚠️  Missing: ${comparison.missing.length}`);
    }
  }
  
  await browser.close();
  
  // Generate detailed report
  console.log('\n\n========== DETAILED REPORT ==========\n');
  
  const report = [];
  
  for (const [teamName, data] of Object.entries(allResults)) {
    report.push(`\n${'='.repeat(60)}`);
    report.push(`${teamName.toUpperCase()}`);
    report.push(`${'='.repeat(60)}`);
    report.push(`\nDatabase: ${data.dbPitchers.length} pitchers`);
    report.push(`Scraped: ${data.scrapedPlayers.length} pitchers`);
    report.push(`Matched: ${data.matched.length}`);
    
    if (data.newPlayers.length > 0) {
      report.push(`\n🆕 NEW PLAYERS (${data.newPlayers.length}):`);
      data.newPlayers.forEach(p => {
        report.push(`   #${p.number} ${p.name} - ${p.position} ${p.year}`);
      });
    }
    
    if (data.differences.length > 0) {
      report.push(`\n📝 DIFFERENCES (${data.differences.length}):`);
      data.differences.forEach(({ name, diffs }) => {
        report.push(`   ${name}:`);
        diffs.forEach(d => {
          report.push(`      ${d.field}: "${d.db}" → "${d.scraped}"`);
        });
      });
    }
    
    if (data.missing.length > 0) {
      report.push(`\n⚠️  MISSING FROM WEBSITE (${data.missing.length}):`);
      data.missing.forEach(p => {
        report.push(`   ${p.name || p.display_name}`);
      });
    }
  }
  
  const reportText = report.join('\n');
  console.log(reportText);
  
  // Save to file
  writeFileSync('roster-comparison-report.txt', reportText);
  console.log('\n\n✅ Report saved to roster-comparison-report.txt');
}

main().catch(console.error);
