#!/usr/bin/env node
/**
 * Fix Arizona State headshots.
 * thesundevils.com/imgproxy URLs return 403 when accessed directly.
 * Solution: use Playwright to download images within browser session,
 * save to public/headshots/asu/ as static files, update DB with /headshots/asu/{slug}.{ext}
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const TEAM_ID = "59";
const ROSTER_URL = "https://thesundevils.com/sports/baseball/roster";
const OUT_DIR = join(__dirname, "public", "headshots", "asu");

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

const normName = (n) =>
  n
    ? n
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
const slugify = (n) =>
  n
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

async function main() {
  console.log(
    "⚾ FIXING ARIZONA STATE HEADSHOTS (Playwright → public/headshots/asu/)\n",
  );

  // 1. Parse NUXT data to get player names + imgproxy URLs
  console.log("Fetching roster NUXT data...");
  const res = await fetch(ROSTER_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const html = await res.text();

  const nuxtMarker = '"__NUXT_DATA__">[';
  const start = html.indexOf(nuxtMarker);
  if (start < 0) throw new Error("__NUXT_DATA__ not found");
  const dataStart = start + nuxtMarker.length - 1;
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
  const stateObj = arr.find(
    (v) =>
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.keys(v).some(
        (k) => k.includes("roster-") && k.includes("-players-list"),
      ),
  );
  if (!stateObj)
    throw new Error("Could not find roster state object in NUXT data");
  const rosterKey = Object.keys(stateObj).find((k) =>
    k.includes("-players-list"),
  );
  const playersContainer = arr[stateObj[rosterKey]];
  const players = deref(arr, playersContainer.players);
  if (!Array.isArray(players)) throw new Error("Players is not an array");

  console.log(`NUXT data: ${players.length} players`);

  // Extract all players with photo URLs
  const scraped = players
    .map((p) => {
      const name =
        p.player?.full_name ||
        [p.player?.first_name, p.player?.last_name].filter(Boolean).join(" ");
      const photoUrl = p.player?.master_photo?.url || p.photo?.url;
      return { name, photoUrl };
    })
    .filter((p) => p.name && p.photoUrl);

  console.log(`${scraped.length} players with photo URLs`);

  // 2. Get ALL ASU pitchers (not just null ones — we need to replace broken imgproxy URLs)
  const { data: dbPitchers } = await supabase
    .from("cbb_pitchers")
    .select("pitcher_id, name, headshot")
    .eq("team_id", TEAM_ID);

  console.log(`DB pitchers: ${dbPitchers?.length || 0}`);

  // 3. Match pitchers to scraped players
  const scrapedMap = new Map(scraped.map((p) => [normName(p.name), p]));
  const toProcess = [];
  for (const pitcher of dbPitchers || []) {
    const key = normName(pitcher.name);
    let match = scrapedMap.get(key);
    if (!match) {
      const parts = key.split(" ");
      if (parts.length >= 2) {
        const lastName = parts[parts.length - 1];
        const firstInitial = parts[0][0];
        for (const [sk, val] of scrapedMap) {
          const sp = sk.split(" ");
          if (sp[sp.length - 1] === lastName && sp[0][0] === firstInitial) {
            match = val;
            break;
          }
        }
      }
    }
    if (match) toProcess.push({ ...pitcher, photoUrl: match.photoUrl });
    else console.log(`  ⚠️  No photo URL found for: ${pitcher.name}`);
  }

  console.log(
    `\nMatched ${toProcess.length} pitchers. Downloading images via Playwright...`,
  );

  // 4. Create output directory
  mkdirSync(OUT_DIR, { recursive: true });

  // 5. Use Playwright to download images within browser session
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to roster page first to establish session/cookies
  await page.goto(ROSTER_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2000);

  let updated = 0;
  for (const pitcher of toProcess) {
    try {
      // Download image within browser session (bypasses imgproxy IP restriction)
      const imageBuffer = await page.evaluate(async (url) => {
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buf = await r.arrayBuffer();
        return Array.from(new Uint8Array(buf));
      }, pitcher.photoUrl);

      const buffer = Buffer.from(imageBuffer);
      const ext = pitcher.photoUrl.includes(".png")
        ? "png"
        : pitcher.photoUrl.includes(".webp")
          ? "webp"
          : "jpg";
      const slug = slugify(pitcher.name);
      const filename = `${slug}.${ext}`;
      const filePath = join(OUT_DIR, filename);
      const publicPath = `/headshots/asu/${filename}`;

      // Save to public/headshots/asu/
      writeFileSync(filePath, buffer);

      // Update DB with static file path
      const { error: dbError } = await supabase
        .from("cbb_pitchers")
        .update({ headshot: publicPath })
        .eq("pitcher_id", pitcher.pitcher_id);

      if (!dbError) {
        console.log(
          `  ✅ ${pitcher.name} → ${publicPath} (${buffer.length} bytes)`,
        );
        updated++;
      } else {
        console.log(
          `  ❌ DB update failed for ${pitcher.name}: ${dbError.message}`,
        );
      }
    } catch (e) {
      console.log(`  ❌ Error for ${pitcher.name}: ${e.message}`);
    }
  }

  await page.close();
  await browser.close();

  console.log(`\n✅ Updated ${updated} Arizona State headshots`);
  console.log(`   Images saved to: public/headshots/asu/`);
}

main().catch(console.error);
