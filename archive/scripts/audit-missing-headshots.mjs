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

const { data: teams } = await supabase.from('cbb_teams').select('team_id, name').order('name');
const { data: pitchers } = await supabase.from('cbb_pitchers').select('pitcher_id, team_id, name, headshot');

const teamStats = teams.map(team => {
  const teamPitchers = pitchers.filter(p => p.team_id === team.team_id);
  const missing = teamPitchers.filter(p => !p.headshot).length;
  return { name: team.name, team_id: team.team_id, total: teamPitchers.length, missing };
}).filter(t => t.missing > 0).sort((a, b) => b.missing - a.missing);

console.log('\n🚨 TOP 20 TEAMS WITH MOST MISSING HEADSHOTS\n');
console.log('Rank | Team                          | Total | Missing');
console.log('-'.repeat(70));

teamStats.slice(0, 20).forEach((stat, idx) => {
  const rank = (idx + 1).toString().padStart(2, ' ');
  const team = stat.name.padEnd(29, ' ');
  const total = stat.total.toString().padStart(5, ' ');
  const missing = stat.missing.toString().padStart(7, ' ');
  console.log(`${rank}   | ${team} | ${total} | ${missing}`);
});

const totalMissing = teamStats.reduce((sum, t) => sum + t.missing, 0);
const totalPitchers = pitchers.length;

console.log('\n' + '='.repeat(70));
console.log(`\nTotal missing headshots: ${totalMissing} / ${totalPitchers} (${((totalMissing/totalPitchers)*100).toFixed(1)}%)\n`);
