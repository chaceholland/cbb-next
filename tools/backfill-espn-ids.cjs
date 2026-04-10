#!/usr/bin/env node
/**
 * Backfill cbb_pitchers.espn_id by name-matching against
 * cbb_pitcher_participation, which already uses ESPN numeric IDs.
 *
 * Prereqs:
 *   1. Run the migration in tools/migrations/2026_04_09_add_espn_id.sql
 *      (Supabase dashboard → SQL editor, or any psql client with service
 *      role credentials).
 *   2. Export SUPABASE_SERVICE_ROLE_KEY in the environment, or place it
 *      in .env.local as SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Usage:
 *   node tools/backfill-espn-ids.cjs --dry       # report only, no writes
 *   node tools/backfill-espn-ids.cjs             # write espn_id updates
 *
 * Output:
 *   espn-id-backfill-unmatched.json — participation rows with no
 *   single-name match in cbb_pitchers. Review by hand.
 */
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const DRY = process.argv.includes("--dry");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

// Clean ESPN participation names before normalizing:
// 1. Strip " - P " marker (e.g. "AJ - P Ciscar" → "AJ Ciscar")
// 2. Flip "Last, First" → "First Last"
function cleanName(raw) {
  let s = (raw || "").replace(/\s*-\s*P\s+/g, "");
  if (s.includes(",")) {
    const parts = s.split(",").map((p) => p.trim());
    if (parts.length === 2 && parts[1].length > 1 && !parts[1].endsWith(".")) {
      s = `${parts[1]} ${parts[0]}`;
    }
  }
  return s;
}

// Generate multiple normalized lookup keys for a name
function normKeys(raw) {
  const cleaned = cleanName(raw);
  const keys = new Set([norm(cleaned)]);
  // Also try the raw without cleaning (covers names that have commas in them)
  keys.add(norm(raw));
  // Try reversed word order of cleaned name
  const words = cleaned.trim().split(/\s+/);
  if (words.length >= 2) {
    keys.add(norm([...words.slice(1), words[0]].join(" ")));
  }
  keys.delete("");
  return [...keys];
}

async function fetchAll(table, select) {
  const rows = [];
  const page = 1000;
  let from = 0;
  while (true) {
    const res = await fetch(`${URL}/rest/v1/${table}?select=${select}`, {
      headers: {
        ...headers,
        Range: `${from}-${from + page - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const chunk = await res.json();
    rows.push(...chunk);
    if (chunk.length < page) break;
    from += page;
  }
  return rows;
}

async function main() {
  console.log("Loading cbb_pitchers…");
  const pitchers = await fetchAll(
    "cbb_pitchers",
    "pitcher_id,team_id,name,espn_id",
  );
  console.log(`  ${pitchers.length} roster rows`);

  console.log("Loading cbb_pitcher_participation (distinct pitcher_id)…");
  const parts = await fetchAll(
    "cbb_pitcher_participation",
    "pitcher_id,team_id,pitcher_name",
  );
  console.log(`  ${parts.length} participation rows`);

  // Distinct (team_id, espn_id, name) tuples
  const seen = new Set();
  const distinct = [];
  for (const p of parts) {
    const key = `${p.team_id}|${p.pitcher_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(p);
  }
  console.log(`  ${distinct.length} distinct participation pitchers`);

  // Build (team_id, normName) → [roster row] index.
  // Index roster by BOTH raw name and reversed word order so lookups
  // find matches regardless of First-Last vs Last-First ordering.
  const rosterByKey = new Map();
  for (const r of pitchers) {
    for (const nk of normKeys(r.name)) {
      const k = `${r.team_id}|${nk}`;
      if (!rosterByKey.has(k)) rosterByKey.set(k, []);
      const arr = rosterByKey.get(k);
      if (!arr.some((x) => x.pitcher_id === r.pitcher_id)) arr.push(r);
    }
  }

  const updates = [];
  const unmatched = [];
  const ambiguous = [];
  const already = [];

  for (const p of distinct) {
    // Try all normalized keys for the participation name
    let matches = [];
    for (const nk of normKeys(p.pitcher_name)) {
      matches = rosterByKey.get(`${p.team_id}|${nk}`) || [];
      if (matches.length > 0) break;
    }
    if (matches.length === 0) {
      unmatched.push(p);
    } else if (matches.length > 1) {
      ambiguous.push({ participation: p, candidates: matches });
    } else {
      const m = matches[0];
      if (m.espn_id === p.pitcher_id) {
        already.push(m.pitcher_id);
      } else {
        updates.push({
          pitcher_id: m.pitcher_id,
          espn_id: p.pitcher_id,
          name: m.name,
          team_id: m.team_id,
        });
      }
    }
  }

  console.log("");
  console.log("=== Results ===");
  console.log(`  matched & already correct: ${already.length}`);
  console.log(`  to update:                 ${updates.length}`);
  console.log(`  ambiguous (multi-match):   ${ambiguous.length}`);
  console.log(`  unmatched:                 ${unmatched.length}`);
  console.log("");

  fs.writeFileSync(
    path.join(__dirname, "..", "espn-id-backfill-unmatched.json"),
    JSON.stringify({ unmatched, ambiguous }, null, 2),
  );
  console.log("Wrote espn-id-backfill-unmatched.json");

  if (DRY) {
    console.log("\n--dry set, no writes performed");
    return;
  }

  console.log(`\nApplying ${updates.length} updates…`);
  let done = 0;
  for (const u of updates) {
    const res = await fetch(
      `${URL}/rest/v1/cbb_pitchers?pitcher_id=eq.${encodeURIComponent(u.pitcher_id)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ espn_id: u.espn_id }),
      },
    );
    if (!res.ok) {
      console.error(
        `  FAIL ${u.pitcher_id} (${u.name}): ${res.status} ${await res.text()}`,
      );
      continue;
    }
    done++;
    if (done % 100 === 0) console.log(`  ${done}/${updates.length}`);
  }
  console.log(`Done. ${done}/${updates.length} updated.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
