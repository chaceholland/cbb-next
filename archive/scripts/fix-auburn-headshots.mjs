#!/usr/bin/env node
/**
 * Fix Auburn headshots by scraping the roster page with Puppeteer
 * and downloading images to public/headshots/auburn/
 */

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://dtnozcqkuzhjmjvsfjqk.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c";
const HEADSHOTS_DIR = path.join(__dirname, "public/headshots/auburn");
const TEAM_ID = "55";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://auburntigers.com/",
          },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return downloadImage(res.headers.location, filepath)
              .then(resolve)
              .catch(reject);
          }
          if (res.statusCode === 200) {
            const out = fs.createWriteStream(filepath);
            res.pipe(out);
            out.on("finish", () => {
              out.close();
              resolve(filepath);
            });
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        },
      )
      .on("error", reject);
  });
}

function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  console.log("\nFixing Auburn headshots...\n");

  if (!fs.existsSync(HEADSHOTS_DIR)) {
    fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });
  }

  // Get pitchers from DB
  const { data: pitchers, error } = await supabase
    .from("cbb_pitchers")
    .select("pitcher_id,name,headshot")
    .eq("team_id", TEAM_ID)
    .order("name");

  if (error) {
    console.error("DB error:", error.message);
    process.exit(1);
  }
  console.log(`Found ${pitchers.length} Auburn pitchers in DB\n`);

  // Scrape roster page with Puppeteer to get real headshot URLs
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Loading Auburn roster...");
  await page.goto("https://auburntigers.com/sports/baseball/roster", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await delay(3000);

  // Scroll to trigger lazy loading
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await delay(500);
  }
  await delay(2000);

  // Extract player name -> headshot URL mapping
  const playerImages = await page.evaluate(() => {
    const results = [];
    // SIDEARM roster cards: look for player cards with name and image
    document
      .querySelectorAll(
        '[class*="sidearm-roster-player"], [class*="roster-player"], [class*="s-person"]',
      )
      .forEach((card) => {
        const nameEl = card.querySelector(
          '[class*="name"], [class*="full-name"], a[href*="roster"]',
        );
        const img = card.querySelector("img");
        if (
          nameEl &&
          img &&
          img.src &&
          !img.src.includes("silhouette") &&
          !img.src.includes("placeholder")
        ) {
          results.push({ name: nameEl.textContent?.trim(), src: img.src });
        }
      });

    // Also try table rows
    if (results.length === 0) {
      document.querySelectorAll("table tr").forEach((row) => {
        const nameEl = row.querySelector('a[href*="roster"], td:nth-child(2)');
        const img = row.querySelector("img");
        if (nameEl && img && img.src && !img.src.includes("silhouette")) {
          results.push({ name: nameEl.textContent?.trim(), src: img.src });
        }
      });
    }
    return results;
  });

  console.log(`Found ${playerImages.length} player images on roster page`);

  // Also try og:image from individual bio pages as fallback
  const imageMap = new Map();
  for (const { name, src } of playerImages) {
    if (name) imageMap.set(name.toLowerCase().replace(/\s+/g, " ").trim(), src);
  }

  await browser.close();

  // If we got images from roster, use those. Otherwise scrape bio pages.
  if (playerImages.length === 0) {
    console.log("\nNo images from roster page, will try bio pages...");
    const browser2 = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });
    const page2 = await browser2.newPage();

    for (const pitcher of pitchers) {
      const slug = nameToSlug(pitcher.name);
      const bioUrl = `https://auburntigers.com/sports/baseball/roster/player/${slug}`;
      try {
        await page2.goto(bioUrl, { waitUntil: "networkidle2", timeout: 20000 });
        await delay(1000);
        const ogImg = await page2.evaluate(() => {
          const og = document.querySelector('meta[property="og:image"]');
          return og?.content || null;
        });
        if (ogImg) imageMap.set(pitcher.name.toLowerCase(), ogImg);
        console.log(`  ${pitcher.name}: ${ogImg ? "found" : "not found"}`);
      } catch (e) {
        console.log(`  ${pitcher.name}: error - ${e.message}`);
      }
      await delay(800);
    }
    await browser2.close();
  }

  console.log("\nDownloading headshots...\n");
  let downloaded = 0,
    skipped = 0,
    errors = 0;

  for (const pitcher of pitchers) {
    const slug = nameToSlug(pitcher.name);
    const localPath = `/headshots/auburn/${slug}.jpg`;
    const fullPath = path.join(HEADSHOTS_DIR, `${slug}.jpg`);

    if (fs.existsSync(fullPath)) {
      console.log(`  ✓ ${pitcher.name} (exists)`);
      if (pitcher.headshot !== localPath) {
        await supabase
          .from("cbb_pitchers")
          .update({ headshot: localPath })
          .eq("pitcher_id", pitcher.pitcher_id);
      }
      skipped++;
      continue;
    }

    // Find image URL - try exact match then fuzzy
    const nameKey = pitcher.name.toLowerCase();
    let imgUrl = imageMap.get(nameKey);
    if (!imgUrl) {
      for (const [k, v] of imageMap) {
        if (
          k.includes(nameKey.split(" ")[1]) ||
          nameKey.includes(k.split(" ")[1] || "")
        ) {
          imgUrl = v;
          break;
        }
      }
    }

    if (!imgUrl) {
      console.log(`  ✗ ${pitcher.name}: No image found`);
      errors++;
      continue;
    }

    try {
      await downloadImage(imgUrl, fullPath);
      await supabase
        .from("cbb_pitchers")
        .update({ headshot: localPath })
        .eq("pitcher_id", pitcher.pitcher_id);
      console.log(`  ✓ ${pitcher.name}`);
      downloaded++;
    } catch (err) {
      console.log(`  ✗ ${pitcher.name}: ${err.message}`);
      errors++;
    }

    await delay(300);
  }

  console.log(
    `\nSummary: ${downloaded} downloaded, ${skipped} skipped, ${errors} errors`,
  );
}

main().catch(console.error);
