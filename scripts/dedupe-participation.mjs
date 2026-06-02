// Collapse duplicate participation rows for the same pitcher in the same game.
// Key = game_id + team_id + normalized-name. Keep one row, preferring richer
// source: espn > d1baseball > ncaa > sidearm > other. Deletes the rest.
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
const norm = (s) =>
  String(s)
    .replace(/\s+-\s+[A-Za-z0-9]{1,3}\s+/g, " ")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
const RANK = { espn: 5, d1baseball: 4, ncaa: 3, sidearm: 2 };
const rank = (r) => RANK[(r.stats && r.stats.source) || ""] || 1;

let all = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from("cbb_pitcher_participation")
    .select("game_id,team_id,pitcher_id,pitcher_name,stats")
    .range(from, from + 999);
  if (error) throw error;
  all.push(...data);
  if (data.length < 1000) break;
}
console.log("total rows:", all.length);

const groups = {};
for (const r of all) {
  const k = r.game_id + "|" + r.team_id + "|" + norm(r.pitcher_name);
  (groups[k] = groups[k] || []).push(r);
}
const toDelete = [];
let dupGroups = 0;
for (const k in groups) {
  const g = groups[k];
  if (g.length < 2) continue;
  dupGroups++;
  g.sort((a, b) => rank(b) - rank(a)); // best first
  for (const r of g.slice(1)) toDelete.push(r);
}
console.log(
  "duplicate groups:",
  dupGroups,
  "| rows to delete:",
  toDelete.length,
);

if (process.argv.includes("--dry")) {
  console.log("DRY RUN");
  process.exit(0);
}

let deleted = 0;
for (let i = 0; i < toDelete.length; i += 100) {
  const chunk = toDelete.slice(i, i + 100);
  // delete each by (game_id,pitcher_id) — unique
  for (const r of chunk) {
    const { error } = await sb
      .from("cbb_pitcher_participation")
      .delete()
      .eq("game_id", r.game_id)
      .eq("pitcher_id", r.pitcher_id);
    if (error) throw error;
    deleted++;
  }
  process.stdout.write(`\r  deleted ${deleted}/${toDelete.length}`);
}
console.log(`\ndeleted ${deleted} duplicate rows`);
