#!/bin/bash
# Render Keep-Alive Script (local/manual fallback)
#
# The primary keep-alive is an external cron service (cron-job.org) hitting
# /api/ping every 5 minutes; GitHub Actions is the secondary. This script only
# matters if you want a third source from a machine that is genuinely on 24/7.
#
# Usage:   ./keep-alive.sh
# Crontab: */5 * * * * /path/to/keep-alive.sh
# Override URL/log:  PING_URL=... LOG_FILE=... ./keep-alive.sh

set -uo pipefail

PING_URL="${PING_URL:-https://comp-dash.onrender.com/api/ping}"
LOG_FILE="${LOG_FILE:-$HOME/.render-keep-alive.log}"

# --max-time 120: a cold start takes ~60s; do not call that a failure.
# No -f, so we can read the real status code instead of curl bailing early.
response=$(curl -sS -o /dev/null -w "%{http_code}" \
             --max-time 120 \
             --retry 3 --retry-delay 15 --retry-all-errors \
             "$PING_URL" 2>/dev/null)
timestamp=$(date '+%Y-%m-%d %H:%M:%S')

case "$response" in
  200) echo "[$timestamp] OK - keep-alive ping (HTTP $response)" >> "$LOG_FILE" ;;
  503) echo "[$timestamp] SUSPENDED - service is suspended/unavailable (HTTP $response)" >> "$LOG_FILE" ;;
  *)   echo "[$timestamp] FAIL - keep-alive ping failed (HTTP ${response:-no-response})" >> "$LOG_FILE" ;;
esac
