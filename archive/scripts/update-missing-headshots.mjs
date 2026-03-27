#!/usr/bin/env node
/**
 * Update headshots for all teams currently missing them.
 *
 * Two sources:
 *   1. ~/baseball-scrape-results/<team>/roster.json  — already has URLs
 *   2. Playwright scrape from team roster page        — for teams with no cached URLs
 *
 * Matches scraped players to DB pitchers by normalized name.
 *
 * Run: node update-missing-headshots.mjs
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, existsSync } from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const SCRAPE_DIR = join(os.homedir(), "baseball-scrape-results");

// ─── Name normalisation ───────────────────────────────────────────────────────

const normName = (name) => {
  if (!name) return "";
  // Handle "Last, First" format
  if (name.includes(",")) {
    const [last, first] = name.split(",").map((s) => s.trim());
    name = `${first} ${last}`;
  }
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

// ─── Teams config ─────────────────────────────────────────────────────────────

// strategy: 'file' = read from baseball-scrape-results
//           'scrape' = use Playwright on roster page
const TEAMS = [
  // FILE-based (headshot URLs already in scraped JSON)
  { team_id: "60", name: "Arizona Wildcats", strategy: "file", dir: "arizona" },
  { team_id: "167", name: "Iowa", strategy: "file", dir: "iowa" },
  { team_id: "99", name: "Nebraska", strategy: "file", dir: "nebraska" },
  {
    team_id: "65",
    name: "California Golden Bears",
    strategy: "file",
    dir: "california",
  },
  { team_id: "153", name: "Illinois", strategy: "file", dir: "illinois" },
  { team_id: "87", name: "Maryland", strategy: "file", dir: "maryland" },

  // SCRAPE-based (no cached headshot URLs)
  {
    team_id: "58",
    name: "Arkansas",
    strategy: "scrape",
    url: "https://arkansasrazorbacks.com/sport/m-basebl/roster/",
  },
  {
    team_id: "77",
    name: "Georgia Tech",
    strategy: "scrape",
    url: "https://ramblinwreck.com/sports/m-basebl/roster/",
  },
  {
    team_id: "85",
    name: "LSU",
    strategy: "scrape",
    url: "https://lsusports.net/sports/baseball/roster/",
  },
  {
    team_id: "176",
    name: "Miami",
    strategy: "scrape",
    url: "https://hurricanesports.com/sports/baseball/roster/",
  },
  {
    team_id: "193",
    name: "South Carolina",
    strategy: "scrape",
    url: "https://gamecocksonline.com/sports/baseball/roster/",
  },
  {
    team_id: "132",
    name: "Virginia Tech",
    strategy: "scrape",
    url: "https://hokiesports.com/sports/baseball/roster/",
  },
  {
    team_id: "117",
    name: "Clemson",
    strategy: "scrape",
    url: "https://clemsontigers.com/sports/baseball/roster",
  },
  {
    team_id: "414",
    name: "Penn State",
    strategy: "scrape",
    url: "https://gopsusports.com/sports/baseball/roster",
  },
  {
    team_id: "120",
    name: "Vanderbilt",
    strategy: "scrape",
    url: "https://vucommodores.com/sports/baseball/roster",
  },
  {
    team_id: "82",
    name: "Kentucky",
    strategy: "scrape",
    url: "https://ukathletics.com/sports/baseball/roster",
  },
  {
    team_id: "81",
    name: "Notre Dame",
    strategy: "scrape",
    url: "https://und.com/sports/baseball/roster",
  },
];

// ─── Load from file ───────────────────────────────────────────────────────────

function loadFromFile(team) {
  const p = join(SCRAPE_DIR, team.dir, "roster.json");
  if (!existsSync(p)) return [];
  const raw = JSON.parse(readFileSync(p, "utf8"));
  const all = Array.isArray(raw)
    ? raw
    : raw.athletes || raw.players || raw.roster || [];
  return all
    .filter((a) => a.headshot_url && !a.headshot_url.startsWith("data:"))
    .map((a) => ({ name: a.name, headshot: a.headshot_url }));
}

// ─── Scrape headshots via Playwright ─────────────────────────────────────────

async function scrapeHeadshots(page, team) {
  await page.goto(team.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Scroll to trigger lazy-loading
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(600);
  }

  return await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    const addPlayer = (name, headshot) => {
      if (!name || !headshot) return;
      if (
        headshot.startsWith("data:") ||
        headshot.includes("placeholder") ||
        headshot.includes("default-")
      )
        return;
      if (seen.has(name)) return;
      seen.add(name);
      results.push({ name: name.trim(), headshot });
    };

    // ── SIDEARM card view ──
    for (const card of document.querySelectorAll(".s-person-card")) {
      const nameEl = card.querySelector(
        'a[href*="/roster/"], a[href*="/player/"], .s-person-details__personal-single-line',
      );
      const img = card.querySelector(
        "img.s-person-card__photo, img[data-src], img",
      );
      if (!nameEl) continue;
      const src = img?.dataset?.src || img?.getAttribute("src");
      addPlayer(
        nameEl.textContent.replace(/Jersey Number \d+/i, "").trim(),
        src,
      );
    }

    // ── SIDEARM table rows ──
    if (results.length === 0) {
      for (const row of document.querySelectorAll(
        ".sidearm-roster-player, tr.sidearm-roster-player",
      )) {
        const nameEl = row.querySelector(".sidearm-roster-player-name a");
        const img = row.querySelector("img");
        if (!nameEl) continue;
        const src = img?.dataset?.src || img?.getAttribute("src");
        addPlayer(nameEl.textContent.trim(), src);
      }
    }

    // ── Georgia Tech figcaption ──
    if (results.length === 0) {
      for (const fig of document.querySelectorAll("figcaption")) {
        const nameLink = fig.querySelector("a");
        if (!nameLink) continue;
        const figure = fig.closest("figure, li");
        const img = figure?.querySelector("img");
        const src = img?.dataset?.src || img?.getAttribute("src");
        addPlayer(nameLink.textContent.trim(), src);
      }
    }

    // ── LSU custom layout (.roster-list_item) ──
    if (results.length === 0) {
      for (const item of document.querySelectorAll(
        ".roster-list_item, .roster-player",
      )) {
        const nameEl = item.querySelector(
          ".roster-list_item_info_name, h3, h4",
        );
        const img = item.querySelector("img");
        if (!nameEl) continue;
        const src = img?.dataset?.src || img?.getAttribute("src");
        addPlayer(nameEl.textContent.trim(), src);
      }
    }

    // ── Miami .player__meta ──
    if (results.length === 0) {
      for (const meta of document.querySelectorAll(
        ".player__meta, .player-card__meta",
      )) {
        const nameEl = meta.querySelector("h3 a, h4 a");
        if (!nameEl) continue;
        const container =
          meta.closest('[class*="player"]') || meta.parentElement;
        const img = container?.querySelector("img");
        const src = img?.dataset?.src || img?.getAttribute("src");
        addPlayer(nameEl.textContent.trim(), src);
      }
    }

    // ── South Carolina .text-wrapper ──
    if (results.length === 0) {
      for (const wrap of document.querySelectorAll(".text-wrapper")) {
        const nameEl = wrap.querySelector(".person__name a, h3 a");
        if (!nameEl) continue;
        const container =
          wrap.closest("li, .roster-item, article") || wrap.parentElement;
        const img = container?.querySelector("img");
        const src = img?.dataset?.src || img?.getAttribute("src");
        addPlayer(nameEl.textContent.trim(), src);
      }
    }

    // ── Virginia Tech: .roster-list-item ──
    if (results.length === 0) {
      for (const item of document.querySelectorAll(
        '[class*="roster-list-item"]',
      )) {
        const nameEl = item.querySelector('[class*="title"] a, h3 a, h4 a');
        if (!nameEl) continue;
        const img = item.querySelector("img");
        const src = img?.dataset?.src || img?.getAttribute("src");
        // Skip lazy placeholders
        if (src && !src.startsWith("data:"))
          addPlayer(nameEl.textContent.trim(), src);
      }
    }

    // ── Arkansas standard HTML table ──
    if (results.length === 0) {
      for (const table of document.querySelectorAll(
        "table.table, table[data-init]",
      )) {
        const rows = table.querySelectorAll("tbody tr");
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll("td"));
          const nameLink = cells[1]?.querySelector("a");
          if (!nameLink) continue;
          const img = row.querySelector("img");
          const src = img?.dataset?.src || img?.getAttribute("src");
          addPlayer(nameLink.textContent.trim(), src);
        }
      }
    }

    // ── Generic fallback: any img near a roster link ──
    if (results.length === 0) {
      const rosterLinks = document.querySelectorAll(
        'a[href*="/roster/"][href*="/player/"], a[href*="/roster/"][href*="/staff/"]',
      );
      for (const link of rosterLinks) {
        const name = link.textContent.trim();
        const container =
          link.closest("li, tr, article, .card, .player") || link.parentElement;
        const img = container?.querySelector("img");
        const src = img?.dataset?.src || img?.getAttribute("src");
        addPlayer(name, src);
      }
    }

    return results;
  });
}

// Upgrade headshot URLs to hi-res where possible
function upgradeUrl(url) {
  if (!url) return url;
  // SIDEARM imgproxy - request larger size
  if (url.includes("imgproxy") && url.includes("/rs:fit:")) {
    return url.replace(/\/rs:fit:\d+:\d+\//, "/rs:fit:500:500/");
  }
  // Common patterns for small thumbnails
  return url
    .replace(/\/[wh]\d+\//g, "/w500/")
    .replace(/\?width=\d+/, "?width=500")
    .replace(/\?w=\d+/, "?w=500");
}

// ─── Match scraped players to DB pitchers ────────────────────────────────────

function matchHeadshots(dbPitchers, scraped) {
  const scrapedMap = new Map(
    scraped.map((p) => [normName(p.name), p.headshot]),
  );
  const updates = [];

  for (const pitcher of dbPitchers) {
    const key = normName(pitcher.name);
    if (scrapedMap.has(key)) {
      updates.push({
        pitcher_id: pitcher.pitcher_id,
        headshot: upgradeUrl(scrapedMap.get(key)),
      });
      continue;
    }
    // Try matching on last name only (for multi-word names / different formats)
    const parts = key.split(" ");
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstInitial = parts[0][0];
      for (const [scraped_key, url] of scrapedMap) {
        const sp = scraped_key.split(" ");
        if (sp[sp.length - 1] === lastName && sp[0][0] === firstInitial) {
          updates.push({
            pitcher_id: pitcher.pitcher_id,
            headshot: upgradeUrl(url),
          });
          break;
        }
      }
    }
  }

  return updates;
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function getPitchersWithoutHeadshots(teamId) {
  const { data, error } = await supabase
    .from("cbb_pitchers")
    .select("pitcher_id, name")
    .eq("team_id", teamId)
    .or("headshot.is.null,headshot.eq.");
  if (error) throw error;
  return data || [];
}

async function batchUpdate(updates) {
  let count = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from("cbb_pitchers")
      .update({ headshot: u.headshot })
      .eq("pitcher_id", u.pitcher_id);
    if (!error) count++;
  }
  return count;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🖼️  UPDATING MISSING HEADSHOTS");
  console.log("=".repeat(60));
  console.log();

  const needsScrape = TEAMS.some((t) => t.strategy === "scrape");
  let browser = null;
  if (needsScrape) browser = await chromium.launch({ headless: true });

  let totalUpdated = 0;
  const summary = [];

  try {
    for (const team of TEAMS) {
      const missing = await getPitchersWithoutHeadshots(team.team_id);
      if (missing.length === 0) {
        console.log(`✅ ${team.name} — no missing headshots, skipping`);
        summary.push({ team: team.name, updated: 0, missing: 0 });
        continue;
      }

      console.log(
        `\n📋 ${team.name} [${team.team_id}] — ${missing.length} missing headshots`,
      );

      let scraped = [];

      if (team.strategy === "file") {
        scraped = loadFromFile(team);
        console.log(`  📂 ${scraped.length} headshot URLs from file`);
      } else {
        console.log(`  → ${team.url}`);
        const page = await browser.newPage();
        try {
          scraped = await scrapeHeadshots(page, team);
        } finally {
          await page.close().catch(() => {});
        }
        console.log(`  🌐 ${scraped.length} headshots scraped`);
      }

      if (scraped.length === 0) {
        console.log(`  ⚠️  No headshots found`);
        summary.push({ team: team.name, updated: 0, missing: missing.length });
        continue;
      }

      const updates = matchHeadshots(missing, scraped);
      console.log(`  🔗 ${updates.length} matched to DB pitchers`);

      if (updates.length > 0) {
        const count = await batchUpdate(updates);
        console.log(`  ✅ Updated ${count} headshots`);
        totalUpdated += count;
        summary.push({
          team: team.name,
          updated: count,
          missing: missing.length,
        });
      } else {
        console.log(`  ⚠️  No name matches found`);
        summary.push({ team: team.name, updated: 0, missing: missing.length });
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  for (const s of summary) {
    const icon = s.updated > 0 ? "✅" : s.missing === 0 ? "⏭️ " : "❌";
    console.log(
      `${icon} ${s.team}: ${s.updated} updated (${s.missing} were missing)`,
    );
  }
  console.log(`\nTotal headshots updated: ${totalUpdated}`);
}

main().catch(console.error);
