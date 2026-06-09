// One-off repair: 22 teams had their cbb_pitchers.name written as the SIDEARM
// jersey stamp ("Jersey Number16") instead of the player's name — a stale writer
// mapped the scraper's `position` field (which on this layout carries the jersey
// stamp text) into `name`. The `number` column is correct, so we re-scrape each
// roster, read the real name, and UPDATE name/display_name only, matched by
// jersey number. Nothing else is touched (headshots, numbers, ids all preserved).
//
//   node scripts/fix-roster-names.mjs --dry      # report, no writes
//   node scripts/fix-roster-names.mjs            # apply
//   node scripts/fix-roster-names.mjs --only=168 # single team
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
const TEMPLATE = "/Users/chace/athlete-scraper/references/scrape_template.py";
const DRY = process.argv.includes("--dry");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "")
  .replace("--only=", "")
  .split(",")
  .filter(Boolean);

// Order-insensitive identity key (mirrors lib/pitcher-name.ts matchKey): strips
// the " - P " position infix, drops punctuation, sorts tokens. Lets "Daniel Lopez",
// "Lopez, Daniel" and "Daniel - P Lopez" collapse to one value for the wrong-site gate.
const matchKey = (s) =>
  String(s || "")
    .replace(/\s+-\s+[A-Za-z0-9]{1,3}\s+/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join("");

// Scraper names already carry correct casing ("Blake O'Brien", "Emerson McKnight"),
// so collapse whitespace only — do NOT re-case (that breaks O'B/McK).
const cleanName = (s) => String(s).replace(/\s+/g, " ").trim();

// Official baseball roster pages (SIDEARM). team_id matches the cbb_* id space.
const TEAMS = [
  {
    id: "168",
    name: "Kansas",
    url: "https://kuathletics.com/sports/baseball/roster",
  },
  {
    id: "78",
    name: "Georgia",
    url: "https://georgiadogs.com/sports/baseball/roster",
  },
  {
    id: "136",
    name: "West Virginia",
    url: "https://wvusports.com/sports/baseball/roster",
  },
  {
    id: "86",
    name: "Boston College",
    url: "https://bceagles.com/sports/baseball/roster",
  },
  {
    id: "150",
    name: "Mississippi State",
    url: "https://hailstate.com/sports/baseball/roster",
  },
  {
    id: "92",
    name: "Ole Miss",
    url: "https://olemisssports.com/sports/baseball/roster",
  },
  {
    id: "66",
    name: "UCLA",
    url: "https://uclabruins.com/sports/baseball/roster",
  },
  {
    id: "170",
    name: "Lamar",
    url: "https://lamarcardinals.com/sports/baseball/roster",
  },
  {
    id: "68",
    name: "USC",
    url: "https://usctrojans.com/sports/baseball/roster",
  },
  {
    id: "112",
    name: "Oklahoma",
    url: "https://soonersports.com/sports/baseball/roster",
  },
  {
    id: "269",
    name: "Troy",
    url: "https://troytrojans.com/sports/baseball/roster",
  },
  {
    id: "134",
    name: "Washington State",
    url: "https://wsucougars.com/sports/baseball/roster",
  },
  {
    id: "199",
    name: "Tennessee",
    url: "https://utsports.com/sports/baseball/roster",
  },
  {
    id: "195",
    name: "St. John's",
    url: "https://redstormsports.com/sports/baseball/roster",
  },
  {
    id: "94",
    name: "East Carolina",
    url: "https://ecupirates.com/sports/baseball/roster",
  },
  {
    id: "172",
    name: "Liberty",
    url: "https://libertyflames.com/sports/baseball/roster",
  },
  {
    id: "426",
    name: "Saint Mary's",
    url: "https://smcgaels.com/sports/baseball/roster",
  },
  {
    id: "72",
    name: "Florida State",
    url: "https://seminoles.com/sports/baseball/roster",
  },
  {
    id: "61",
    name: "Cal Poly",
    url: "https://gopoly.com/sports/baseball/roster",
  },
  {
    id: "95",
    name: "NC State",
    url: "https://gopack.com/sports/baseball/roster",
  },
  {
    id: "197",
    name: "Missouri State",
    url: "https://missouristatebears.com/sports/baseball/roster",
  },
  {
    id: "144",
    name: "Louisiana",
    url: "https://ragincajuns.com/sports/baseball/roster",
  },
];

const jerseyOf = (a) => {
  // Number lives in `number`/`jersey_number`, or as a "Jersey Number N" stamp the
  // scraper routes into `position` on this layout.
  const raw = a.number || a.jersey_number || a.position || "";
  const m = String(raw).match(/(\d+)/);
  return m ? m[1] : null;
};

const teams = ONLY.length ? TEAMS.filter((t) => ONLY.includes(t.id)) : TEAMS;
const summary = [];

for (const team of teams) {
  // participation names (paginated) → identity keys, for the wrong-site gate
  let rows = [],
    pf = 0;
  for (;;) {
    const { data } = await sb
      .from("cbb_pitcher_participation")
      .select("pitcher_name")
      .eq("team_id", team.id)
      .range(pf, pf + 999);
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    pf += 1000;
  }
  const partKeys = new Set(
    rows.map((r) => matchKey(r.pitcher_name)).filter(Boolean),
  );

  // scrape roster
  const out = `/tmp/fixroster_${team.id}.json`;
  let athletes = [];
  try {
    execSync(`python3 ${TEMPLATE} --url "${team.url}" --output ${out}`, {
      stdio: "pipe",
      timeout: 150000,
    });
    athletes = JSON.parse(fs.readFileSync(out, "utf8")).athletes || [];
  } catch (e) {
    summary.push({
      team: team.name,
      note: "SCRAPE FAILED: " + String(e.message).slice(0, 50),
    });
    continue;
  }

  // wrong-site gate: scraped names must overlap this team's participation names
  const overlap = athletes.filter((a) => partKeys.has(matchKey(a.name))).length;
  const rate = partKeys.size ? overlap / partKeys.size : 0;
  if (overlap < 3 || rate < 0.15) {
    summary.push({
      team: team.name,
      scraped: athletes.length,
      partNames: partKeys.size,
      overlap,
      note: "LOW MATCH — wrong site? skipped",
    });
    continue;
  }

  // jersey -> real name
  const byJersey = new Map();
  for (const a of athletes) {
    const j = jerseyOf(a);
    if (j && a.name && !/^jersey\s*number/i.test(a.name))
      byJersey.set(j, a.name);
  }

  // existing rows; only repair placeholder names, matched by jersey number
  const { data: existing } = await sb
    .from("cbb_pitchers")
    .select("pitcher_id,name,number")
    .eq("team_id", team.id);

  const REPAIR_ALL = process.argv.includes("--repair-all");
  let fixed = 0,
    unmatched = 0,
    skippedGood = 0;
  for (const row of existing || []) {
    if (!REPAIR_ALL && !/^jersey\s*number/i.test(row.name || "")) {
      skippedGood++;
      continue;
    }
    const realName =
      row.number != null ? byJersey.get(String(row.number)) : null;
    if (!realName) {
      unmatched++;
      continue;
    }
    const clean = cleanName(realName);
    if (DRY) {
      fixed++;
      continue;
    }
    const { error } = await sb
      .from("cbb_pitchers")
      .update({
        name: clean,
        display_name: clean,
        updated_at: new Date().toISOString(),
      })
      .eq("pitcher_id", row.pitcher_id);
    if (!error) fixed++;
  }
  summary.push({
    team: team.name,
    scraped: athletes.length,
    overlap,
    fixed,
    unmatched,
    skippedGood,
  });
  console.error(`  ${team.name}: fixed ${fixed}, unmatched ${unmatched}`);
}
console.log(JSON.stringify(summary, null, 2));
