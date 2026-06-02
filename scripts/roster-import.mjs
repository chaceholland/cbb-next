// Scrape team rosters from their OFFICIAL athletics sites and import headshots
// for pitchers who actually appear in participation. Matching scraped roster to
// participation pitcher names (a) filters to real pitchers without needing the
// site's position field, and (b) validates the site is the right team (if names
// don't match participation, we skip — wrong-site guard).
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
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
const TEMPLATE = "/Users/chace/athlete-scraper/references/scrape_template.py";
const DRY = process.argv.includes("--dry");
const urls = JSON.parse(
  fs.readFileSync(new URL("./roster-urls.json", import.meta.url), "utf8"),
);

async function headOk(url) {
  if (!url || !/^https?:\/\//i.test(url)) return false; // reject data:/blob:/relative placeholders
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });
    return r.status === 200;
  } catch {
    return false;
  }
}

const summary = [];
for (const team of urls) {
  // Skip teams already rostered (idempotent re-runs / resume)
  const { count: existing } = await sb
    .from("cbb_pitchers")
    .select("pitcher_id", { count: "exact", head: true })
    .eq("team_id", team.team_id);
  if (existing > 0 && !process.argv.includes("--force")) {
    summary.push({ ...team, note: `already rostered (${existing})` });
    continue;
  }

  // participation pitcher names for this team
  let rows = [],
    pf = 0;
  for (;;) {
    const { data } = await sb
      .from("cbb_pitcher_participation")
      .select("pitcher_name")
      .eq("team_id", team.team_id)
      .range(pf, pf + 999);
    rows.push(...data);
    if (data.length < 1000) break;
    pf += 1000;
  }
  const partNames = new Map(); // norm -> raw (one representative)
  for (const r of rows) partNames.set(norm(r.pitcher_name), r.pitcher_name);
  if (partNames.size === 0) {
    summary.push({ ...team, note: "no participation names" });
    continue;
  }

  // scrape
  const out = `/tmp/roster_${team.team_id}.json`;
  try {
    execSync(`python3 ${TEMPLATE} --url "${team.url}" --output ${out}`, {
      stdio: "pipe",
      timeout: 120000,
    });
  } catch (e) {
    summary.push({
      ...team,
      note: "scrape failed: " + String(e.message).slice(0, 60),
    });
    continue;
  }
  let athletes = [];
  try {
    athletes = JSON.parse(fs.readFileSync(out, "utf8")).athletes || [];
  } catch {
    summary.push({ ...team, note: "parse failed" });
    continue;
  }

  // match scraped -> participation
  const matched = [];
  for (const a of athletes) {
    const n = norm(a.name);
    if (partNames.has(n)) matched.push(a);
  }
  // wrong-site guard: require a reasonable match rate
  const matchRate = matched.length / Math.max(1, partNames.size);
  if (matched.length < 3 || matchRate < 0.15) {
    summary.push({
      ...team,
      scraped: athletes.length,
      partNames: partNames.size,
      matched: matched.length,
      note: "LOW MATCH — likely wrong site, skipping",
    });
    continue;
  }

  // validate headshots resolve, build rows
  let imported = 0,
    badHs = 0,
    n = 1;
  for (const a of matched) {
    const ok = await headOk(a.headshot_url);
    if (!ok) {
      badHs++;
      continue;
    }
    if (DRY) {
      imported++;
      continue;
    }
    const pid = `${team.team_id}-P${n++}`;
    const { error } = await sb.from("cbb_pitchers").upsert(
      {
        pitcher_id: pid,
        team_id: team.team_id,
        name: a.name,
        display_name: a.name,
        headshot: a.headshot_url,
        year: a.year_class || null,
        hometown: (a.hometown || "").slice(0, 120),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pitcher_id" },
    );
    if (!error) imported++;
  }
  summary.push({
    ...team,
    scraped: athletes.length,
    partNames: partNames.size,
    matched: matched.length,
    imported,
    badHeadshots: badHs,
  });
}
console.log(JSON.stringify(summary, null, 2));
