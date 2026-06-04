// Backfill cbb_pitchers.number (jersey #) for teams whose pitcher rows are
// missing it. Scrapes each team's OFFICIAL athletics roster via
// extract_jerseys.py (SIDEARM Nuxt __NUXT_DATA__, legacy SIDEARM HTML, or a
// Playwright-rendered WMT fallback), matches scraped players to existing
// pitcher rows by normalized name, and UPDATEs the empty `number` fields only.
// Never creates rows, never overwrites an existing number.
//
//   node scripts/backfill-jersey-numbers.mjs --dry      # preview, no writes
//   node scripts/backfill-jersey-numbers.mjs            # apply
//   node scripts/backfill-jersey-numbers.mjs --team 131 # single team
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

// Same normalizer as roster-import.mjs: strips the " - P " box-score position
// infix, lowercases, drops punctuation, sorts tokens (handles "Last, First").
const norm = (s) =>
  String(s)
    .replace(/\s+-\s+[A-Za-z0-9]{1,3}\s+/g, " ")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

const EXTRACTOR = new URL("./extract_jerseys.py", import.meta.url).pathname;
const DRY = process.argv.includes("--dry");

// Run extract_jerseys.py for a URL; static first, then a rendered retry if no
// jerseys came back. Returns { method, players:[{name,jersey}] } or null.
function scrapeJerseys(url) {
  const run = (render) => {
    const out = execSync(
      `python3 "${EXTRACTOR}" --url "${url}"${render ? " --render" : ""}`,
      {
        encoding: "utf8",
        timeout: 180000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return JSON.parse(out);
  };
  const nJersey = (x) => (x.players || []).filter((p) => p.jersey).length;
  let d;
  try {
    d = run(false);
  } catch {
    d = { players: [] };
  }
  // Some SIDEARM sites ship null jerseys in the static payload and only fill
  // them after hydration — retry rendered when static coverage looks low, and
  // keep whichever pass found more jerseys.
  const nPlayers = (d.players || []).length;
  if (nJersey(d) < Math.max(3, nPlayers * 0.5)) {
    try {
      const r = run(true);
      if (nJersey(r) > nJersey(d)) d = r;
    } catch {
      /* keep static result */
    }
  }
  return d;
}
const onlyTeam = (() => {
  const i = process.argv.indexOf("--team");
  return i >= 0 ? process.argv[i + 1] : null;
})();

// Roster URLs for the named tracked teams that aren't in roster-urls.json.
const NAMED_URLS = {
  131: {
    name: "Virginia",
    url: "https://virginiasports.com/sports/baseball/roster",
  },
  55: {
    name: "Auburn",
    url: "https://auburntigers.com/sports/baseball/roster",
  },
  176: {
    name: "Miami (FL)",
    url: "https://miamihurricanes.com/sports/baseball/roster",
  },
  64: {
    name: "Stanford",
    url: "https://gostanford.com/sports/baseball/roster",
  },
  161: {
    name: "Cincinnati",
    url: "https://gobearcats.com/sports/baseball/roster",
  },
  127: { name: "BYU", url: "https://byucougars.com/sports/baseball/roster" },
  91: { name: "Missouri", url: "https://mutigers.com/sports/baseball/roster" },
  59: {
    name: "Arizona State",
    url: "https://thesundevils.com/sports/baseball/roster",
  },
  132: {
    name: "Virginia Tech",
    url: "https://hokiesports.com/sports/baseball/roster",
  },
};

const rosterUrls = JSON.parse(
  fs.readFileSync(new URL("./roster-urls.json", import.meta.url), "utf8"),
);
const urlByTeam = new Map(rosterUrls.map((t) => [String(t.team_id), t]));

async function teamsMissingNumbers() {
  // Pull all pitcher rows, group client-side to find teams with empty numbers.
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("cbb_pitchers")
      .select("pitcher_id, team_id, name, number")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const byTeam = new Map();
  for (const r of rows) {
    if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, []);
    byTeam.get(r.team_id).push(r);
  }
  const teams = [];
  for (const [team_id, prows] of byTeam) {
    const missing = prows.filter((r) => !r.number || !String(r.number).trim());
    if (missing.length === 0) continue;
    const meta =
      urlByTeam.get(team_id) || NAMED_URLS[team_id]
        ? urlByTeam.get(team_id) || { team_id, ...NAMED_URLS[team_id] }
        : { team_id, name: `(team ${team_id})`, url: null };
    teams.push({ team_id, ...meta, rows: prows, missing });
  }
  return teams;
}

const summary = [];
let teams = await teamsMissingNumbers();
if (onlyTeam) teams = teams.filter((t) => t.team_id === onlyTeam);
// Process teams with a URL first; report URL-less ones.
teams.sort((a, b) => (b.url ? 1 : 0) - (a.url ? 1 : 0));

for (const team of teams) {
  if (!team.url) {
    summary.push({
      team_id: team.team_id,
      name: team.name,
      missing: team.missing.length,
      note: "NO ROSTER URL — skipped",
    });
    continue;
  }

  // Scrape with retries. Athletics-site Cloudflare blocks are intermittent and
  // a blocked response parses into junk names (0 matches), so retry both the
  // empty-players and low-match cases with backoff. A genuine no-numbers site
  // (e.g. GCU) returns players-but-no-jerseys and is NOT retried.
  let jerseyByName = null;
  let athletes = [];
  let lastNote = "scrape returned no players";
  for (let attempt = 1; attempt <= 4; attempt++) {
    const scraped = scrapeJerseys(team.url);
    athletes = scraped.players || [];
    const jbn = new Map();
    for (const a of athletes) {
      const j = (a.jersey ?? "").toString().trim();
      if (j) jbn.set(norm(a.name), j);
    }
    const matched = team.rows.filter((r) => jbn.has(norm(r.name)));
    const matchRate = matched.length / Math.max(1, team.rows.length);
    if (athletes.length > 0 && jbn.size === 0) {
      jerseyByName = jbn; // site truly publishes no numbers — don't retry
      lastNote = "site publishes no jersey numbers";
      break;
    }
    if (jbn.size > 0 && matched.length >= 3 && matchRate >= 0.15) {
      jerseyByName = jbn; // success
      break;
    }
    lastNote =
      athletes.length === 0
        ? "scrape returned no players (blocked?)"
        : `LOW MATCH scraped=${athletes.length} matched=${matched.length} (blocked?)`;
    await new Promise((r) => setTimeout(r, 2500 * attempt));
  }
  if (!jerseyByName || jerseyByName.size === 0) {
    summary.push({
      team_id: team.team_id,
      name: team.name,
      scraped: athletes.length,
      note: jerseyByName ? "site publishes no jersey numbers" : lastNote,
    });
    continue;
  }

  // update empty-number rows that we can match
  let updated = 0;
  const unmatched = [];
  for (const r of team.missing) {
    const j = jerseyByName.get(norm(r.name));
    if (!j) {
      unmatched.push(r.name);
      continue;
    }
    if (DRY) {
      updated++;
      continue;
    }
    const { error } = await sb
      .from("cbb_pitchers")
      .update({ number: j, updated_at: new Date().toISOString() })
      .eq("pitcher_id", r.pitcher_id);
    if (!error) updated++;
  }

  summary.push({
    team_id: team.team_id,
    name: team.name,
    scraped: athletes.length,
    withJersey: jerseyByName.size,
    missingBefore: team.missing.length,
    updated,
    stillUnmatched: unmatched.length,
    unmatchedNames: unmatched.slice(0, 8),
  });

  // Be polite between athletics sites — hammering 25 SIDEARM/Cloudflare hosts
  // back-to-back triggers rate-limiting / interstitials.
  await new Promise((r) => setTimeout(r, 1500));
}

console.log(JSON.stringify(summary, null, 2));
console.log(
  `\n${DRY ? "[DRY] " : ""}Teams processed: ${summary.length}, total updated: ${summary.reduce((n, s) => n + (s.updated || 0), 0)}`,
);
