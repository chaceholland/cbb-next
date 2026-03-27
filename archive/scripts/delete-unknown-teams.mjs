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

// Load the 64 tracked teams from pitchers.json
const pitchersData = JSON.parse(fs.readFileSync('../CBB/data/pitchers.json', 'utf8'));
const trackedTeamIds = new Set(pitchersData.teams.map(t => String(t.teamId || t.team_id)));

async function main() {
  console.log(`Loaded ${trackedTeamIds.size} tracked teams from pitchers.json\n`);

  // Get all teams from the database
  const { data: allTeams, error: fetchError } = await supabase
    .from('cbb_teams')
    .select('team_id, display_name');

  if (fetchError) {
    console.error('Error fetching teams:', fetchError);
    return;
  }

  console.log(`Found ${allTeams.length} teams in database\n`);

  // Find teams to delete (not in tracked list)
  const teamsToDelete = allTeams.filter(team => !trackedTeamIds.has(team.team_id));

  if (teamsToDelete.length === 0) {
    console.log('✅ No unknown teams to delete. Database is clean!');
    return;
  }

  console.log(`Found ${teamsToDelete.length} unknown teams to delete:\n`);
  teamsToDelete.forEach(team => {
    console.log(`  - ${team.display_name} (ID: ${team.team_id})`);
  });

  console.log('\n⚠️  Deleting related data...\n');

  const teamIdsToDelete = teamsToDelete.map(t => t.team_id);

  // Step 1: Delete pitcher participation records for these teams
  const { error: deleteParticipationError, count: participationCount } = await supabase
    .from('cbb_pitcher_participation')
    .delete()
    .in('team_id', teamIdsToDelete);

  if (deleteParticipationError) {
    console.error('Error deleting participation records:', deleteParticipationError);
    return;
  }

  console.log(`✅ Deleted participation records`);

  // Step 2: Delete pitchers that belong to these teams
  const { error: deletePitchersError, count: pitchersCount } = await supabase
    .from('cbb_pitchers')
    .delete()
    .in('team_id', teamIdsToDelete);

  if (deletePitchersError) {
    console.error('Error deleting pitchers:', deletePitchersError);
    return;
  }

  console.log(`✅ Deleted pitchers`);

  // Step 3: Delete the unknown teams
  const { error: deleteTeamsError, count: teamsCount } = await supabase
    .from('cbb_teams')
    .delete()
    .in('team_id', teamIdsToDelete);

  if (deleteTeamsError) {
    console.error('Error deleting teams:', deleteTeamsError);
    return;
  }

  console.log(`✅ Successfully deleted ${teamsToDelete.length} unknown teams\n`);

  // Verify final count
  const { count: finalCount } = await supabase
    .from('cbb_teams')
    .select('*', { count: 'exact', head: true });

  console.log(`Final team count: ${finalCount} (should be ${trackedTeamIds.size})`);
}

main().catch(console.error);
