# Design: 2026 College Baseball Roster Scraper

**Date:** 2026-02-25
**Status:** Approved
**Author:** Claude Code

## Overview

Replace all 2025 season pitcher data with fresh 2026 rosters by scraping team roster pages. This is a complete data replacement - all existing pitchers and their participation records will be deleted and replaced with current 2026 roster data.

## Requirements

### Functional
- Scrape all teams in `cbb_teams` table (~64 teams)
- Extract pitcher data only (positions: P, RHP, LHP)
- Delete all existing 2025 pitcher data
- Insert new 2026 pitcher records
- Handle failures gracefully (skip failed teams, continue processing)

### Non-Functional
- Two-phase approach for safety (scrape first, review, then replace)
- No backup of 2025 data (user confirmed not needed)
- Resilient to individual team failures
- Clear visibility into scraping results before deletion

## Architecture

### Two-Phase Design

**Phase 1: Scraping** (`scrape-2026-rosters.mjs`)
- Fetch all teams from database
- Visit each team's roster page with Playwright
- Extract pitcher data from roster tables
- Filter for pitchers only (P/RHP/LHP)
- Save results to `2026-rosters.json`
- Generate summary report

**Phase 2: Replacement** (`replace-with-2026-rosters.mjs`)
- Read `2026-rosters.json`
- Show summary and request confirmation
- Delete all `cbb_pitcher_participation` records
- Delete all `cbb_pitchers` records
- Insert new 2026 pitcher data
- Report completion statistics

### Why Separate Phases?

This allows reviewing scraped data before committing to deletion. If Phase 1 results look problematic (low success rate, parsing errors), we can adjust and re-run without touching the database.

## Data Structures

### JSON File Format

```json
{
  "scrapedAt": "2026-02-25T08:30:00.000Z",
  "totalTeams": 64,
  "successfulTeams": 58,
  "failedTeams": 6,
  "totalPitchers": 1247,
  "teams": [
    {
      "team_id": "78",
      "team_name": "Georgia",
      "url": "https://georgiadogs.com/sports/baseball/roster",
      "status": "success",
      "pitchers": [
        {
          "name": "John Smith",
          "display_name": "John Smith",
          "number": "23",
          "position": "RHP",
          "headshot": "https://...",
          "height": "6-2",
          "weight": "195",
          "year": "Jr.",
          "hometown": "Atlanta, Ga.",
          "bats_throws": "R/R"
        }
      ]
    },
    {
      "team_id": "86",
      "team_name": "Boston College",
      "url": "https://bceagles.com/sports/baseball/roster",
      "status": "failed",
      "error": "Timeout after 60s",
      "pitchers": []
    }
  ]
}
```

### Pitcher ID Generation

Format: `{team_id}-P{index}`

Examples: `78-P1`, `78-P2`, `78-P3`

- Simple and deterministic
- Team-scoped numbering
- Easy to understand and debug

### Missing Data Handling

Store `null` for fields not found during scraping rather than omitting them. This makes it clear the field was checked but not available on the roster page.

## Scraping Logic

### Roster Page Extraction

1. Navigate to roster URL with 60s timeout
2. Wait 3s for dynamic content to load
3. Find roster `<table>` elements
4. Parse each `<tr>` row in table body
5. Filter for pitcher positions only

### Field Extraction Strategy

**Name:**
- Primary: Look for `<a>` links containing `/roster/` or `/player/` in href
- Fallback: Text matching 2+ words, 5+ characters, not a number

**Number:**
- First cell matching `/^\d{1,2}$/`

**Position:**
- Cell matching `/^(P|RHP|LHP|C|1B|2B|3B|SS|OF|INF|UTIL)$/i`
- Only store if P, RHP, or LHP

**Headshot:**
- `<img>` src attribute in name cell
- Exclude images with "logo" or "team" in URL

**Bio Data:**
- Use `data-label` attributes when available (Height, Weight, Year, Hometown, B/T)
- Pattern matching fallbacks:
  - Height: `/\d+[-']\s*\d+/`
  - Weight: `/^\d{2,3}(lbs?)?$/i`
  - Year: `/^(Fr|So|Jr|Sr|Freshman|Sophomore|Junior|Senior)\./i`
  - Bats/Throws: `/^[LR][-\/][LR]$/i`
  - Hometown: Contains comma or slash, length > 10

### Pitcher Filtering

Only store players where `position` matches `/^(P|RHP|LHP)$/i`. All other positions (C, INF, OF, etc.) are ignored even if present on roster.

## Error Handling

### Per-Team Failures

When a team scrape fails:
1. Log error with team name, URL, and error message
2. Store in JSON with `status: "failed"` and error details
3. Continue to next team (don't abort process)
4. Include in failed teams summary

### Failure Types

- Navigation timeout (60s)
- HTTP 404 / server errors
- No table found on page
- Zero pitchers detected (could be parsing issue or actually no pitchers)
- Playwright crashes / JavaScript errors

### Validation Checks

**Phase 1:**
- At least 1 team must succeed (otherwise fundamental issue)
- Warn if success rate < 80% (suggests widespread parsing problems)
- Warn if any team has 0 pitchers found

**Phase 2:**
- Verify JSON file exists and is readable
- Confirm `totalPitchers > 0`
- Show explicit confirmation prompt
- Require user to type "yes" to proceed with deletion

## Database Operations

### Deletion Sequence

Must delete in this order due to foreign key constraints:

```sql
-- Step 1: Delete participation records (child table)
DELETE FROM cbb_pitcher_participation;

-- Step 2: Delete pitchers (parent table)
DELETE FROM cbb_pitchers;
```

### Insertion Strategy

- Generate pitcher IDs: `{team_id}-P{index}`
- Batch insert per team using Supabase `.insert(pitchersArray)`
- More efficient than individual inserts
- Process all teams sequentially

### Data Mapping

JSON → Database:
- `name` → `name`
- `display_name` → `display_name`
- `number` → `number`
- `position` → `position`
- `headshot` → `headshot`
- `height` → `height`
- `weight` → `weight`
- `year` → `year`
- `hometown` → `hometown`
- `bats_throws` → `bats_throws`
- `team_id` → `team_id`
- `pitcher_id` → generated

### Transaction Handling

No manual transaction wrapping:
- Supabase client auto-commits each operation
- If insertion fails partway, re-run Phase 2 (deletes everything first anyway)
- Separate phases provide natural rollback point

## Reporting

### Phase 1 Output

```
🏈 SCRAPING 2026 COLLEGE BASEBALL ROSTERS
========================================

Processing 64 teams...

✅ Alabama (12 pitchers)
✅ Arkansas (15 pitchers)
❌ Arizona State - Error: Timeout after 60s
✅ Auburn (14 pitchers)
...

========================================
📊 SCRAPING COMPLETE

Total Teams:     64
Successful:      58 (90.6%)
Failed:          6 (9.4%)
Total Pitchers:  1,247

Results saved to: 2026-rosters.json

⚠️  Failed teams:
  - Arizona State (Timeout)
  - Wake Forest (No table found)
  - Boston College (0 pitchers found)

✅ Ready for Phase 2: Run replace-with-2026-rosters.mjs
```

### Phase 2 Output

```
📋 2026 ROSTER REPLACEMENT SUMMARY
========================================

Source: 2026-rosters.json
Scraped: 2026-02-25 08:30 AM

Teams scraped:   58/64 successful
Total pitchers:  1,247

⚠️  WARNING: This will DELETE all existing pitcher data!

Current database:
  - Pitchers: ~1,100
  - Participation records: ~8,500

New data:
  - Pitchers: 1,247

Type 'yes' to proceed with replacement: _
```

After confirmation:

```
🗑️  Deleting old data...
  ✅ Deleted 8,500 participation records
  ✅ Deleted 1,100 pitchers

📥 Inserting 2026 rosters...
  ✅ Alabama (12 pitchers)
  ✅ Arkansas (15 pitchers)
  ...

========================================
✅ REPLACEMENT COMPLETE

Inserted: 1,247 pitchers across 58 teams
```

## Success Criteria

1. **Phase 1 succeeds** with >80% team success rate
2. **Phase 2 cleanly deletes** all old data without foreign key errors
3. **All scraped pitchers inserted** into database successfully
4. **Clear audit trail** via console output and JSON file

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Roster page structure changes | Robust parsing with multiple fallback strategies |
| Network timeouts | 60s timeout, skip and continue on failure |
| Accidental deletion of data | Two-phase approach with explicit confirmation |
| Incomplete scraping | Validation checks, summary reports, ability to re-run |
| Foreign key violations | Delete participation records before pitchers |

## Future Enhancements

Not in scope for initial implementation, but possible later:

- Add `season` field to support multi-season data
- Archive 2025 data before deletion
- Incremental updates (only changed teams)
- Parallel scraping for faster execution
- Email notification when scraping completes
