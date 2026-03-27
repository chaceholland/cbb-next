#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = "https://dtnozcqkuzhjmjvsfjqk.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c";
const HEADSHOTS_DIR = path.join(__dirname, "public/headshots/lsu");
const TEAM_ID = "85";

// Scraped from lsusports.net/sports/baseball/roster (itemprop="image" content attrs)
const ROSTER_IMAGES = {
  "casan evans":
    "https://lsusports.net/imgproxy/BByokV3PS_B3xKkBma0n_SQs2bNIDMd52Qrh54Qkkbg/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS80YTc1MWU3NC1jYXNhbl9ldmFuc18yMDI1LmpwZw.png",
  "connor benge":
    "https://lsusports.net/imgproxy/tW9Ho7uC7tYY0OGW9s8vnBxDdQahqG6z7KjGpyUUQlo/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi9jYzlkZjNhZi1jb25ub3JfYmVuZ2VfMjAyNS5qcGc.png",
  "cooper moore":
    "https://lsusports.net/imgproxy/EIVSDnSBZCc_inLRd0jrgtlqKM4LHw789eWemMKl2Eo/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi82MDhkNDRjNC1jb29wZXJfbW9vcmVfMjAyNS5qcGc.png",
  "cooper williams":
    "https://lsusports.net/imgproxy/5YcQxKrG4snxrxSA4Z7RwOn8GDRd0Q8SdgZJqB_k74Y/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi83NmRjMWI2Ny1jb29wZXJfd2lsbGlhbXNfMjAyNS5qcGc.png",
  "danny lachenmayer":
    "https://lsusports.net/imgproxy/Yj5YEx6Sulk48jsP7_pKCCh9ahLivu7CiYR4OyeJ_So/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS80MmE4ODNjMy1kYW5ueV9sYWNoZW5tZXllcl8yMDI1LmpwZw.png",
  "dax dathe":
    "https://lsusports.net/imgproxy/REylzvTAftsCAd_SbS1EG0Fqf8qtYCezwKN0QXbxVqg/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS9jZjgwYzIxNi1kYXhfZGF0aGVfMjAyNS5qcGc.png",
  "deven sheerin":
    "https://lsusports.net/imgproxy/QoIJBOOxiNeJM2Jp9NdSywcfal9OkEF330nydpd2IqU/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS84NTM1NWE0OS1kZXZlbl9zaGVlcmluXzIwMjUuanBn.png",
  "dj primeaux":
    "https://lsusports.net/imgproxy/jBVKjc-jddMTcGwGcU5-1-uMNXdwHQsoQLH7PBjynyE/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS9jOWY2OWRkOC1kal9wcmltZWF1eF8yMDI1LmpwZw.png",
  "ethan plog":
    "https://lsusports.net/imgproxy/Z4drv7l5ISMB9cEHBbsLhaZXADlsQ9psQUjnHzFI8JM/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi8wOTRkZDAwNC1ldGhhbl9wbG9nXzIwMjUuanBn.png",
  "gavin guidry":
    "https://lsusports.net/imgproxy/p--uLa3bck8uYOzdsXaImdTPznyzvqno_L161ps9uSo/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi84MzUwNmY4Mi1nYXZpbl9ndWlkcnlfMjAyNS5qcGc.png",
  "grant fontenot":
    "https://lsusports.net/imgproxy/cUlA8CU8-XQyuZm2RttjXYDXhUPVOyoVKB-DRKXHfyU/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS8xMjY1MjgyMi1ncmFudF9mb250ZW5vdF8yMDI1LmpwZw.png",
  "jaden noot":
    "https://lsusports.net/imgproxy/NJvc-TKjz4zRYcsY8SFAy0mAMTRc62PiGIrCxHa_q08/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS85NzVmMDM1Zi1qYWRlbl9ub290XzIwMjUuanBn.png",
  "jonah aase":
    "https://lsusports.net/imgproxy/qancOlGKxera7E3TELazRzVR3flmvIbnVFuHbTMN07U/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi85MGVhNzFmYi1qb25haF9hYXNlXzIwMjUuanBn.png",
  "marcos paz":
    "https://lsusports.net/imgproxy/0KWWsXriSgJUKCMIO9QDpaw4vHtIrWaJqL-3ATOLH_Y/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS9kNjAyOTFjYy1tYXJjb3NfcGF6XzIwMjUuanBn.png",
  "mavrick rizy":
    "https://lsusports.net/imgproxy/nHIaDEd3AkN7b_b6V9LrB4bVPzBuZdvpdRIuRv4wWHE/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS9iNzQyYmZhZS1tYXZyaWNrX3JpenlfMjAyNS5qcGc.png",
  "reagan ricken":
    "https://lsusports.net/imgproxy/6zHoUyKt4WRJmSmzQSMEQWl6xFkh80QwRXJ-DUc-krY/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS8zMjhhZDZmNS1yZWFnYW5fcmlja2VuXzIwMjUuanBn.png",
  "santiago garcia":
    "https://lsusports.net/imgproxy/YRJuzCQNejskdTzHQoNcueO7388BkzCcj565jBmy5ns/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi85OGFlYzk4OC1zYW50aWFnb19nYXJjaWFfMjAyNS5qcGc.png",
  "william schmidt":
    "https://lsusports.net/imgproxy/R0Vma7aFxIC91PWFtVVFLz-cyvu5BDpBDb0jK9j9CpA/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS9hN2NlNzJjMS13aWxsaWFtX3NjaG1pZHRfMjAyNS5qcGc.png",
  "zac cowan":
    "https://lsusports.net/imgproxy/fpdMCLVZ-LU0FBiGUwlUk01PAy8WalX6qsGdI1uBQ7k/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi82MGQ4MTkxMi16YWNfY293YW5fMjAyNS5qcGc.png",
  "zion theophilus":
    "https://lsusports.net/imgproxy/tMPYH68gPtUY0BSgJR1iQwCcz67KEZWG55RQPB7Xvh0/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS9iYWI4YjM0Mi16aW9uX3RoZW9waGlsdXNfMjAyNS5qcGc.png",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function decodeImgproxyUrl(imgproxyUrl) {
  const parts = imgproxyUrl.split("/");
  let b64 = parts[parts.length - 1].replace(/\.(jpg|jpeg|png|webp)$/i, "");
  b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  return Buffer.from(b64, "base64").toString("utf8");
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
            resolve();
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("\nFixing LSU headshots...\n");
  fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });

  const { data: pitchers, error } = await supabase
    .from("cbb_pitchers")
    .select("pitcher_id,name,headshot")
    .eq("team_id", TEAM_ID)
    .order("name");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(`Found ${pitchers.length} pitchers\n`);

  let downloaded = 0,
    skipped = 0,
    errors = 0;

  for (const pitcher of pitchers) {
    const slug = nameToSlug(pitcher.name);
    const localPath = `/headshots/lsu/${slug}.jpg`;
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

    const nameKey = pitcher.name.toLowerCase().replace(/\s+/g, " ").trim();
    const imgproxyUrl = ROSTER_IMAGES[nameKey];

    if (!imgproxyUrl) {
      console.log(`  ✗ ${pitcher.name}: No image found`);
      errors++;
      continue;
    }

    const downloadUrl = decodeImgproxyUrl(imgproxyUrl);

    try {
      await downloadImage(downloadUrl, fullPath);
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
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(
    `\nSummary: ${downloaded} downloaded, ${skipped} skipped, ${errors} errors`,
  );
}

main().catch(console.error);
