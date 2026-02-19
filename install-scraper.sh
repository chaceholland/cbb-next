#!/bin/bash
# Installation script for automated ESPN scraper

set -e

echo "🔧 Installing Automated ESPN Scraper"
echo "═══════════════════════════════════════════════════════════"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Step 1: Create log directory
echo ""
echo "1️⃣  Creating log directory..."
mkdir -p "$SCRIPT_DIR/scraper-logs"
echo "✅ Created scraper-logs/"

# Step 2: Make scripts executable
echo ""
echo "2️⃣  Making scripts executable..."
chmod +x schedule-scraper.sh
chmod +x auto-scrape-participation.mjs
echo "✅ Scripts are now executable"

# Step 3: Test the scraper
echo ""
echo "3️⃣  Testing scraper (will check 3 games)..."
node auto-scrape-participation.mjs --days 7 --max 3 --quiet
TEST_EXIT=$?

if [ $TEST_EXIT -eq 0 ]; then
  echo "✅ Scraper test successful"
else
  echo "⚠️  Scraper test completed with warnings (this is normal if no data available yet)"
fi

# Step 4: Set up database tracking (requires manual SQL execution)
echo ""
echo "4️⃣  Database setup required..."
echo "⚠️  Manual step needed: Run the SQL migration"
echo ""
echo "   Option A - Using Supabase Dashboard:"
echo "   1. Go to: https://supabase.com/dashboard"
echo "   2. Select your project"
echo "   3. Go to SQL Editor"
echo "   4. Copy contents of: add-scrape-tracking.sql"
echo "   5. Run the SQL"
echo ""
echo "   Option B - Using psql (if you have database URL):"
echo "   psql \$DATABASE_URL < add-scrape-tracking.sql"
echo ""
read -p "Press Enter after you've run the SQL migration (or press Ctrl+C to skip)..."

# Step 5: Install LaunchAgent (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo ""
  echo "5️⃣  Installing LaunchAgent (macOS)..."

  PLIST_SRC="$SCRIPT_DIR/com.cbb.scraper.plist"
  PLIST_DST="$HOME/Library/LaunchAgents/com.cbb.scraper.plist"

  # Unload existing agent if present
  if [ -f "$PLIST_DST" ]; then
    echo "Unloading existing agent..."
    launchctl unload "$PLIST_DST" 2>/dev/null || true
  fi

  # Copy plist
  cp "$PLIST_SRC" "$PLIST_DST"
  echo "✅ Copied plist to ~/Library/LaunchAgents/"

  # Load the agent
  launchctl load "$PLIST_DST"
  echo "✅ LaunchAgent loaded"

  # Start immediately
  launchctl start com.cbb.scraper
  echo "✅ Scraper started"

  echo ""
  echo "📋 LaunchAgent Status:"
  launchctl list | grep cbb.scraper || echo "  (Agent is configured)"

else
  echo ""
  echo "5️⃣  Detected non-macOS system"
  echo "Setting up cron job instead..."

  # Check if cron job already exists
  if crontab -l 2>/dev/null | grep -q "schedule-scraper.sh"; then
    echo "⚠️  Cron job already exists"
  else
    # Add cron job
    (crontab -l 2>/dev/null; echo "0 */6 * * * $SCRIPT_DIR/schedule-scraper.sh") | crontab -
    echo "✅ Cron job added (runs every 6 hours)"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Installation complete!"
echo ""
echo "📊 What happens next:"
echo "  • Scraper runs every 6 hours automatically"
echo "  • Checks ESPN for pitcher participation data"
echo "  • Updates database when data is found"
echo "  • Logs results to: $SCRIPT_DIR/scraper-logs/"
echo ""
echo "🔍 Monitor progress:"
echo "  tail -f $SCRIPT_DIR/scraper-logs/scraper.log"
echo ""
echo "🛠  Manage the service:"
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "  launchctl start com.cbb.scraper    # Start now"
  echo "  launchctl stop com.cbb.scraper     # Stop"
  echo "  launchctl unload ~/Library/LaunchAgents/com.cbb.scraper.plist  # Disable"
else
  echo "  crontab -e                         # Edit schedule"
  echo "  crontab -l                         # View current jobs"
fi
echo ""
