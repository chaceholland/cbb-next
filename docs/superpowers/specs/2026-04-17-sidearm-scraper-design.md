# SIDEARM School Site Scraper — Design Spec

## Problem

ESPN lacks pitcher participation data for ~600 completed CBB games (55% coverage). The missing games are concentrated in mid-week matchups and games involving non-major opponents. Power 5 school athletics websites (SIDEARM Sports platform) publish complete box scores for every game, including detailed pitching lines.

## Solution

Replace the D1Baseball/StatBroadcast fallback with a SIDEARM school site scraper that runs as the second data source after ESPN fails. Uses a Cloudflare Worker with Browser Rendering (headless Chromium) to render JS-heavy SIDEARM pages and extract pitching data.

## Architecture

```
CBB Cron (Vercel) — per game missing participation:
  1. ESPN API (existing) → success? done
  2. SIDEARM via Cloudflare Worker (new) → success? done
  3. Mark no_data, increment scrape_attempts

Cloudflare Worker (existing d1-proxy, new endpoints):
  POST /sidearm/schedule — render team schedule, return game list + box score URLs
  POST /sidearm/boxscore — render box score page, extract pitching table as JSON
```

## Cloudflare Worker: New Endpoints

### POST /sidearm/schedule

**Input:**
```json
{ "domain": "goduke.com", "sportPath": "/sports/baseball", "season": "2026" }
```

**Process:**
1. Render `https://{domain}{sportPath}/schedule` in headless Chromium
2. Wait for schedule content to load (look for game result elements)
3. Extract each game: date, opponent name, score, box score link URL
4. Return structured data

**Output:**
```json
{
  "games": [
    {
      "date": "2026-04-14",
      "opponent": "Liberty",
      "homeScore": 4,
      "awayScore": 10,
      "boxscoreUrl": "/sports/baseball/stats/2026/liberty/boxscore/24604"
    }
  ]
}
```

**Caching:** 1-hour TTL per team in Workers KV. Completed game box score URLs are immutable.

### POST /sidearm/boxscore

**Input:**
```json
{ "url": "https://goduke.com/sports/baseball/stats/2026/liberty/boxscore/24604" }
```

**Process:**
1. Render full box score page in headless Chromium
2. Wait for pitching statistics table to load
3. Extract pitcher rows: name, IP, H, R, ER, BB, K (SO), HR, ERA
4. Separate into home and away sections based on table headers

**Output:**
```json
{
  "home": [
    { "name": "Jake Potts", "stats": { "IP": "1.2", "H": "5", "R": "5", "ER": "4", "BB": "1", "K": "1", "HR": "0", "ERA": "7.20" } }
  ],
  "away": [
    { "name": "John Smith", "stats": { "IP": "6.0", "H": "3", "R": "1", "ER": "1", "BB": "2", "K": "8", "HR": "0", "ERA": "2.50" } }
  ]
}
```

**Caching:** Completed game box scores cached indefinitely in Workers KV.

### Auth & Rate Limiting

- Same secret-based auth as existing D1 proxy endpoints
- 500ms delay between Chromium renders to avoid hammering school sites
- Chromium render timeout: 15 seconds per page

## Cron Integration (route.ts)

### TEAM_SITES Config

Hardcoded mapping of 25 Power 5 ESPN team IDs to their athletics websites:

```typescript
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
```

### Fallback Flow

When ESPN returns empty for a game:

1. Check if home team has a `TEAM_SITES` entry; if not, check away team
2. If neither team has an entry, mark as `no_data` (same as today)
3. Call `scrapeSidearm(game, siteConfig)`:
   a. Fetch team schedule from worker `/sidearm/schedule` (cached per team per cron run)
   b. Match game by date (+-1 day for timezone) + fuzzy opponent name
   c. If match found, fetch box score from worker `/sidearm/boxscore`
   d. Map pitching rows to `PitcherRecord[]` with `source: "sidearm"`
4. Upsert into `cbb_pitcher_participation`

### Schedule Matching Logic

- **Date matching:** Compare game date within +-1 day window to handle UTC offset issues
- **Opponent matching:** Normalize both ESPN and SIDEARM team names:
  - Lowercase, strip punctuation
  - Remove common suffixes ("Wildcats", "Tigers", etc.)
  - Token overlap scoring — match if >50% of tokens overlap
  - E.g., "NC State Wolfpack" matches "N.C. State"

### Pitcher ID Format

`SIDEARM-{espn_game_id}-{espn_team_id}-{normalizedPitcherName}`

Same pattern as D1 prefix but with SIDEARM prefix for provenance tracking.

## Code Changes

### Remove (D1Baseball fallback)

- `scrapeD1Baseball()` and all helpers: `findD1BroadcastId`, `fetchD1Scoreboard`, `getStatBroadcastSession`, `fetchStatBroadcastView`, `matchD1Games`, `parseBoxScorePitchers`, `toD1Date`, `normalizeTeamName`
- D1 diagnostic logging in the main scrape loop
- D1 fallback block (`ESPN no data → try D1Baseball`)
- D1 Cloudflare Worker proxy endpoint (can be deprecated later)

### Add (SIDEARM fallback)

- `TEAM_SITES` config object (25 entries)
- `scrapeSidearm(game, siteConfig)` — orchestrates schedule fetch + match + box score fetch
- `fetchSidearmSchedule(domain, sportPath, season)` — calls worker `/sidearm/schedule`
- `fetchSidearmBoxscore(url)` — calls worker `/sidearm/boxscore`
- `matchScheduleGame(schedule, gameDate, opponentName)` — fuzzy date + name matching
- `mapSidearmPitchers(boxscore, game)` — converts worker response to `PitcherRecord[]`

### Cloudflare Worker (d1-proxy)

- New `handleSidearmSchedule(request)` handler
- New `handleSidearmBoxscore(request)` handler
- Browser Rendering integration (Chromium launch, page render, DOM extraction)
- Workers KV for caching schedule + box score responses

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Neither team in TEAM_SITES | Skip SIDEARM, mark no_data |
| Worker fetch fails (network/timeout) | Skip SIDEARM for this game, retry next run |
| Schedule page renders but no games found | Skip, retry next run |
| No schedule match (date/name) | Mark no_data |
| Box score renders but no pitching table | Mark no_data |
| Chromium render timeout (>15s) | Return empty, game retried next run |
| Max attempts reached (5) | Permanently skip game |

## Testing

1. Verify worker endpoints with 2-3 known box scores (Duke, Ohio State, LSU)
2. Confirm schedule matching with timezone edge cases
3. Run cron manually, verify participation records inserted with `source: "sidearm"`
4. Check that removed D1 code doesn't break anything
