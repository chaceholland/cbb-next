#!/bin/bash
# Automated ESPN Participation Data Scraper
# Runs the auto-scraper and logs results

cd "$(dirname "$0")"

# Configuration
DAYS_BACK=14
LOG_DIR="./scraper-logs"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Run the scraper
echo "[$TIMESTAMP] Starting auto-scraper..." >> "$LOG_DIR/scraper.log"

node auto-scrape-participation.mjs \
  --days $DAYS_BACK \
  --delay 300 \
  >> "$LOG_DIR/run-$TIMESTAMP.log" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$TIMESTAMP] Scraper completed successfully" >> "$LOG_DIR/scraper.log"
else
  echo "[$TIMESTAMP] Scraper failed with exit code $EXIT_CODE" >> "$LOG_DIR/scraper.log"
fi

# Keep only last 30 log files
cd "$LOG_DIR"
ls -t run-*.log | tail -n +31 | xargs -r rm

exit $EXIT_CODE
