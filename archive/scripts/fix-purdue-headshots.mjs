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
const HEADSHOTS_DIR = path.join(__dirname, "public/headshots/purdue");
const TEAM_ID = "189";

// Scraped from purduesports.com/sports/baseball/roster after scroll-triggered lazy load
const ROSTER_IMAGES = {
  "austin klug":
    "https://purduesports.com/imgproxy/dx_6-qPVIN3yOlS1FghCjD55uk11zKcHrFNxhK4oato/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L1hsdmk0bHYycW90NHZid2dvbVlmUENxUExQVWpSUHpZYzg4dExXVzcuanBn.jpg",
  "barron sawyer":
    "https://purduesports.com/imgproxy/sRdyaTyhgFp0xk6oAFew50Vw-OChv6vKGIXudeGEft4/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L01pWWNjZ2FEcHE5YzR0MXRiNldUdzVpWWRrTWlQR0wwemt1Z21Sb2ouanBn.jpg",
  "cole van assen":
    "https://purduesports.com/imgproxy/G66rdH32YFDofPWJgnKl4_OR2SHiwL5fHKtkmTfH1MM/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L0Z4eFJ1bVR5SVVJYzB4eWNyWlJnTjN5TnhseVowY1pwajJNZ1ZvNEguanBn.jpg",
  "evan schweizer":
    "https://purduesports.com/imgproxy/tKRp5uL2iZXrbIgZJ0c-2joAwsDIGa6u2_p5l89OKYc/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L1BuQVNOeThITFNxNzdTTmU1QVRESjVLd3FPT20yN0dnS0VETVZUdGouanBn.jpg",
  "gavin beuter":
    "https://purduesports.com/imgproxy/pyv1g1eNsz_hbKItNWGZ9pVt_v4xUoUeDvJZWn__f10/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L1pWUnRBQTY1SFhPdUZNY1pDYUltanZ4dHI3TVMzSU85Y2FaMnpXRGwuanBn.jpg",
  "graham kollen":
    "https://purduesports.com/imgproxy/Dh4FATrIllFTBx_12ks_VGWxpIaPtCvTArOy4OTLnN4/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L3JhYndreGtITlRWM1dscGhrcldqcklucU9GN2dWSHNMSTk2NGxrREUuanBn.jpg",
  "jackson greer":
    "https://purduesports.com/imgproxy/MGNFuyBbAVNn73zOOp0o_BEdEWw4549UY6HTmh32hAg/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L0pFWjB4UDQ5WWsySnhMUjUzckZLVDVRRENiTWY0UVEwVkl2RDFkS2MuanBn.jpg",
  "jacob boland":
    "https://purduesports.com/imgproxy/VX-k_1iYghi0eRKGO2CNEo1DDhcP0xjSCo0JOncKcgo/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3LzJLUEpvZEFpb0gxT0FVSU9yTmppYTBrbmYyQlRJQ3RGbHR2Q1lpaXEuanBn.jpg",
  "jake kramer":
    "https://purduesports.com/imgproxy/2F4m8rAOAUHvtArrkDuicoteO1mxqFDjFLWE7gtj5DU/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L2VLelg2bE5IeGJ1RUNTY3JvWkRYMWwzWmNha2FlYXRBYzFRcTNTeDcuanBn.jpg",
  "jarvis evans":
    "https://purduesports.com/imgproxy/9UsF7OC3kMfPKRPi5XaF79mSTx0vLlAGk7ZMw0Mf5MU/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzEwLzBsa1JTRkdEWjBER3RCTVgzTU5Jc09DU1JkYWtmQmIwY1ZPVGJTWXkuanBn.jpg",
  "joe trenerry":
    "https://purduesports.com/imgproxy/Fw21C_XVEaEDoa6h70DqZvchezv3EBzlIV-p3oKQAkg/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L25UZVVCRGpLSXVZVjJRMzRYazBlTkgwQ08zQVZVcW5FSmNDY2pqQVcuanBn.jpg",
  "lucas grant":
    "https://purduesports.com/imgproxy/kBcMYDGnNhm_aHK4JYUPlBVVDI-bPqZxV6AmE0sXpI8/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzEwLzJVZnVpQkhTSFBVYXBTREVVd1RvbVdGWkxrTTlmWVRXZEVYd3gyakMuanBn.jpg",
  "nick kolze":
    "https://purduesports.com/imgproxy/ybNRc1o7oifb4fEKDoCsAo5TfX-V9t6-W5oYpTuMNq0/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L0QyeEZyU1VHU29hQlozSGJ2YkM5SHJScjNJdmRQSmRQU1NQbU9NbTEuanBn.jpg",
  "noah filer":
    "https://purduesports.com/imgproxy/1jwhE2pTggbfmjWvS4HxelNfc_ItPsTN3EjCLMaSL9Q/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L2JIeVpyelIxSFBWVzJIQlZjQkZQaWJhVHVpSzVuOERLMWtUYkFwS3QuanBn.jpg",
  "thomas howard":
    "https://purduesports.com/imgproxy/_M_3jlCled5tROejqvO54eGzfauJREGyggyTuFmEz0Q/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzEwL0lDUUF5SjYweGd1RUVzNDZJUkV2TnBnTTk0NjdhOU9FQWdOWWhYVGIuanBn.jpg",
  "trevor kester-johnson":
    "https://purduesports.com/imgproxy/8_oRRbaZvZV2AVqx0mypyKITXm5htAYEsbgzssFzkgM/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L3V2TTZFWVVWT3VOenZ2dXpsRjIzeFJjeVN1VXRXdFlZWHZCcWE4YWsuanBn.jpg",
  "tro fellings":
    "https://purduesports.com/imgproxy/9b2Ncbh4Dmc4FCjprJAzeZAFW8jfd8P1GITapOaBJus/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3L1JUZ1pTTElaUWlna3NEeXdleG83YzVLclp3QkhqdVY0TjJKU0ZRbjUuanBn.jpg",
  "zach erdman":
    "https://purduesports.com/imgproxy/rZgoH7BK_RIP6cm8t4snm4CjGT-KlhKoutP976JAEOE/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3B1cmR1ZXNwb3J0cy1jb20tcHJvZC8yMDI1LzExLzA3LzZSTDBDRkRla0ltUWtxbm9VMnVhbXpucHhkSjExakhWUU9xWU1CekkuanBn.jpg",
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
  console.log("\nFixing Purdue headshots...\n");
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
    const localPath = `/headshots/purdue/${slug}.jpg`;
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
