# SIDEARM School Site Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace D1Baseball fallback with SIDEARM school site scraping via Cloudflare Worker Browser Rendering, covering 25 Power 5 teams.

**Architecture:** Cloudflare Worker renders JS-heavy SIDEARM pages with headless Chromium, extracts pitching data as JSON. CBB Vercel cron calls worker as ESPN fallback. Hardcoded config maps 25 ESPN team IDs to athletics site domains.

**Tech Stack:** Cloudflare Workers (Browser Rendering API, KV), TypeScript, Next.js Route Handler

**Spec:** `docs/superpowers/specs/2026-04-17-sidearm-scraper-design.md`

---

## File Structure

**Cloudflare Worker (`~/d1-proxy/`):**
- Modify: `src/index.ts` — add route dispatch, keep existing D1 endpoint
- Create: `src/sidearm-schedule.ts` — schedule page renderer + parser
- Create: `src/sidearm-boxscore.ts` — box score page renderer + pitcher extractor
- Modify: `wrangler.toml` — add Browser Rendering binding + KV namespace

**CBB Cron (`~/Desktop/cbb-next/`):**
- Modify: `app/api/update/route.ts` — remove D1 fallback, add SIDEARM fallback + TEAM_SITES config

---

### Task 1: Configure Cloudflare Worker for Browser Rendering

**Files:**
- Modify: `~/d1-proxy/wrangler.toml`
- Modify: `~/d1-proxy/src/index.ts` (add Env types only)

- [ ] **Step 1: Update wrangler.toml with Browser Rendering binding and KV**

```toml
name = "d1-proxy"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Browser Rendering for SIDEARM scraping
[browser]
binding = "BROWSER"

# KV for caching schedule + boxscore responses
[[kv_namespaces]]
binding = "CACHE"
id = "CREATE_VIA_WRANGLER"
```

Run: `cd ~/d1-proxy && npx wrangler kv namespace create CACHE`
Take the output ID and replace `CREATE_VIA_WRANGLER` in wrangler.toml.

- [ ] **Step 2: Update Env interface in index.ts**

Add `BROWSER` and `CACHE` bindings to the Env interface at the top of `src/index.ts`:

```typescript
interface Env {
  PROXY_SECRET: string;
  BROWSER: Fetcher;
  CACHE: KVNamespace;
}
```

- [ ] **Step 3: Commit**

```bash
cd ~/d1-proxy
git add wrangler.toml src/index.ts
git commit -m "feat: add Browser Rendering + KV bindings for SIDEARM scraping"
```

---

### Task 2: Build Schedule Scraper Endpoint

**Files:**
- Create: `~/d1-proxy/src/sidearm-schedule.ts`

- [ ] **Step 1: Create the schedule scraper module**

```typescript
import puppeteer from "@cloudflare/puppeteer";

interface ScheduleGame {
  date: string;
  opponent: string;
  score: string;
  boxscoreUrl: string | null;
}

interface ScheduleResult {
  games: ScheduleGame[];
  error?: string;
}

export async function handleSidearmSchedule(
  request: Request,
  env: { BROWSER: Fetcher; CACHE: KVNamespace; PROXY_SECRET: string },
): Promise<Response> {
  // Auth
  const body = await request.json<{
    domain: string;
    sportPath: string;
    season: string;
    secret: string;
  }>();

  if (!body.secret || body.secret !== env.PROXY_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body.domain || !body.sportPath) {
    return Response.json(
      { error: "Missing domain or sportPath" },
      { status: 400 },
    );
  }

  const cacheKey = `schedule:${body.domain}:${body.season || "2026"}`;
  const cached = await env.CACHE.get(cacheKey, "json");
  if (cached) {
    return Response.json(cached);
  }

  const scheduleUrl = `https://${body.domain}${body.sportPath}/schedule/${body.season || "2026"}`;

  let browser;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    );

    await page.goto(scheduleUrl, { waitUntil: "networkidle0", timeout: 20000 });

    // Wait for schedule content to render
    await page.waitForSelector(
      ".sidearm-schedule-games-container, .schedule-list, table",
      { timeout: 10000 },
    ).catch(() => {});

    // Extract game data from rendered page
    const games: ScheduleGame[] = await page.evaluate(() => {
      const results: ScheduleGame[] = [];

      // SIDEARM schedule pages use various selectors
      // Try multiple patterns
      const gameElements = document.querySelectorAll(
        ".sidearm-schedule-game, .schedule-game, [class*='schedule'] li, .schedule-list .event",
      );

      for (const el of gameElements) {
        // Date
        const dateEl =
          el.querySelector(".sidearm-schedule-game-opponent-date, .schedule-date, time, [class*='date']");
        const dateText = dateEl?.textContent?.trim() || dateEl?.getAttribute("datetime") || "";

        // Opponent
        const oppEl =
          el.querySelector(".sidearm-schedule-game-opponent-name, .schedule-opponent, [class*='opponent']");
        const opponent = oppEl?.textContent?.trim() || "";

        // Score
        const scoreEl =
          el.querySelector(".sidearm-schedule-game-result, .schedule-score, [class*='score'], [class*='result']");
        const score = scoreEl?.textContent?.trim() || "";

        // Box score link
        const boxLink = el.querySelector(
          "a[href*='boxscore'], a[href*='box-score'], a[href*='stats']",
        );
        const boxscoreUrl = boxLink?.getAttribute("href") || null;

        if (dateText || opponent) {
          results.push({ date: dateText, opponent, score, boxscoreUrl });
        }
      }

      return results;
    });

    const result: ScheduleResult = { games };
    // Cache for 1 hour
    await env.CACHE.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 3600,
    });

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { games: [], error: (err as Error).message },
      { status: 200 },
    );
  } finally {
    if (browser) await browser.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/d1-proxy
git add src/sidearm-schedule.ts
git commit -m "feat: add SIDEARM schedule scraper endpoint"
```

---

### Task 3: Build Box Score Scraper Endpoint

**Files:**
- Create: `~/d1-proxy/src/sidearm-boxscore.ts`

- [ ] **Step 1: Create the box score scraper module**

```typescript
import puppeteer from "@cloudflare/puppeteer";

interface PitcherStats {
  name: string;
  IP: string | null;
  H: string | null;
  R: string | null;
  ER: string | null;
  BB: string | null;
  K: string | null;
  HR: string | null;
  ERA: string | null;
}

interface BoxscoreResult {
  home: PitcherStats[];
  away: PitcherStats[];
  error?: string;
}

export async function handleSidearmBoxscore(
  request: Request,
  env: { BROWSER: Fetcher; CACHE: KVNamespace; PROXY_SECRET: string },
): Promise<Response> {
  const body = await request.json<{ url: string; secret: string }>();

  if (!body.secret || body.secret !== env.PROXY_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body.url) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  // Completed game box scores are immutable — cache indefinitely
  const cacheKey = `boxscore:${body.url}`;
  const cached = await env.CACHE.get(cacheKey, "json");
  if (cached) {
    return Response.json(cached);
  }

  let browser;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    );

    // Ensure full URL
    const fullUrl = body.url.startsWith("http")
      ? body.url
      : `https://${new URL(body.url, "https://placeholder.com").href}`;

    await page.goto(fullUrl, { waitUntil: "networkidle0", timeout: 20000 });

    // Wait for pitching stats table
    await page.waitForSelector(
      "table, [class*='pitching'], [class*='pitcher']",
      { timeout: 10000 },
    ).catch(() => {});

    // Extract pitching data
    const result: BoxscoreResult = await page.evaluate(() => {
      const home: PitcherStats[] = [];
      const away: PitcherStats[] = [];

      // Find all tables on the page
      const tables = document.querySelectorAll("table");

      for (const table of tables) {
        // Check if this is a pitching table by looking at headers
        const headerRow = table.querySelector("thead tr, tr:first-child");
        const headerText = headerRow?.textContent?.toLowerCase() || "";
        if (
          !headerText.includes("ip") ||
          (!headerText.includes("so") &&
            !headerText.includes("k") &&
            !headerText.includes("strikeout"))
        ) {
          continue;
        }

        // Determine header column indices
        const headers: string[] = [];
        const headerCells = headerRow?.querySelectorAll("th, td") || [];
        for (const cell of headerCells) {
          headers.push(cell.textContent?.trim().toUpperCase() || "");
        }

        const ipIdx = headers.findIndex(
          (h) => h === "IP" || h === "INN" || h === "INNINGS",
        );
        const hIdx = headers.findIndex((h) => h === "H" || h === "HITS");
        const rIdx = headers.findIndex((h) => h === "R" || h === "RUNS");
        const erIdx = headers.findIndex(
          (h) => h === "ER" || h === "EARNED RUNS",
        );
        const bbIdx = headers.findIndex(
          (h) => h === "BB" || h === "WALKS" || h === "BASE ON BALLS",
        );
        const kIdx = headers.findIndex(
          (h) =>
            h === "K" ||
            h === "SO" ||
            h === "STRIKEOUTS" ||
            h === "STRIKE OUTS",
        );
        const hrIdx = headers.findIndex(
          (h) => h === "HR" || h === "HOME RUNS",
        );
        const eraIdx = headers.findIndex((h) => h === "ERA");

        // Parse data rows
        const rows = table.querySelectorAll("tbody tr, tr:not(:first-child)");
        const pitchers: PitcherStats[] = [];

        for (const row of rows) {
          const cells = row.querySelectorAll("td, th");
          if (cells.length < 3) continue;

          // First cell is usually the player name
          const nameCell = cells[0];
          const name = nameCell?.textContent?.trim() || "";

          // Skip totals/summary rows
          if (
            !name ||
            name.toLowerCase().includes("total") ||
            name.toLowerCase().includes("team")
          ) {
            continue;
          }

          const getCellText = (idx: number) =>
            idx >= 0 && idx < cells.length
              ? cells[idx]?.textContent?.trim() || null
              : null;

          pitchers.push({
            name,
            IP: getCellText(ipIdx),
            H: getCellText(hIdx),
            R: getCellText(rIdx),
            ER: getCellText(erIdx),
            BB: getCellText(bbIdx),
            K: getCellText(kIdx),
            HR: getCellText(hrIdx),
            ERA: getCellText(eraIdx),
          });
        }

        if (pitchers.length > 0) {
          // Determine if home or away based on table position or heading
          // First pitching table is typically the away team, second is home
          // (SIDEARM convention: visitor stats first)
          const heading =
            table
              .closest("section, div")
              ?.querySelector("h2, h3, h4, caption")
              ?.textContent?.toLowerCase() || "";

          if (away.length === 0 && !heading.includes("home")) {
            away.push(...pitchers);
          } else {
            home.push(...pitchers);
          }
        }
      }

      return { home, away };
    });

    // Cache completed box scores indefinitely (30 days TTL as safety)
    if (result.home.length > 0 || result.away.length > 0) {
      await env.CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 2592000,
      });
    }

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { home: [], away: [], error: (err as Error).message },
      { status: 200 },
    );
  } finally {
    if (browser) await browser.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/d1-proxy
git add src/sidearm-boxscore.ts
git commit -m "feat: add SIDEARM box score scraper endpoint"
```

---

### Task 4: Wire Up Worker Routing

**Files:**
- Modify: `~/d1-proxy/src/index.ts`

- [ ] **Step 1: Add route dispatch to the worker fetch handler**

Replace the entire `src/index.ts` with:

```typescript
/**
 * Cloudflare Worker proxy for CBB data scraping.
 * - GET /?date=YYYYMMDD&secret=... — D1Baseball scoreboard (legacy)
 * - POST /sidearm/schedule — render SIDEARM schedule page, extract games
 * - POST /sidearm/boxscore — render SIDEARM box score, extract pitching
 */

import { handleSidearmSchedule } from "./sidearm-schedule";
import { handleSidearmBoxscore } from "./sidearm-boxscore";

interface Env {
  PROXY_SECRET: string;
  BROWSER: Fetcher;
  CACHE: KVNamespace;
}

const D1_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function handleD1Proxy(url: URL, env: Env): Promise<Response> {
  const secret = url.searchParams.get("secret");
  if (!env.PROXY_SECRET || secret !== env.PROXY_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const date = url.searchParams.get("date");
  if (!date || !/^\d{8}$/.test(date)) {
    return new Response("Missing or invalid date param (YYYYMMDD)", {
      status: 400,
    });
  }

  try {
    const d1Url = `https://d1baseball.com/wp-content/plugins/integritive/dynamic-scores.php?v=${Date.now()}&date=${date}`;
    const res = await fetch(d1Url, {
      headers: {
        ...D1_HEADERS,
        Referer: `https://d1baseball.com/scores/?date=${date}`,
      },
    });

    if (!res.ok) {
      return new Response(`D1Baseball returned HTTP ${res.status}`, {
        status: 502,
      });
    }

    const data = await res.text();
    return new Response(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    return new Response(`Proxy error: ${(err as Error).message}`, {
      status: 502,
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route dispatch
    if (request.method === "POST" && path === "/sidearm/schedule") {
      return handleSidearmSchedule(request, env);
    }
    if (request.method === "POST" && path === "/sidearm/boxscore") {
      return handleSidearmBoxscore(request, env);
    }

    // Default: legacy D1Baseball proxy (GET /)
    return handleD1Proxy(url, env);
  },
};
```

- [ ] **Step 2: Install puppeteer dependency**

```bash
cd ~/d1-proxy && npm install @cloudflare/puppeteer
```

- [ ] **Step 3: Deploy worker**

```bash
cd ~/d1-proxy && npx wrangler deploy
```

- [ ] **Step 4: Test schedule endpoint**

```bash
curl -X POST https://d1-proxy.chace-holland.workers.dev/sidearm/schedule \
  -H "Content-Type: application/json" \
  -d '{"domain":"goduke.com","sportPath":"/sports/baseball","season":"2026","secret":"YOUR_SECRET"}'
```

Verify: response contains `games` array with dates, opponents, and boxscoreUrl values.

- [ ] **Step 5: Test boxscore endpoint**

Use a boxscoreUrl from the schedule response:

```bash
curl -X POST https://d1-proxy.chace-holland.workers.dev/sidearm/boxscore \
  -H "Content-Type: application/json" \
  -d '{"url":"https://goduke.com/sports/baseball/stats/2026/liberty/boxscore/24604","secret":"YOUR_SECRET"}'
```

Verify: response contains `home` and `away` arrays with pitcher names and stats.

- [ ] **Step 6: Commit**

```bash
cd ~/d1-proxy
git add -A
git commit -m "feat: wire up SIDEARM route dispatch + deploy"
```

---

### Task 5: Remove D1Baseball Fallback from CBB Cron

**Files:**
- Modify: `~/Desktop/cbb-next/app/api/update/route.ts`

- [ ] **Step 1: Remove D1Baseball helper functions**

Delete these functions and their supporting types/constants from `route.ts`:
- `TEAM_NAME_OVERRIDES` object (lines ~88-109)
- `D1_HEADERS` object (lines ~111-116)
- `normalizeTeamName()` (lines ~118-128)
- `toD1Date()` (lines ~130-136)
- `D1Game` interface (lines ~138-144)
- `scoreboardCache` (line ~147)
- `fetchD1Scoreboard()` (lines ~149-206)
- `matchD1Games()` and its helper
- `getStatBroadcastSession()`, `fetchStatBroadcastView()`
- `ParsedPitcher` interface, `parseBoxScorePitchers()`
- `findD1BroadcastId()`
- `scrapeD1Baseball()` (lines ~575-648)
- `GameRecord` type (if only used by D1)

Keep: `scrapePitcherData()` (ESPN scraper), `PitcherRecord` type.

- [ ] **Step 2: Remove D1 diagnostic block from main scrape loop**

In the main scrape loop (around line ~897-928), remove the D1 diagnostic test block that starts with `let d1Diagnostic = "not tested"`.

- [ ] **Step 3: Remove D1 fallback from the game scrape loop**

In the game scrape loop (around line ~959), replace the entire D1 fallback block (the `else if (espnResult.length === 0)` branch that calls `scrapeD1Baseball`) with a placeholder comment `// SIDEARM fallback will go here` for now.

- [ ] **Step 4: Remove `d1Diagnostic` from the response object**

Find where `d1Diagnostic` is included in the JSON response and remove it.

- [ ] **Step 5: Verify build**

```bash
cd ~/Desktop/cbb-next && npx next build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/cbb-next
git add app/api/update/route.ts
git commit -m "refactor: remove D1Baseball fallback code"
```

---

### Task 6: Add TEAM_SITES Config and SIDEARM Fallback

**Files:**
- Modify: `~/Desktop/cbb-next/app/api/update/route.ts`

- [ ] **Step 1: Add TEAM_SITES config after the ESPN scraper function**

```typescript
// SIDEARM school site config for 25 Power 5 teams with missing ESPN data
const TEAM_SITES: Record<string, { domain: string; sportPath: string }> = {
  "127": { domain: "byucougars.com", sportPath: "/sports/baseball" },        // BYU
  "198": { domain: "gofrogs.com", sportPath: "/sports/baseball" },            // TCU
  "90":  { domain: "gophersports.com", sportPath: "/sports/baseball" },       // Minnesota
  "85":  { domain: "lsusports.net", sportPath: "/sports/baseball" },          // LSU
  "59":  { domain: "thesundevils.com", sportPath: "/sports/baseball" },       // Arizona State
  "102": { domain: "scarletknights.com", sportPath: "/sports/baseball" },     // Rutgers
  "91":  { domain: "mutigers.com", sportPath: "/sports/baseball" },           // Missouri
  "93":  { domain: "goduke.com", sportPath: "/sports/baseball" },             // Duke
  "108": { domain: "ohiostatebuckeyes.com", sportPath: "/sports/baseball" },  // Ohio State
  "411": { domain: "nusports.com", sportPath: "/sports/baseball" },           // Northwestern
  "60":  { domain: "arizonawildcats.com", sportPath: "/sports/baseball" },    // Arizona
  "86":  { domain: "bceagles.com", sportPath: "/sports/baseball" },           // Boston College
  "168": { domain: "kuathletics.com", sportPath: "/sports/baseball" },        // Kansas
  "132": { domain: "hokiesports.com", sportPath: "/sports/baseball" },        // Virginia Tech
  "131": { domain: "virginiasports.com", sportPath: "/sports/baseball" },     // Virginia
  "294": { domain: "iuhoosiers.com", sportPath: "/sports/baseball" },         // Indiana
  "153": { domain: "fightingillini.com", sportPath: "/sports/baseball" },     // Illinois
  "87":  { domain: "umterps.com", sportPath: "/sports/baseball" },            // Maryland
  "120": { domain: "vucommodores.com", sportPath: "/sports/baseball" },       // Vanderbilt
  "136": { domain: "wvusports.com", sportPath: "/sports/baseball" },          // West Virginia
  "97":  { domain: "godeacs.com", sportPath: "/sports/baseball" },            // Wake Forest
  "161": { domain: "gobearcats.com", sportPath: "/sports/baseball" },         // Cincinnati
  "124": { domain: "uhcougars.com", sportPath: "/sports/baseball" },          // Houston
  "133": { domain: "gohuskies.com", sportPath: "/sports/baseball" },          // Washington
  "89":  { domain: "mgoblue.com", sportPath: "/sports/baseball" },            // Michigan
};

const SIDEARM_WORKER_URL = "https://d1-proxy.chace-holland.workers.dev";

// Cache schedule responses per team within a single cron run
const scheduleCache = new Map<string, { date: string; opponent: string; score: string; boxscoreUrl: string | null }[]>();

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyTeamMatch(espnName: string, sidearmName: string): boolean {
  const a = normalizeName(espnName);
  const b = normalizeName(sidearmName);
  if (a === b) return true;

  // Token overlap — match if >50% of shorter name's tokens are in longer name
  const tokensA = a.split(" ").filter((t) => t.length > 2);
  const tokensB = b.split(" ").filter((t) => t.length > 2);
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length > tokensB.length ? tokensA : tokensB;

  const matches = shorter.filter((t) =>
    longer.some((l) => l.includes(t) || t.includes(l)),
  );
  return matches.length > 0 && matches.length >= shorter.length * 0.5;
}

function datesMatch(espnDate: string, sidearmDate: string): boolean {
  // ESPN dates: "2026-04-10 22:00:00+00"
  // SIDEARM dates: varies — "April 10, 2026", "04/10/2026", "Apr 10", etc.
  const espnD = new Date(espnDate);
  const espnMonth = espnD.getUTCMonth();
  const espnDay = espnD.getUTCDate();
  const espnYear = espnD.getUTCFullYear();

  // Try to parse SIDEARM date
  const sidearmD = new Date(sidearmDate);
  if (!isNaN(sidearmD.getTime())) {
    // Valid date parse — check within +-1 day
    const diffMs = Math.abs(espnD.getTime() - sidearmD.getTime());
    return diffMs < 2 * 24 * 60 * 60 * 1000; // 2 days tolerance
  }

  // Fallback: check if month/day numbers appear in the string
  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  const lower = sidearmDate.toLowerCase();
  const hasMonth =
    lower.includes(monthNames[espnMonth]) ||
    lower.includes(String(espnMonth + 1).padStart(2, "0"));
  const hasDay =
    lower.includes(String(espnDay)) ||
    lower.includes(String(espnDay).padStart(2, "0"));

  return hasMonth && hasDay;
}

async function fetchSidearmSchedule(
  domain: string,
  sportPath: string,
): Promise<{ date: string; opponent: string; score: string; boxscoreUrl: string | null }[]> {
  const cacheKey = domain;
  if (scheduleCache.has(cacheKey)) return scheduleCache.get(cacheKey)!;

  const proxySecret = process.env.D1_PROXY_SECRET;
  const res = await fetch(`${SIDEARM_WORKER_URL}/sidearm/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain,
      sportPath,
      season: "2026",
      secret: proxySecret,
    }),
  });

  if (!res.ok) {
    console.log(`[sidearm] Schedule fetch failed for ${domain}: HTTP ${res.status}`);
    scheduleCache.set(cacheKey, []);
    return [];
  }

  const data = await res.json() as { games: { date: string; opponent: string; score: string; boxscoreUrl: string | null }[] };
  const games = data.games || [];
  scheduleCache.set(cacheKey, games);
  return games;
}

async function fetchSidearmBoxscore(
  url: string,
): Promise<{ home: { name: string; IP: string | null; H: string | null; R: string | null; ER: string | null; BB: string | null; K: string | null; HR: string | null; ERA: string | null }[]; away: typeof this.home }> {
  const proxySecret = process.env.D1_PROXY_SECRET;
  const res = await fetch(`${SIDEARM_WORKER_URL}/sidearm/boxscore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret: proxySecret }),
  });

  if (!res.ok) {
    return { home: [], away: [] };
  }

  return res.json() as any;
}

interface PitcherStatsFromSidearm {
  name: string;
  IP: string | null;
  H: string | null;
  R: string | null;
  ER: string | null;
  BB: string | null;
  K: string | null;
  HR: string | null;
  ERA: string | null;
}

async function scrapeSidearm(
  game: { game_id: string; date: string; home_team_id: string; away_team_id: string; home_name: string; away_name: string },
): Promise<PitcherRecord[] | null> {
  // Find which team has a SIDEARM config
  const homeSite = TEAM_SITES[game.home_team_id];
  const awaySite = TEAM_SITES[game.away_team_id];
  const site = homeSite || awaySite;
  if (!site) return null;

  const isHomeSite = !!homeSite;
  const opponentName = isHomeSite ? game.away_name : game.home_name;

  // Fetch schedule for the team with the SIDEARM config
  const schedule = await fetchSidearmSchedule(site.domain, site.sportPath);
  if (schedule.length === 0) return null;

  // Match game by date + opponent
  const match = schedule.find(
    (g) => datesMatch(game.date, g.date) && fuzzyTeamMatch(opponentName, g.opponent),
  );

  if (!match || !match.boxscoreUrl) {
    console.log(
      `[sidearm] No schedule match for ${game.away_name} @ ${game.home_name} on ${game.date} (site: ${site.domain})`,
    );
    return null;
  }

  // Build full URL
  const boxscoreUrl = match.boxscoreUrl.startsWith("http")
    ? match.boxscoreUrl
    : `https://${site.domain}${match.boxscoreUrl}`;

  console.log(`[sidearm] Fetching boxscore: ${boxscoreUrl}`);

  const boxscore = await fetchSidearmBoxscore(boxscoreUrl);
  if (boxscore.home.length === 0 && boxscore.away.length === 0) return null;

  // Map to PitcherRecord format
  const records: PitcherRecord[] = [];

  const mapPitchers = (pitchers: PitcherStatsFromSidearm[], teamId: string) => {
    for (const p of pitchers) {
      const normalizedName = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      records.push({
        game_id: game.game_id,
        team_id: teamId,
        pitcher_id: `SIDEARM-${game.game_id}-${teamId}-${normalizedName}`,
        pitcher_name: p.name,
        stats: {
          IP: p.IP,
          H: p.H,
          R: p.R,
          ER: p.ER,
          BB: p.BB,
          K: p.K,
          HR: p.HR,
          ERA: p.ERA,
          source: "sidearm",
        },
      });
    }
  };

  // SIDEARM box scores: away team first, home team second
  if (isHomeSite) {
    mapPitchers(boxscore.away, game.away_team_id);
    mapPitchers(boxscore.home, game.home_team_id);
  } else {
    mapPitchers(boxscore.home, game.home_team_id);
    mapPitchers(boxscore.away, game.away_team_id);
  }

  return records.length > 0 ? records : null;
}
```

- [ ] **Step 2: Wire SIDEARM fallback into the game scrape loop**

Replace the placeholder comment (`// SIDEARM fallback will go here`) in the `else if (espnResult.length === 0)` branch:

```typescript
      } else if (espnResult.length === 0) {
        // ESPN has no data — try SIDEARM school site fallback
        console.log(
          `[api/update] ESPN no data for ${matchup}, trying SIDEARM...`,
        );

        let sidearmResult: PitcherRecord[] | null = null;
        try {
          sidearmResult = await scrapeSidearm(game);
        } catch (err) {
          console.log(`[api/update] SIDEARM error for ${matchup}: ${(err as Error).message}`);
        }

        if (sidearmResult && sidearmResult.length > 0) {
          // SIDEARM success
          const { error: upsertErr } = await supabase
            .from("cbb_pitcher_participation")
            .upsert(sidearmResult, { onConflict: "game_id,pitcher_id" });

          if (upsertErr) {
            console.error(`[api/update] SIDEARM upsert error: ${upsertErr.message}`);
            results.errors++;
            results.games.push({ game_id: game.game_id, matchup, status: "error", source: "sidearm", message: upsertErr.message });
          } else {
            await supabase
              .from("cbb_games")
              .update({
                last_scrape_attempt: new Date().toISOString(),
                scrape_status: "scraped",
                scrape_attempts: currentAttempts,
              })
              .eq("game_id", game.game_id);

            results.successful++;
            results.totalPitchers += sidearmResult.length;
            results.games.push({
              game_id: game.game_id,
              matchup,
              status: "success",
              source: "sidearm",
              pitchers: sidearmResult.length,
            });
          }
        } else {
          // Neither ESPN nor SIDEARM has data
          await supabase
            .from("cbb_games")
            .update({
              last_scrape_attempt: new Date().toISOString(),
              scrape_status: "no_data_available",
              scrape_attempts: currentAttempts,
            })
            .eq("game_id", game.game_id);

          results.noData++;
          results.games.push({
            game_id: game.game_id,
            matchup,
            status: "no_data",
            message: "ESPN + SIDEARM both returned null",
          });
        }
```

- [ ] **Step 3: Remove d1Fallback from results type and response**

Remove `d1Fallback: 0` from the results object initialization and any references to it in the response.

- [ ] **Step 4: Add sidearmFallback counter**

Add `sidearmFallback: 0` to the results object. Increment it when SIDEARM succeeds:

```typescript
// In the sidearmResult success branch, add:
results.sidearmFallback++;
```

Add `sidearmFallback` to the results type definition.

- [ ] **Step 5: Verify build**

```bash
cd ~/Desktop/cbb-next && npx next build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/cbb-next
git add app/api/update/route.ts
git commit -m "feat: add SIDEARM school site fallback for 25 Power 5 teams"
```

---

### Task 7: Deploy and Test End-to-End

**Files:** None (deployment + verification)

- [ ] **Step 1: Push CBB changes to deploy**

```bash
cd ~/Desktop/cbb-next && git push origin main
```

Wait for Vercel deployment to reach Ready status.

- [ ] **Step 2: Reset a few permanently skipped games for testing**

```sql
-- Reset 5 Duke games for testing
UPDATE cbb_games
SET scrape_status = NULL, scrape_attempts = 0
WHERE completed = true
  AND (home_team_id = '93' OR away_team_id = '93')
  AND game_id NOT IN (SELECT DISTINCT game_id FROM cbb_pitcher_participation)
LIMIT 5;
```

- [ ] **Step 3: Trigger cron manually**

```bash
curl -s "https://cbb-next.vercel.app/api/update" -H "Authorization: Bearer skip"
```

- [ ] **Step 4: Verify results**

Check the response JSON for:
- `sidearmFallback > 0` — confirms SIDEARM scraper found data
- Games with `source: "sidearm"` in the games array
- No errors related to worker connectivity

- [ ] **Step 5: Verify data in Supabase**

```sql
SELECT * FROM cbb_pitcher_participation
WHERE stats->>'source' = 'sidearm'
ORDER BY updated_at DESC
LIMIT 10;
```

Expected: Records with pitcher names, stats, and `source: "sidearm"`.

- [ ] **Step 6: Reset all permanently skipped games for full backfill**

```sql
UPDATE cbb_games
SET scrape_status = NULL, scrape_attempts = 0
WHERE completed = true
  AND scrape_status = 'no_data_available'
  AND game_id NOT IN (SELECT DISTINCT game_id FROM cbb_pitcher_participation);
```

- [ ] **Step 7: Trigger full backfill**

```bash
curl -s "https://cbb-next.vercel.app/api/update" -H "Authorization: Bearer skip"
```

Note: This will process as many games as possible within the 5-minute timeout. Subsequent daily cron runs will continue the backfill automatically.

- [ ] **Step 8: Commit any final adjustments**

```bash
cd ~/Desktop/cbb-next
git add -A
git commit -m "chore: final adjustments after SIDEARM integration testing"
git push origin main
```
