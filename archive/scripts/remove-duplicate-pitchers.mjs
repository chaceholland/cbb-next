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

async function removeDuplicates() {
  console.log('🔍 Finding and removing duplicate pitchers...\n');

  // Get all pitchers
  const { data: pitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching pitchers:', error);
    return;
  }

  // Get team names for display
  const { data: teams } = await supabase
    .from('cbb_teams')
    .select('team_id, display_name');

  const teamMap = {};
  teams.forEach(t => { teamMap[t.team_id] = t.display_name; });

  // Group by normalized name
  const nameGroups = {};
  pitchers.forEach(p => {
    const nameLower = p.name.toLowerCase().trim();
    if (!nameGroups[nameLower]) {
      nameGroups[nameLower] = [];
    }
    nameGroups[nameLower].push(p);
  });

  // Find duplicates across different teams
  const duplicateGroups = Object.entries(nameGroups)
    .filter(([name, group]) => {
      const uniqueTeams = new Set(group.map(p => p.team_id));
      return uniqueTeams.size > 1;
    });

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate pitchers found across teams!');
    return;
  }

  console.log(`Found ${duplicateGroups.length} pitchers with duplicates across teams\n`);

  const pitchersToDelete = [];

  // For each duplicate group, keep the best entry
  for (const [name, group] of duplicateGroups) {
    console.log(`\n${group[0].name}:`);

    // Score each entry based on data completeness
    const scored = group.map(p => {
      let score = 0;
      if (p.position && p.position !== 'N/A') score += 10;
      if (p.headshot_url) score += 5;
      if (p.year) score += 3;
      if (p.height) score += 2;
      if (p.weight) score += 2;
      if (p.hometown) score += 2;
      if (p.high_school) score += 2;

      return { pitcher: p, score };
    });

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Keep the best one, mark others for deletion
    const keepPitcher = scored[0].pitcher;
    console.log(`  ✅ KEEP: ${teamMap[keepPitcher.team_id]} (${keepPitcher.position || 'N/A'}) - Score: ${scored[0].score}`);

    for (let i = 1; i < scored.length; i++) {
      const deletePitcher = scored[i].pitcher;
      console.log(`  ❌ DELETE: ${teamMap[deletePitcher.team_id]} (${deletePitcher.position || 'N/A'}) - Score: ${scored[i].score}`);
      pitchersToDelete.push(deletePitcher.pitcher_id);
    }
  }

  if (pitchersToDelete.length === 0) {
    console.log('\n✅ No pitchers to delete');
    return;
  }

  console.log(`\n\n⚠️  Preparing to delete ${pitchersToDelete.length} duplicate pitcher entries...\n`);

  // Delete participation records first
  const { error: deleteParticipationError } = await supabase
    .from('cbb_pitcher_participation')
    .delete()
    .in('pitcher_id', pitchersToDelete);

  if (deleteParticipationError) {
    console.error('Error deleting participation records:', deleteParticipationError);
    return;
  }

  console.log(`✅ Deleted participation records`);

  // Delete the duplicate pitchers
  const { error: deletePitchersError } = await supabase
    .from('cbb_pitchers')
    .delete()
    .in('pitcher_id', pitchersToDelete);

  if (deletePitchersError) {
    console.error('Error deleting pitchers:', deletePitchersError);
    return;
  }

  console.log(`✅ Successfully deleted ${pitchersToDelete.length} duplicate pitchers\n`);

  // Verify final count
  const { count: finalCount } = await supabase
    .from('cbb_pitchers')
    .select('*', { count: 'exact', head: true });

  console.log(`Final pitcher count: ${finalCount}`);
}

removeDuplicates().catch(console.error);
