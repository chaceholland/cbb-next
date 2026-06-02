// FULL snapshot of cbb_pitcher_participation, then delete ALL synthetic
// (NCAA-/D1-) rows and reset scrape_status on their games so the fixed
// auto-scrape repopulates correctly. Paginated correctly this time.
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

// 1. FULL snapshot (paginated)
const all = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from("cbb_pitcher_participation")
    .select("*")
    .range(from, from + 999);
  if (error) throw error;
  all.push(...data);
  if (data.length < 1000) break;
}
const snapFile = new URL("./snapshot-FULL-participation.json", import.meta.url);
fs.writeFileSync(snapFile, JSON.stringify(all, null, 2));
console.log("FULL snapshot rows:", all.length, "->", snapFile.pathname);

const synth = all.filter((r) => /^(NCAA|D1)-/.test(String(r.pitcher_id)));
const synthGames = [...new Set(synth.map((r) => r.game_id))];
console.log(
  "synthetic rows:",
  synth.length,
  "across games:",
  synthGames.length,
);

if (process.argv.includes("--dry")) {
  console.log("DRY RUN — no deletes");
  process.exit(0);
}

// 2. Delete all synthetic rows by id (chunked)
let deleted = 0;
const ids = synth.map((r) => r.pitcher_id).filter(Boolean);
// delete by (game_id,pitcher_id) is safest, but pitcher_id is unique within game; delete by prefix per game
for (let i = 0; i < synthGames.length; i += 100) {
  const chunk = synthGames.slice(i, i + 100);
  for (const pref of ["NCAA-%", "D1-%"]) {
    const { error, count } = await sb
      .from("cbb_pitcher_participation")
      .delete({ count: "exact" })
      .in("game_id", chunk)
      .like("pitcher_id", pref);
    if (error) throw error;
    deleted += count || 0;
  }
  process.stdout.write(`\r  deleted ${deleted}...`);
}
console.log(`\ndeleted synthetic rows: ${deleted}`);

// 3. Reset scrape_status + attempts so auto-scrape re-tries these games
let reset = 0;
for (let i = 0; i < synthGames.length; i += 100) {
  const { error, count } = await sb
    .from("cbb_games")
    .update({ scrape_status: null, scrape_attempts: 0 }, { count: "exact" })
    .in("game_id", synthGames.slice(i, i + 100));
  if (error) throw error;
  reset += count || 0;
}
console.log("games reset:", reset);
console.log("DONE.");
