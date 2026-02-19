# Automated ESPN Participation Data Scraper

Automatically checks ESPN's API for pitcher participation data and updates your database.

## Overview

ESPN doesn't immediately populate detailed pitcher participation data for all games. This system automatically re-checks ESPN periodically to catch data when it becomes available.

## Current Status

- **123 games** currently missing pitcher participation data
- ESPN typically populates data within 24-48 hours of game completion
- Some games may never get detailed stats

## Quick Start

### Manual Run

```bash
# Scrape last 7 days
node auto-scrape-participation.mjs

# Scrape last 14 days, limit to 20 games
node auto-scrape-participation.mjs --days 14 --max 20

# Quiet mode (less output)
node auto-scrape-participation.mjs --quiet
```

### Automated Schedule

#### Option 1: macOS/Linux Cron Job

1. Make the script executable:
```bash
chmod +x schedule-scraper.sh
```

2. Edit your crontab:
```bash
crontab -e
```

3. Add one of these schedules:

```bash
# Every 6 hours
0 */6 * * * /Users/chace/Desktop/cbb-next/schedule-scraper.sh

# Every 12 hours (8am and 8pm)
0 8,20 * * * /Users/chace/Desktop/cbb-next/schedule-scraper.sh

# Daily at 3am
0 3 * * * /Users/chace/Desktop/cbb-next/schedule-scraper.sh

# Every 4 hours during baseball season (Feb-June)
0 */4 * * * [ $(date +\%m) -ge 2 -a $(date +\%m) -le 6 ] && /Users/chace/Desktop/cbb-next/schedule-scraper.sh
```

#### Option 2: macOS LaunchAgent (Recommended for Mac)

1. Create a plist file at `~/Library/LaunchAgents/com.cbb.scraper.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cbb.scraper</string>

  <key>ProgramArguments</key>
  <array>
    <string>/Users/chace/Desktop/cbb-next/schedule-scraper.sh</string>
  </array>

  <key>StartInterval</key>
  <integer>21600</integer> <!-- 6 hours in seconds -->

  <key>StandardOutPath</key>
  <string>/Users/chace/Desktop/cbb-next/scraper-logs/launchd.log</string>

  <key>StandardErrorPath</key>
  <string>/Users/chace/Desktop/cbb-next/scraper-logs/launchd-error.log</string>
</dict>
</plist>
```

2. Load the agent:
```bash
launchctl load ~/Library/LaunchAgents/com.cbb.scraper.plist
```

3. Start it immediately:
```bash
launchctl start com.cbb.scraper
```

#### Option 3: Vercel Cron (If deployed to Vercel)

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/scrape-participation",
    "schedule": "0 */6 * * *"
  }]
}
```

Then create `pages/api/scrape-participation.ts` (needs Next.js API route implementation).

## Command Line Options

```
--days <n>      Look back N days (default: 7)
--max <n>       Scrape maximum N games (default: all)
--delay <ms>    Delay between requests in ms (default: 300)
--quiet, -q     Suppress verbose output
--help, -h      Show help
```

## Monitoring

### View Logs

```bash
# View recent scraper runs
ls -lt scraper-logs/run-*.log | head -5

# View latest run
cat scraper-logs/run-*.log | tail -50

# View main log
tail -f scraper-logs/scraper.log
```

### Check Results

Each run creates a JSON log file with detailed results:

```bash
# View latest results
cat scrape-log-*.json | jq '.'
```

Example output:
```json
{
  "total": 123,
  "successful": 15,
  "noData": 108,
  "errors": 0,
  "totalPitchers": 87
}
```

## What Gets Scraped

The scraper:
- ✅ Finds completed games from last N days involving your 64 tracked teams
- ✅ Checks which games are missing pitcher participation data
- ✅ Queries ESPN's API for each missing game
- ✅ Saves pitcher stats (IP, K, ER, BB, H, R, HR) to database
- ✅ Skips games that already have data (idempotent)

## Typical Results

Based on testing:
- **Immediate (0-6 hours)**: 0-10% of games have data
- **24 hours**: 30-50% of games have data
- **48 hours**: 60-80% of games have data
- **1 week**: 80-95% of games have data
- **Never**: 5-20% of games may never get detailed stats

## Rate Limiting

- Default: 300ms delay between requests
- ~200 games/minute maximum
- ESPN API has no published rate limits but be respectful

## Troubleshooting

### No data being found

```bash
# Check if ESPN has data for a specific game
node auto-scrape-participation.mjs --days 30 --max 1
```

ESPN may not have populated the data yet. Wait 24-48 hours and try again.

### Script not running automatically

```bash
# Check cron status (Linux/macOS)
crontab -l

# Check LaunchAgent status (macOS)
launchctl list | grep cbb.scraper

# View system logs
tail -f /var/log/system.log | grep scraper
```

### Database errors

Check your `.env.local` file has valid Supabase credentials.

## Uninstalling

### Remove cron job
```bash
crontab -e
# Delete the scraper line
```

### Remove LaunchAgent
```bash
launchctl unload ~/Library/LaunchAgents/com.cbb.scraper.plist
rm ~/Library/LaunchAgents/com.cbb.scraper.plist
```

## Manual Data Entry (Fallback)

For games where ESPN never populates data, you'll need manual entry. Let me know if you want me to build the manual entry tool.
