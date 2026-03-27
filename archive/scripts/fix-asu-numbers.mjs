#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dtnozcqkuzhjmjvsfjqk.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NUMBERS = {
  "Jaden Alba": "12",
  "Cole Carlon": "14",
  "Wyatt Halvorson": "16",
  "Derek Schaefer": "20",
  "Easton Barrett": "28",
  "Josh Butler": "32",
  "Sean Fitzpatrick": "38",
  "Colin Linder": "45",
  "Eli Buxton": "50",
  "Nick Anello": "26",
  "Colby Guy": "37",
  "Kole Klecker": "27",
  "Brady Louck": "35",
  "Brandon Olivera": "46",
  "Alex Overbay": "15",
  "Taylor Penn": "41",
  "Finn Edwards": "19",
  "Ashton Higgins": "54",
  "Austin Musso": "21",
  "Marcelo Rodriguez": "40",
};

async function main() {
  console.log("\nUpdating Arizona State jersey numbers...\n");
  const { data, error } = await supabase
    .from("cbb_pitchers")
    .select("pitcher_id,name,number")
    .eq("team_id", "59");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let updated = 0;
  for (const p of data) {
    const num = NUMBERS[p.name];
    if (!num) {
      console.log(`  ? ${p.name}: no number found`);
      continue;
    }
    if (p.number === num) {
      console.log(`  = ${p.name}: already #${num}`);
      continue;
    }
    const { error: err } = await supabase
      .from("cbb_pitchers")
      .update({ number: num })
      .eq("pitcher_id", p.pitcher_id);
    if (err) {
      console.log(`  ✗ ${p.name}: ${err.message}`);
    } else {
      console.log(`  ✓ ${p.name} → #${num}`);
      updated++;
    }
  }
  console.log(`\nUpdated ${updated} pitchers`);
}

main().catch(console.error);
