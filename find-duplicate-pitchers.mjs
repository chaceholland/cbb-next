#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function findDuplicates() {
  console.log('🔍 Finding duplicate pitchers across teams...\n');

  // Get all pitchers with their team info
  const { data: pitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('pitcher_id, name, team_id, position')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching pitchers:', error);
    return;
  }

  // Get team names
  const { data: teams } = await supabase
    .from('cbb_teams')
    .select('team_id, display_name');

  const teamMap = {};
  teams.forEach(t => { teamMap[t.team_id] = t.display_name; });

  // Group by pitcher name to find duplicates
  const nameGroups = {};
  pitchers.forEach(p => {
    const nameLower = p.name.toLowerCase().trim();
    if (!nameGroups[nameLower]) {
      nameGroups[nameLower] = [];
    }
    nameGroups[nameLower].push(p);
  });

  // Find pitcher names that appear on multiple teams
  const duplicates = Object.entries(nameGroups)
    .filter(([name, group]) => {
      // Only count as duplicate if same name appears on different teams
      const uniqueTeams = new Set(group.map(p => p.team_id));
      return uniqueTeams.size > 1;
    })
    .map(([name, group]) => ({
      name: group[0].name,
      count: group.length,
      teams: group.map(p => ({
        pitcher_id: p.pitcher_id,
        team_id: p.team_id,
        team_name: teamMap[p.team_id] || 'Unknown',
        position: p.position
      }))
    }));

  if (duplicates.length === 0) {
    console.log('✅ No duplicate pitchers found!');
    return;
  }

  console.log(`Found ${duplicates.length} pitchers appearing on multiple teams:\n`);

  duplicates.forEach(dup => {
    console.log(`${dup.name} (ID: ${dup.pitcher_id})`);
    dup.teams.forEach(t => {
      console.log(`  - ${t.team_name} (${t.position || 'N/A'})`);
    });
    console.log('');
  });

  console.log(`\nTotal duplicate entries: ${duplicates.reduce((sum, d) => sum + d.teams.length, 0)}`);
  console.log(`Unique pitchers with duplicates: ${duplicates.length}`);
}

findDuplicates().catch(console.error);
