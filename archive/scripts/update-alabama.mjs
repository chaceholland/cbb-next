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

const norm = name => name?.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim() ?? '';

async function scrapeAlabama() {
  console.log('🔍 Scraping Alabama roster...\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://rolltide.com/sports/baseball/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
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
    
    console.log(`✅ Found ${players.length} pitchers on website\n`);
    return players;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function processAlabama(scrapedPlayers) {
  const teamId = '148';
  
  // Get current database pitchers
  const { data: dbPitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .eq('team_id', teamId);
  
  if (error) {
    console.error('❌ Error fetching from DB:', error.message);
    return;
  }
  
  console.log(`📊 Database has ${dbPitchers.length} Alabama pitchers\n`);
  
  // Get team logo for new players
  const { data: team } = await supabase
    .from('cbb_teams')
    .select('logo')
    .eq('team_id', teamId)
    .single();
  
  const teamLogo = team?.logo || '/logos/148.png';
  
  // Categorize players
  const matched = [];
  const newPlayers = [];
  const missing = [];
  
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
  
  // Find missing players
  for (const db of dbPitchers) {
    const normDb = norm(db.name || db.display_name);
    const found = scrapedPlayers.some(s => {
      const normScraped = norm(s.name);
      return normDb === normScraped || normDb.includes(normScraped) || normScraped.includes(normDb);
    });
    
    if (!found) {
      missing.push(db);
    }
  }
  
  console.log(`✅ Matched: ${matched.length}`);
  console.log(`🆕 New players: ${newPlayers.length}`);
  console.log(`⚠️  Missing from website: ${missing.length}\n`);
  
  // Update matched players
  console.log('📝 Updating matched players...\n');
  let updated = 0;
  
  for (const { scraped, db } of matched) {
    const updates = {};
    
    if (scraped.number && !db.number) updates.number = scraped.number;
    if (scraped.year && !db.year) updates.year = scraped.year;
    if (scraped.height && !db.height) updates.height = scraped.height;
    if (scraped.weight && !db.weight) updates.weight = scraped.weight;
    if (scraped.batsThrows && !db.bats_throws) updates.bats_throws = scraped.batsThrows;
    if (scraped.hometown && !db.hometown) updates.hometown = scraped.hometown;
    
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('cbb_pitchers')
        .update(updates)
        .eq('pitcher_id', db.pitcher_id);
      
      if (updateError) {
        console.error(`   ❌ ${scraped.name}:`, updateError.message);
      } else {
        console.log(`   ✅ ${scraped.name} (${Object.keys(updates).length} fields)`);
        updated++;
      }
    }
  }
  
  console.log(`\n📊 Updated ${updated} matched players\n`);
  
  // Add new players
  console.log('🆕 Adding new players...\n');
  let added = 0;
  
  for (const player of newPlayers) {
    // Generate pitcher_id (format: team_id + sequential number)
    const maxId = await supabase
      .from('cbb_pitchers')
      .select('pitcher_id')
      .eq('team_id', teamId)
      .order('pitcher_id', { ascending: false })
      .limit(1);
    
    let nextNum = 1;
    if (maxId.data && maxId.data.length > 0) {
      const lastId = maxId.data[0].pitcher_id;
      const match = lastId.match(/-P(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }
    
    const newPitcherId = `${teamId}-P${nextNum}`;
    
    const { error: insertError } = await supabase
      .from('cbb_pitchers')
      .insert({
        pitcher_id: newPitcherId,
        team_id: teamId,
        name: player.name,
        display_name: player.name,
        number: player.number,
        position: player.position,
        year: player.year,
        height: player.height,
        weight: player.weight,
        bats_throws: player.batsThrows,
        hometown: player.hometown,
        headshot: teamLogo
      });
    
    if (insertError) {
      console.error(`   ❌ ${player.name}:`, insertError.message);
    } else {
      console.log(`   ✅ Added ${player.name} (#${player.number})`);
      added++;
    }
  }
  
  console.log(`\n📊 Added ${added} new players\n`);
  
  // Report missing players
  if (missing.length > 0) {
    console.log('⚠️  Players in database but not on website (likely transferred/graduated):\n');
    missing.forEach(p => {
      console.log(`   - ${p.name || p.display_name} (#${p.number || '?'})`);
    });
    console.log('\n💡 These players may need to be removed from the database.');
  }
  
  return { updated, added, missing: missing.length };
}

async function main() {
  console.log('🚀 Processing Alabama roster changes...\n');
  
  const scrapedPlayers = await scrapeAlabama();
  
  if (scrapedPlayers.length === 0) {
    console.error('❌ No players scraped, aborting.');
    return;
  }
  
  const result = await processAlabama(scrapedPlayers);
  
  console.log('\n========== SUMMARY ==========\n');
  console.log(`✅ Updated: ${result.updated} players`);
  console.log(`🆕 Added: ${result.added} new players`);
  console.log(`⚠️  Missing: ${result.missing} players (may need removal)\n`);
  
  console.log('✅ Alabama roster processing complete!');
  console.log('\n🔄 Hard refresh https://cbb-next.vercel.app to see changes');
}

main().catch(console.error);
