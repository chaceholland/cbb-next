#!/usr/bin/env node
/**
 * Fix Clemson headshots - WordPress uploads at LastnameFirstname-614x1024.jpg pattern
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
const HEADSHOTS_DIR = path.join(__dirname, "public/headshots/clemson");
const TEAM_ID = "117";

// All player images found from network intercept
const PLAYER_IMAGES = [
  "https://clemsontigers.com/wp-content/uploads/2025/11/KnaakAidan-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/VeaseyAriston-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/BennettBrendon-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/FitzgeraldChance-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/MargoliesDan-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/MoehlerDane-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/NelsonDanny-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/BrownDion-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/TitsworthDrew-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/SimpsonEston-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/SimmersonHayden-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/McGovernJacob-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/MorrisJake-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/AllenJoe-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/LeGuernicJustin-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/FowlerLandon-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/KissenberthLuke-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/SharmanMichael-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/DvorskyNathan-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/FruscoNick-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/SamolNoah-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/MillerPeyton-614x1024.jpg",
  "https://clemsontigers.com/wp-content/uploads/2025/11/BellTalan-614x1024.jpg",
];

// Build name lookup from URL: "KnaakAidan" -> "Aidan Knaak"
function urlToName(url) {
  const filename = path.basename(url).replace(/-614x1024\.jpg$/, "");
  // Split CamelCase: "KnaakAidan" -> find where last name ends
  // Pattern: LastFirst or LastFirstMiddle
  const parts = filename.match(/[A-Z][a-z.]*/g) || [];
  if (parts.length >= 2) {
    // Last name is first part, first name is rest
    const last = parts[0];
    const first = parts.slice(1).join(" ");
    return `${first} ${last}`;
  }
  return filename;
}

function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://clemsontigers.com/",
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

async function main() {
  console.log("\nFixing Clemson headshots...\n");

  if (!fs.existsSync(HEADSHOTS_DIR)) {
    fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: pitchers, error } = await supabase
    .from("cbb_pitchers")
    .select("pitcher_id,name,headshot")
    .eq("team_id", TEAM_ID)
    .order("name");

  if (error) {
    console.error("DB error:", error.message);
    process.exit(1);
  }
  console.log(`Found ${pitchers.length} Clemson pitchers\n`);

  // Build URL map: normalized name -> url
  const urlMap = new Map();
  for (const url of PLAYER_IMAGES) {
    const name = urlToName(url);
    urlMap.set(name.toLowerCase().replace(/\s+/g, " "), url);
  }
  // Manual overrides for Mc/Le prefixed names
  urlMap.set(
    "jacob mcgovern",
    "https://clemsontigers.com/wp-content/uploads/2025/11/McGovernJacob-614x1024.jpg",
  );
  urlMap.set(
    "justin leguernic",
    "https://clemsontigers.com/wp-content/uploads/2025/11/LeGuernicJustin-614x1024.jpg",
  );

  console.log("\nDownloading...\n");
  let downloaded = 0,
    skipped = 0,
    errors = 0;

  for (const pitcher of pitchers) {
    const slug = nameToSlug(pitcher.name);
    const localPath = `/headshots/clemson/${slug}.jpg`;
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

    const nameKey = pitcher.name.toLowerCase().replace(/\s+/g, " ");
    const imgUrl = urlMap.get(nameKey);

    if (!imgUrl) {
      console.log(`  ✗ ${pitcher.name}: No match found`);
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

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(
    `\nSummary: ${downloaded} downloaded, ${skipped} skipped, ${errors} errors`,
  );
}

main().catch(console.error);
