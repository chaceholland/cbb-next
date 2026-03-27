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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// New pitchers scraped from lsusports.net (not yet in DB)
const NEW_PITCHERS = [
  {
    name: "Brayden Simpson",
    number: "10",
    img: "https://lsusports.net/imgproxy/w4ETkC4EtBq9u5StjGDP4yPCDcyYuISqvsYnteb96fw/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS80MzRkMDgxMC1icmF5ZGVuX3NpbXBzb25fMjAyNS5qcGc.png",
  },
  {
    name: "John Pearson",
    number: "11",
    img: "https://lsusports.net/imgproxy/HTQqUhph-T_aDJZ3PtuClmZWgLFzLZ5AtH-WhFhi-lM/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS9hNTU4ZWQ4OC1qb2huX3BlYXJzb25fMjAyNS5qcGc.png",
  },
  {
    name: "Edward Yamin IV",
    number: "13",
    img: "https://lsusports.net/imgproxy/KSw3yTz21Nuqz0qJ1lkVZ0wn5g5M1EnMIUuBF0t19Hw/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS8zY2RjOTFiMi1lZHdhcmRfeWFtaW5fMjAyNS5qcGc.png",
  },
  {
    name: "Daniel Harden",
    number: "14",
    img: "https://lsusports.net/imgproxy/xekbsYMKwu-Itw986seUwtcgoslfZ9PCpMA8ipONUAc/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS8yMjBiYzVlNi1kYW5pZWxfaGFyZGVuXzIwMjUuanBn.png",
  },
  {
    name: "Ethan Clauss",
    number: "16",
    img: "https://lsusports.net/imgproxy/2h85PhN7qJxkcA-bQM51zSNkRhNXwqIZ2OWBGaQ0OhE/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi84Nzg1ZmM1OS1ldGhhbl9jbGF1c3NfMjAyNS5qcGc.png",
  },
  {
    name: "Mason Braun",
    number: "18",
    img: "https://lsusports.net/imgproxy/ZXdXhucDteBy8UhbNFtPIpxj96r1RJobZ6ZjBIH5gEg/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi9iZmQ0MzQ4NS1tYXNvbl9icmF1bl8yMDI1LmpwZw.png",
  },
  {
    name: "William Patrick",
    number: "23",
    img: "https://lsusports.net/imgproxy/bEshUKPscBJURjXhPv1MeTh8v13epFU__JfV7Xma0EA/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi9hM2JjMjQ0OC13aWxsaWFtX3BhdHJpY2tfMjAyNS5qcGc.png",
  },
  {
    name: "Seth Dardar",
    number: "24",
    img: "https://lsusports.net/imgproxy/SaV_XGWk6pLPzYOahr8_GWCJeKkcHHfbqkG7YnlWr4A/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS9hNDliYjc0MC1zZXRoX2RhcmRhcl8yMDI1LmpwZw.png",
  },
  {
    name: "Omar Serna Jr.",
    number: "25",
    img: "https://lsusports.net/imgproxy/RUn3pAnsmb8M_vLGAQB0oYh_RIdS4mixrZS4e-PouIw/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS9jZDY3OWU1OS1vbWFyX3Nlcm5hX2pyLl8yMDI1LmpwZw.png",
  },
  {
    name: "Jack Ruckert",
    number: "32",
    img: "https://lsusports.net/imgproxy/6zplJEY1RBJxbGEaUswdRsVJ9SUINa9b92fDGzy31Dw/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8wOS83OTVmNjU4ZC1qYWNrX3J1Y2tlcnRfMjAyNS5qcGc.png",
  },
  {
    name: "Zach Yorke",
    number: "33",
    img: "https://lsusports.net/imgproxy/8neVChzv6S7bS7-jUXXhb4FVwfXsTLscXXlOPlOHC2Y/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi9mYWRhMTM2YS16YWNoX3lvcmtlXzIwMjUuanBn.png",
  },
  {
    name: "Trent Caraway",
    number: "44",
    img: "https://lsusports.net/imgproxy/SISN53ukDLJuknhVw7RPYJpbK6lSeU6R_GL7_idRmys/fit/1024/1024/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2xzdXNwb3J0cy1jb20vMjAyNS8xMi9lMTE2MjgzOS10cmVudF9jYXJhd2F5XzIwMjUuanBn.png",
  },
];

// Jersey numbers for existing 20 pitchers
const EXISTING_NUMBERS = {
  "Gavin Guidry": "8",
  "William Schmidt": "9",
  "Mavrick Rizy": "17",
  "Casan Evans": "20",
  "Cooper Moore": "22",
  "Zac Cowan": "26",
  "Jaden Noot": "27",
  "Danny Lachenmayer": "28",
  "Cooper Williams": "29",
  "Dax Dathe": "30",
  "Santiago Garcia": "34",
  "Reagan Ricken": "35",
  "Ethan Plog": "38",
  "Jonah Aase": "39",
  "Grant Fontenot": "40",
  "DJ Primeaux": "41",
  "Connor Benge": "43",
  "Deven Sheerin": "45",
  "Zion Theophilus": "52",
  "Marcos Paz": "97",
};

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
  console.log("\nFixing LSU roster...\n");
  fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });

  // Step 1: Update jersey numbers for existing pitchers
  console.log("=== Updating existing pitcher numbers ===");
  const { data: existing } = await supabase
    .from("cbb_pitchers")
    .select("pitcher_id,name,number")
    .eq("team_id", TEAM_ID);

  for (const p of existing) {
    const num = EXISTING_NUMBERS[p.name];
    if (num && p.number !== num) {
      await supabase
        .from("cbb_pitchers")
        .update({ number: num })
        .eq("pitcher_id", p.pitcher_id);
      console.log(`  ✓ ${p.name} → #${num}`);
    }
  }

  // Step 2: Get max pitcher_id to assign new IDs
  const existingIds = existing.map((p) =>
    parseInt(p.pitcher_id.split("-P")[1]),
  );
  let nextId = Math.max(...existingIds) + 1;

  // Step 3: Add new pitchers and download headshots
  console.log("\n=== Adding new pitchers ===");
  const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

  for (const pitcher of NEW_PITCHERS) {
    if (existingNames.has(pitcher.name.toLowerCase())) {
      console.log(`  = ${pitcher.name} already in DB`);
      continue;
    }

    const slug = nameToSlug(pitcher.name);
    const localPath = `/headshots/lsu/${slug}.jpg`;
    const fullPath = path.join(HEADSHOTS_DIR, `${slug}.jpg`);

    // Download headshot
    if (!fs.existsSync(fullPath)) {
      try {
        const downloadUrl = decodeImgproxyUrl(pitcher.img);
        await downloadImage(downloadUrl, fullPath);
        console.log(`  ✓ Downloaded headshot for ${pitcher.name}`);
      } catch (err) {
        console.log(`  ✗ Headshot failed for ${pitcher.name}: ${err.message}`);
      }
    }

    // Insert into DB
    const pitcherId = `${TEAM_ID}-P${nextId}`;
    const { error } = await supabase.from("cbb_pitchers").insert({
      pitcher_id: pitcherId,
      team_id: TEAM_ID,
      name: pitcher.name,
      number: pitcher.number,
      headshot: fs.existsSync(fullPath) ? localPath : null,
      position: "P",
    });

    if (error) {
      console.log(`  ✗ DB insert failed for ${pitcher.name}: ${error.message}`);
    } else {
      console.log(
        `  ✓ Added ${pitcher.name} (#${pitcher.number}) as ${pitcherId}`,
      );
      nextId++;
    }

    await new Promise((r) => setTimeout(r, 150));
  }

  console.log("\nDone.");
}

main().catch(console.error);
