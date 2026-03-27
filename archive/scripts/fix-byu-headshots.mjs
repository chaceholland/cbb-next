#!/usr/bin/env node
/**
 * Fix BYU headshots by decoding imgproxy base64 URLs -> Google Storage URLs
 * and downloading to public/headshots/byu/
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://dtnozcqkuzhjmjvsfjqk.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c";
const HEADSHOTS_DIR = path.join(__dirname, "public/headshots/byu");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
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
      })
      .on("error", reject);
  });
}

function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function decodeImgproxyUrl(imgproxyUrl) {
  // Pattern: .../q:90/{base64}.jpg
  const match = imgproxyUrl.match(
    /\/q:\d+\/([A-Za-z0-9+/=_-]+)\.(jpg|png|webp)$/,
  );
  if (!match) return null;
  // imgproxy uses URL-safe base64 (replace - with + and _ with /)
  const b64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

async function main() {
  console.log("\nFixing BYU headshots...\n");

  if (!fs.existsSync(HEADSHOTS_DIR)) {
    fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });
  }

  const { data: pitchers, error } = await supabase
    .from("cbb_pitchers")
    .select("pitcher_id,name,headshot")
    .eq("team_id", "127")
    .order("name");

  if (error) {
    console.error("Error fetching pitchers:", error.message);
    process.exit(1);
  }

  console.log(`Found ${pitchers.length} BYU pitchers\n`);

  let downloaded = 0,
    skipped = 0,
    errors = 0;

  for (const pitcher of pitchers) {
    const slug = nameToSlug(pitcher.name);
    const localPath = `/headshots/byu/${slug}.jpg`;
    const fullPath = path.join(HEADSHOTS_DIR, `${slug}.jpg`);

    // Skip if already downloaded
    if (fs.existsSync(fullPath)) {
      console.log(`  ✓ ${pitcher.name} (already exists)`);
      // Still update DB if needed
      if (pitcher.headshot !== localPath) {
        await supabase
          .from("cbb_pitchers")
          .update({ headshot: localPath })
          .eq("pitcher_id", pitcher.pitcher_id);
      }
      skipped++;
      continue;
    }

    // Decode imgproxy URL to get Google Storage URL
    const gsUrl = decodeImgproxyUrl(pitcher.headshot);
    if (!gsUrl) {
      console.log(`  ✗ ${pitcher.name}: Could not decode URL`);
      errors++;
      continue;
    }

    try {
      await downloadImage(gsUrl, fullPath);
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
