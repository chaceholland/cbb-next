# 2026 College Baseball Roster Scraping Guide

Complete guide for scraping and replacing 2026 roster data in the CBB Stats application.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Phase 1: Scraping Rosters](#phase-1-scraping-rosters)
- [Phase 2: Database Replacement](#phase-2-database-replacement)
- [Data Validation](#data-validation)
- [Troubleshooting](#troubleshooting)
- [Error Handling](#error-handling)

## Overview

The 2026 roster scraping system is a two-phase operation designed to safely update pitcher rosters:

### Phase 1: Scraping (`scrape-2026-rosters.mjs`)
- Visits all team roster pages using Playwright
- Extracts pitcher data (name, number, position, headshot, bio data)
- Saves results to `2026-rosters.json` for review
- **Does not modify the database**

### Phase 2: Replacement (`replace-with-2026-rosters.mjs`)
- Reads the scraped JSON file
- Shows summary and requires explicit confirmation
- Deletes all existing pitcher and participation records
- Inserts new 2026 pitcher data
- **Permanently modifies the database**

## Prerequisites

Before starting, ensure you have:

1. **Node.js** (v18 or higher)
2. **Dependencies installed**: Run `npm install` in the project root
3. **Environment variables**: Valid `.env.local` with Supabase credentials
4. **Database access**: Service role key for write operations
5. **Playwright installed**: Chromium browser for web scraping

Verify your setup:
```bash
node --version  # Should be 18+
npm list playwright @supabase/supabase-js dotenv  # Check dependencies
```

## Phase 1: Scraping Rosters

### Running the Scraper

Execute the Phase 1 script:

```bash
./scrape-2026-rosters.mjs
```

Or with explicit node:
```bash
node scrape-2026-rosters.mjs
```

### What Happens

1. Fetches all teams from `cbb_teams` table
2. Maps team names to roster URLs (64 teams configured)
3. Launches headless browser
4. For each team:
   - Navigates to roster page
   - Extracts player data from HTML tables
   - Filters for pitchers only (P, RHP, LHP positions)
   - Captures headshot URLs and bio data
5. Saves results to `2026-rosters.json`
6. Shows summary statistics

### Expected Output

```
🏈 SCRAPING 2026 COLLEGE BASEBALL ROSTERS
============================================================

📋 Found 64 teams to scrape

Processing teams...

✅ Alabama (15 pitchers)
✅ Arizona State (14 pitchers)
✅ Arkansas (16 pitchers)
...
✅ West Virginia (12 pitchers)

============================================================
📊 SCRAPING COMPLETE
============================================================

Total Teams:     64
Successful:      64 (100.0%)
Failed:          0 (0.0%)
Total Pitchers:  928

Results saved to: 2026-rosters.json

✅ Ready for Phase 2: Run replace-with-2026-rosters.mjs
```

### Review Checklist

Before proceeding to Phase 2, review the JSON file:

- [ ] **Success rate**: Should be 80%+ (ideally 100%)
- [ ] **Total pitchers**: Should be 800-1000 (typical range)
- [ ] **No critical failures**: Check `failedTeams` in output
- [ ] **Data quality**: Spot-check a few teams in the JSON
- [ ] **Headshot URLs**: Verify URLs are valid (sample check)
- [ ] **Bio data completeness**: Check height, weight, year fields

### JSON Structure

```json
{
  "scrapedAt": "2026-02-25T11:48:35.413Z",
  "totalTeams": 64,
  "successfulTeams": 64,
  "failedTeams": 0,
  "totalPitchers": 928,
  "teams": [
    {
      "team_id": "148",
      "team_name": "Alabama",
      "url": "https://rolltide.com/sports/baseball/roster",
      "status": "success",
      "pitchers": [
        {
          "name": "Matthew Heiberger",
          "display_name": "Matthew Heiberger",
          "number": "7",
          "position": "LHP",
          "headshot": null,
          "height": "6' 3''",
          "weight": "215",
          "year": "Jr.",
          "hometown": "Birmingham, Ala. / Oak Mountain",
          "bats_throws": "L-L"
        }
      ]
    }
  ]
}
```

### When to Re-scrape

Re-run Phase 1 if:
- Success rate is below 80%
- Total pitchers seems too low (< 700)
- Many teams show "0 pitchers found"
- JSON file is corrupt or missing
- Website structures have changed

## Phase 2: Database Replacement

### IMPORTANT WARNINGS

**This phase permanently deletes data!**

- All records in `cbb_pitchers` will be deleted
- All records in `cbb_pitcher_game_participation` will be deleted
- Historical game statistics will be lost
- **This operation cannot be undone**

### Pre-Replacement Checklist

Before running Phase 2:

- [ ] **Phase 1 complete**: `2026-rosters.json` exists and validated
- [ ] **Database backup**: Export current pitcher data if needed
- [ ] **Confirmation ready**: Understand what will be deleted
- [ ] **Off-peak timing**: Run during low-traffic period
- [ ] **Service role key**: Verify you have write permissions

### Running the Replacement

Execute the Phase 2 script:

```bash
./replace-with-2026-rosters.mjs
```

Or with explicit node:
```bash
node replace-with-2026-rosters.mjs
```

### What Happens

1. Loads and validates `2026-rosters.json`
2. Queries current database statistics
3. Shows summary and **requires confirmation**
4. If confirmed:
   - Deletes all `cbb_pitcher_game_participation` records
   - Deletes all `cbb_pitchers` records
   - Inserts new pitchers in batches of 100
   - Shows final statistics

### Expected Output

```
📋 2026 ROSTER REPLACEMENT
============================================================

✅ Loaded 2026-rosters.json
   Scraped: 2/25/2026, 6:48:35 AM
   Total teams: 64
   Successful: 64
   Failed: 0
   Total pitchers: 928

📊 Current Database State:
   Current pitchers: 856
   Current participation records: 1234

⚠️  WARNING: This will DELETE all existing pitcher data!
   Will delete: 856 pitchers
   Will delete: 1234 participation records
   Will insert: 928 new pitchers

Type "yes" to continue:
```

### Confirmation Required

- Type exactly `yes` to proceed
- Any other input cancels the operation
- You have one chance to confirm
- Once started, the process cannot be interrupted safely

### Successful Completion

```
🚀 Starting replacement...

🗑️  Deleting old data...
   Deleting participation records...
   ✅ Participation records deleted
   Deleting pitchers...
   ✅ Pitchers deleted

📥 Inserting new rosters...
   Processed 10 teams, inserted 145 pitchers...
   Processed 20 teams, inserted 289 pitchers...
   ...
   ✅ Inserted 928 pitchers from 64 teams

📊 Final Database State:
   Current pitchers: 928
   Current participation records: 0

============================================================
✅ Replacement complete!
   Teams processed: 64
   Pitchers inserted: 928
   Database now has: 928 pitchers
```

## Data Validation

### After Phase 2 Completion

Verify the replacement was successful:

1. **Check pitcher count**:
   ```bash
   # Should match totalPitchers from JSON
   SELECT COUNT(*) FROM cbb_pitchers;
   ```

2. **Check team distribution**:
   ```bash
   # Each team should have 10-20 pitchers typically
   SELECT team_id, COUNT(*) as pitcher_count
   FROM cbb_pitchers
   GROUP BY team_id
   ORDER BY pitcher_count DESC;
   ```

3. **Verify bio data**:
   ```bash
   # Check for null values in key fields
   SELECT
     COUNT(*) as total,
     COUNT(headshot) as with_headshot,
     COUNT(height) as with_height,
     COUNT(year) as with_year
   FROM cbb_pitchers;
   ```

4. **Test frontend**:
   - Visit team roster pages
   - Verify pitchers display correctly
   - Check headshot images load
   - Confirm bio data shows properly

### Data Quality Metrics

Good scraping results should have:
- 90%+ teams with pitchers
- 12-18 pitchers per team average
- 70%+ headshot coverage
- 95%+ bio data completeness (height, weight, year)

## Troubleshooting

### Phase 1 Issues

#### Problem: "No teams found in database"
**Cause**: Database connection failed or `cbb_teams` table is empty
**Solution**:
- Check `.env.local` credentials
- Verify Supabase project is accessible
- Confirm `cbb_teams` table has data

#### Problem: Many teams fail to scrape
**Cause**: Website structure changes, timeout issues, or network problems
**Solution**:
- Check specific error messages in output
- Verify roster URLs are still valid
- Increase timeout in script if needed
- Run scraper during off-peak hours

#### Problem: "0 pitchers found" for multiple teams
**Cause**: Position filter not matching, HTML structure changed
**Solution**:
- Check roster page HTML manually
- Verify position labels (P, RHP, LHP)
- May need to update parsing logic

#### Problem: Playwright browser fails to launch
**Cause**: Chromium not installed or incompatible system
**Solution**:
```bash
npx playwright install chromium
```

### Phase 2 Issues

#### Problem: "2026-rosters.json not found"
**Cause**: Phase 1 was not run or JSON was deleted
**Solution**: Run Phase 1 first to generate the file

#### Problem: "Failed to delete participation records"
**Cause**: Database permissions insufficient
**Solution**: Ensure using service role key, not anon key

#### Problem: "Failed to insert pitchers"
**Cause**: Data validation errors, duplicate IDs, or constraint violations
**Solution**:
- Check error message for specific field
- Verify JSON data structure is valid
- Ensure no duplicate pitcher_ids

#### Problem: Partial insertion failure
**Cause**: Network interruption or database timeout during batch insert
**Solution**:
- Database may be in inconsistent state
- Manually check pitcher count
- May need to re-run entire Phase 2

## Error Handling

### Graceful Failures

Both scripts handle errors gracefully:

- **Network errors**: Retried automatically by browser
- **Parse errors**: Team marked as failed, scraping continues
- **Database errors**: Script exits with clear error message

### Logs and Debugging

Enable verbose logging by modifying scripts:

```javascript
// Add at top of script
process.env.DEBUG = 'playwright:api';
```

### Recovery Procedures

#### If Phase 1 fails mid-scrape:
- Safe to re-run, overwrites JSON file
- Previous partial results are discarded
- No database impact

#### If Phase 2 fails after deletion:
- **Critical**: Pitchers may be deleted but not re-inserted
- Check database state immediately
- Have backup ready to restore
- Re-run Phase 2 with same JSON file

#### If Phase 2 fails during insertion:
- Some pitchers may be inserted
- Re-running will fail due to duplicate IDs
- Must delete partial data first
- Then re-run Phase 2 clean

### Emergency Rollback

If Phase 2 completes but data is wrong:

1. **Immediate**: Do not run again without fresh JSON
2. **Check**: Query database to see current state
3. **Restore**: Use database backup if available
4. **Re-scrape**: Generate new JSON with corrected data
5. **Re-replace**: Run Phase 2 again with verified JSON

## Best Practices

1. **Always review Phase 1 results** before running Phase 2
2. **Run during low-traffic periods** to minimize user impact
3. **Keep JSON backups** of successful scrapes
4. **Document any manual fixes** needed for specific teams
5. **Test on staging environment** first if available
6. **Monitor application** after replacement for issues
7. **Have rollback plan** ready before starting Phase 2

## Support

For issues or questions:
- Check error messages in console output
- Review this guide's troubleshooting section
- Check Supabase dashboard for database state
- Verify Playwright documentation for browser issues

## Script Locations

- Phase 1: `/scrape-2026-rosters.mjs`
- Phase 2: `/replace-with-2026-rosters.mjs`
- Output: `/2026-rosters.json`
- This guide: `/docs/2026-roster-scraping-guide.md`
