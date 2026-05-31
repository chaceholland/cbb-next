#!/bin/bash
# Monitor CBB scraper LaunchAgent health

LOGS_DIR="/Users/chace/Desktop/cbb-next/scraper-logs"
TIMEOUT_HOURS=7  # Alert if no run in this many hours

# Get the most recent log
LATEST=$(ls -t "$LOGS_DIR"/scrape-log-2026-05-31*.json 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
  echo "❌ No recent scraper logs found!"
  exit 1
fi

echo "📊 Latest scraper run:"
echo "  File: $(basename "$LATEST")"
echo "  Size: $(wc -c < "$LATEST" | numfmt --to=iec-i --suffix=B) bytes"

# Extract timestamp from filename
TIMESTAMP=$(basename "$LATEST" | sed 's/scrape-log-\(.*\)Z.json/\1/')
echo "  Timestamp: $TIMESTAMP"

# Show stats from the log
TOTAL=$(jq '.espn.total' "$LATEST" 2>/dev/null || echo "?")
SUCCESS=$(jq '.espn.successful' "$LATEST" 2>/dev/null || echo "?")
NODATA=$(jq '.espn.noData' "$LATEST" 2>/dev/null || echo "?")
ERRORS=$(jq '.espn.errors' "$LATEST" 2>/dev/null || echo "?")

echo ""
echo "  Results:"
echo "    Total games: $TOTAL"
echo "    Successful: $SUCCESS"
echo "    No data yet: $NODATA"
echo "    Errors: $ERRORS"

# Check for debug info
DEBUG=$(jq '._debug | length' "$LATEST" 2>/dev/null || echo "0")
if [ "$DEBUG" -gt 0 ]; then
  echo "  Debug info: ✅ Present ($DEBUG entries)"
fi

# Check for D1 fallback results
D1=$(jq '.d1.total' "$LATEST" 2>/dev/null || echo "0")
if [ "$D1" != "0" ]; then
  echo "  D1Baseball fallback: $D1 games"
fi

# Check for NCAA fallback results
NCAA=$(jq '.ncaa.total' "$LATEST" 2>/dev/null || echo "0")
if [ "$NCAA" != "0" ]; then
  echo "  NCAA fallback: $NCAA games"
fi
