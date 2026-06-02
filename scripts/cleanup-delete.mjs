// Snapshot + delete polluted synthetic rows in affected games, reset status.
// Reversible: full snapshot written before any delete. Uses service-role client
// (same path the cron writes through).
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const affected = JSON.parse(
  fs.readFileSync(
    new URL("./pollution-affected-games.json", import.meta.url),
    "utf8",
  ),
);
console.log("affected games:", affected.length);

// 1. Snapshot ALL participation rows for affected games (every source) for rollback
const snap = [];
for (let i = 0; i < affected.length; i += 200) {
  const { data, error } = await sb
    .from("cbb_pitcher_participation")
    .select("*")
    .in("game_id", affected.slice(i, i + 200));
  if (error) throw error;
  snap.push(...data);
}
const stamp = "20260601-asu-pollution"; // static label (no Date.now in this run)
const snapFile = new URL(`./snapshot-${stamp}.json`, import.meta.url);
fs.writeFileSync(snapFile, JSON.stringify(snap, null, 2));
console.log("snapshot rows:", snap.length, "->", snapFile.pathname);

// 2. Delete synthetic (NCAA-/D1-) rows in affected games
const synthIds = snap.filter((r) => /^(NCAA|D1)-/.test(String(r.pitcher_id)));
console.log("synthetic rows to delete:", synthIds.length);
let deleted = 0;
for (let i = 0; i < affected.length; i += 100) {
  const chunk = affected.slice(i, i + 100);
  // delete NCAA- and D1- prefixed rows for these games
  for (const pref of ["NCAA-%", "D1-%"]) {
    const { error, count } = await sb
      .from("cbb_pitcher_participation")
      .delete({ count: "exact" })
      .in("game_id", chunk)
      .like("pitcher_id", pref);
    if (error) throw error;
    deleted += count || 0;
  }
}
console.log("deleted synthetic rows:", deleted);

// 3. Reset scrape_status so the fixed scraper re-populates these games
let reset = 0;
for (let i = 0; i < affected.length; i += 100) {
  const { error, count } = await sb
    .from("cbb_games")
    .update({ scrape_status: null, scrape_attempts: 0 }, { count: "exact" })
    .in("game_id", affected.slice(i, i + 100));
  if (error) throw error;
  reset += count || 0;
}
console.log("games reset for re-scrape:", reset);
console.log("\nDONE. Snapshot at", snapFile.pathname);
