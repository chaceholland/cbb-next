#!/usr/bin/env node
/**
 * Fix Virginia Tech pitchers by parsing the __NUXT_DATA__ embedded in the roster page.
 * VT's Nuxt.js site server-renders all player data in a JSON payload.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const TEAM_ID = "132";
const ROSTER_URL = "https://hokiesports.com/sports/baseball/roster/";

function deref(arr, idx, visited = new Set()) {
  if (typeof idx !== "number") return idx;
  if (visited.has(idx)) return null;
  visited.add(idx);
  const val = arr[idx];
  if (Array.isArray(val))
    return val.map((v) => deref(arr, v, new Set(visited)));
  if (val && typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val))
      out[k] = deref(arr, v, new Set(visited));
    return out;
  }
  return val;
}

async function fetchAndParse() {
  console.log(`Fetching ${ROSTER_URL}...`);
  const res = await fetch(ROSTER_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const html = await res.text();
  console.log(`Got ${html.length} bytes`);

  // Extract __NUXT_DATA__ JSON array
  const nuxtMarker = '"__NUXT_DATA__">[';
  const start = html.indexOf(nuxtMarker);
  if (start < 0) throw new Error("__NUXT_DATA__ not found");

  const dataStart = start + nuxtMarker.length - 1; // include the '['
  let depth = 0,
    i = dataStart,
    end = dataStart;
  while (i < html.length) {
    if (html[i] === "[") depth++;
    else if (html[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
    i++;
  }

  const arr = JSON.parse(html.slice(dataStart, end));
  console.log(`Parsed NUXT data: ${arr.length} entries`);

  // Find players list — key "roster-1201-players-list-page-1" contains index to players array
  const stateObj = arr.find(
    (v) =>
      v &&
      typeof v === "object" &&
      v["roster-1201-players-list-page-1"] !== undefined,
  );
  if (!stateObj)
    throw new Error("Could not find players list key in NUXT data");

  const playersIdx = stateObj["roster-1201-players-list-page-1"];
  const playersContainer = arr[playersIdx]; // { players: <idx>, meta: <idx> }

  if (!playersContainer?.players)
    throw new Error("No players key in container");
  const players = deref(arr, playersContainer.players);

  if (!Array.isArray(players)) throw new Error("Players is not an array");
  console.log(`Total players: ${players.length}`);

  // Filter for pitchers
  const pitchers = players.filter(
    (p) =>
      p.player_position?.name === "Pitcher" ||
      p.player_position?.abbreviation === "P" ||
      /pitch/i.test(p.player_position?.name),
  );
  console.log(`Pitchers found: ${pitchers.length}`);

  return pitchers.map((p) => {
    const pl = p.player || {};
    const feet = p.height_feet ?? pl.height_feet;
    const inches = p.height_inches ?? pl.height_inches;
    const height = feet && inches !== undefined ? `${feet}-${inches}` : null;
    const weight =
      (p.weight ?? pl.weight) ? String(p.weight ?? pl.weight) : null;
    const name =
      pl.full_name || [pl.first_name, pl.last_name].filter(Boolean).join(" ");
    const year = p.class_level?.name || pl.class_level?.name || null;
    const hometown = pl.hometown || null;
    const number =
      p.jersey_number_label || String(p.jersey_number || "") || null;

    return {
      name,
      number,
      position: p.player_position?.name || "Pitcher",
      height,
      weight,
      year,
      hometown,
    };
  });
}

async function main() {
  console.log("⚾ FIXING VIRGINIA TECH\n");

  const pitchers = await fetchAndParse();
  console.log(`\nSample pitchers:`);
  pitchers
    .slice(0, 3)
    .forEach((p) =>
      console.log(`  ${p.number} ${p.name} - ${p.year} - ${p.hometown}`),
    );

  const records = pitchers.map((p, i) => ({
    pitcher_id: `${TEAM_ID}-P${i + 1}`,
    team_id: TEAM_ID,
    name: p.name,
    display_name: p.name,
    number: p.number || null,
    position: p.position || null,
    headshot: null,
    height: p.height || null,
    weight: p.weight || null,
    year: p.year || null,
    hometown: p.hometown || null,
    bats_throws: null,
    espn_link: null,
  }));

  const { error } = await supabase.from("cbb_pitchers").insert(records);
  if (error) {
    console.error("❌ Insert error:", error.message);
  } else {
    console.log(`\n✅ Inserted ${records.length} pitchers for Virginia Tech`);
  }
}

main().catch(console.error);
