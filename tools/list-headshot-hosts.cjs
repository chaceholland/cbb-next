#!/usr/bin/env node
/**
 * Query Supabase for every distinct hostname in cbb_pitchers.headshot URLs,
 * then rewrite next.config.ts remotePatterns to match. Runs in prebuild so
 * drift between DB and allowed image hosts is caught in CI.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

async function fetchColumn(table, column) {
  const urls = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${column}&${column}=not.is.null`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${from}-${from + pageSize - 1}`,
          'Range-Unit': 'items',
        },
      }
    );
    if (!res.ok) {
      console.error(`Supabase error ${table}.${column}`, res.status, await res.text());
      process.exit(1);
    }
    const rows = await res.json();
    for (const r of rows) if (r[column]) urls.push(r[column]);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return urls;
}

async function main() {
  const hosts = new Set();
  const sources = [
    ['cbb_pitchers', 'headshot'],
    ['cbb_teams', 'logo'],
  ];
  for (const [t, c] of sources) {
    const urls = await fetchColumn(t, c);
    for (const u of urls) {
      try {
        hosts.add(new URL(u).hostname);
      } catch {
        /* skip */
      }
    }
  }

  const sorted = [...hosts].sort();
  console.log(`Found ${sorted.length} distinct headshot hosts`);

  const configPath = path.join(__dirname, '..', 'next.config.ts');
  const patterns = sorted
    .map((h) => {
      if (h === 'dtnozcqkuzhjmjvsfjqk.supabase.co') {
        return `      { protocol: "https", hostname: "${h}", pathname: "/storage/v1/object/public/**" },`;
      }
      return `      { protocol: "https", hostname: "${h}" },`;
    })
    .join('\n');

  const next = `import type { NextConfig } from "next";
// AUTO-GENERATED remotePatterns by tools/list-headshot-hosts.cjs — do not edit by hand.
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
${patterns}
    ],
  },
};
export default nextConfig;
`;

  const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  if (existing === next) {
    console.log('next.config.ts already up to date');
    return;
  }
  fs.writeFileSync(configPath, next);
  console.log(`Updated next.config.ts with ${sorted.length} hosts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
