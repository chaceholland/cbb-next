#!/usr/bin/env node
/**
 * Fix Penn State headshots by parsing __NUXT_DATA__ from their roster page.
 * Photos are embedded in player.master_photo.url (updated) or photo.url (older).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TEAM_ID = '414';
const ROSTER_URL = 'https://gopsusports.com/sports/baseball/roster';

function deref(arr, idx, visited = new Set()) {
  if (typeof idx !== 'number') return idx;
  if (visited.has(idx)) return null;
  visited.add(idx);
  const val = arr[idx];
  if (Array.isArray(val)) return val.map(v => deref(arr, v, new Set(visited)));
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = deref(arr, v, new Set(visited));
    return out;
  }
  return val;
}

const normName = name => {
  if (!name) return '';
  if (name.includes(',')) {
    const [last, first] = name.split(',').map(s => s.trim());
    name = `${first} ${last}`;
  }
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
};

async function main() {
  console.log('⚾ FIXING PENN STATE HEADSHOTS (NUXT DATA)\n');

  console.log(`Fetching ${ROSTER_URL}...`);
  const res = await fetch(ROSTER_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  const html = await res.text();
  console.log(`Got ${html.length} bytes`);

  const nuxtMarker = '"__NUXT_DATA__">[';
  const start = html.indexOf(nuxtMarker);
  if (start < 0) throw new Error('__NUXT_DATA__ not found');

  const dataStart = start + nuxtMarker.length - 1;
  let depth = 0, i = dataStart, end = dataStart;
  while (i < html.length) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
    i++;
  }

  const arr = JSON.parse(html.slice(dataStart, end));
  console.log(`Parsed NUXT data: ${arr.length} entries`);

  // Find state object with roster key
  const stateObj = arr.find(v =>
    v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).some(k => k.includes('roster-') && k.includes('-players-list'))
  );
  if (!stateObj) throw new Error('Could not find players list key in NUXT data');

  const rosterKey = Object.keys(stateObj).find(k => k.includes('-players-list'));
  console.log(`Using roster key: ${rosterKey}`);

  const playersIdx = stateObj[rosterKey];
  const playersContainer = arr[playersIdx];
  const players = deref(arr, playersContainer.players);

  if (!Array.isArray(players)) throw new Error('Players is not an array');
  console.log(`Total players: ${players.length}`);

  // Extract name + photo for all players
  const scraped = players
    .map(p => {
      const name = p.player?.full_name ||
        [p.player?.first_name, p.player?.last_name].filter(Boolean).join(' ');
      // Prefer master_photo (2026 updated) over photo (older)
      const photoUrl = p.player?.master_photo?.url || p.photo?.url || null;
      return { name, headshot: photoUrl };
    })
    .filter(p => p.name && p.headshot);

  console.log(`Players with photos: ${scraped.length}`);

  // Get DB pitchers missing headshots
  const { data: missing } = await supabase
    .from('cbb_pitchers')
    .select('pitcher_id, name')
    .eq('team_id', TEAM_ID)
    .or('headshot.is.null,headshot.eq.');

  console.log(`DB pitchers missing headshots: ${missing?.length || 0}`);
  if (!missing?.length) { console.log('Nothing to update'); return; }

  // Match by normalized name
  const scrapedMap = new Map(scraped.map(p => [normName(p.name), p.headshot]));
  const updates = [];
  for (const pitcher of missing) {
    const key = normName(pitcher.name);
    if (scrapedMap.has(key)) {
      updates.push({ pitcher_id: pitcher.pitcher_id, headshot: scrapedMap.get(key) });
      continue;
    }
    const parts = key.split(' ');
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstInitial = parts[0][0];
      for (const [sk, url] of scrapedMap) {
        const sp = sk.split(' ');
        if (sp[sp.length - 1] === lastName && sp[0][0] === firstInitial) {
          updates.push({ pitcher_id: pitcher.pitcher_id, headshot: url });
          break;
        }
      }
    }
  }

  console.log(`Matched: ${updates.length}`);

  let count = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('cbb_pitchers')
      .update({ headshot: u.headshot })
      .eq('pitcher_id', u.pitcher_id);
    if (!error) count++;
  }

  console.log(`\n✅ Updated ${count} Penn State headshots`);
}

main().catch(console.error);
