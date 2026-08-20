#!/bin/zsh
# Drives the deployed /api/update endpoint repeatedly until the missing-
# participation backlog clears (each run processes ~16 games in its 250s budget).
# Started 2026-06-11 after SIDEARM Wave 3 deploy. Log: scripts/wave3-bulk-rerun.log
cd "$(dirname "$0")/.."
SECRET=$(grep '^CRON_FORCE_SECRET=' .env.backfill | cut -d= -f2- | tr -d '"')
LOG=scripts/wave3-bulk-rerun.log

for i in $(seq 1 90); do
  echo "=== run $i $(date '+%F %T') ===" >> "$LOG"
  RESP=$(curl -s --max-time 320 "https://cbb-next.vercel.app/api/update?force=$SECRET")
  SUMMARY=$(echo "$RESP" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin); r=d.get('results',{})
    print(f\"total={r.get('total')} ok={r.get('successful')} noData={r.get('noData')} deferred={r.get('deferredToBudget')} pitchers={r.get('totalPitchers')}\")
    # REMAINING = games punted to the next run by the time budget. Hits 0 when a
    # run clears its full selection. (The old formula subtracted skippedMaxAttempts,
    # a DISJOINT set from total, so it went negative and never reached 0.)
    print('REMAINING', r.get('deferredToBudget',0) or 0)
except Exception as e:
    print('non-json response (likely 504; work continued server-side)')
    print('REMAINING unknown')
")
  echo "$SUMMARY" >> "$LOG"
  REMAIN=$(echo "$SUMMARY" | awk '/^REMAINING/{print $2}')
  if [[ "$REMAIN" == "0" ]]; then
    echo "Backlog clear after run $i" >> "$LOG"
    break
  fi
  sleep 20
done
echo "DONE $(date '+%F %T')" >> "$LOG"
