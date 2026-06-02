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
let ros = [],
  f = 0;
for (;;) {
  const { data } = await sb
    .from("cbb_pitchers")
    .select("pitcher_id,team_id,name")
    .range(f, f + 999);
  ros.push(...data);
  if (data.length < 1000) break;
  f += 1000;
}
// garbage: leading "/09 ", "08 ", "#12 ", or any leading non-letter run before the real name
const garbageRe = /^[^A-Za-z]*[\/\\#]?\d{1,3}\s+(?=[A-Za-z])/;
const bad = ros.filter(
  (p) => garbageRe.test(p.name) || /^[\/\\#]/.test(p.name),
);
console.log("garbage-name rows:", bad.length);
const fixes = [];
for (const b of bad) {
  const cleaned = b.name
    .replace(garbageRe, "")
    .replace(/^[\/\\#\s]+/, "")
    .trim();
  if (cleaned && cleaned !== b.name)
    fixes.push({
      pitcher_id: b.pitcher_id,
      team_id: b.team_id,
      from: b.name,
      to: cleaned,
    });
}
for (const x of fixes)
  console.log(`  ${x.pitcher_id} "${x.from}" -> "${x.to}"`);
if (process.argv.includes("--apply")) {
  for (const x of fixes)
    await sb
      .from("cbb_pitchers")
      .update({ name: x.to, display_name: x.to })
      .eq("pitcher_id", x.pitcher_id);
  console.log("APPLIED", fixes.length, "fixes");
}
