#!/usr/bin/env bash
# Non-destructive production smoke check: backend health only.
# Does not log in, mutate data, or require secrets.
set -euo pipefail

BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-https://fitgpt-backend-tdiq.onrender.com/health}"
FRONTEND_URL="${FRONTEND_URL:-https://www.fitgpt.tech}"
DOWNLOAD_URL="${DOWNLOAD_URL:-https://www.fitgpt.tech/download}"

echo "FitGPT production smoke check"
echo "============================="
echo ""

echo -n "Backend health (${BACKEND_HEALTH_URL}) ... "
code=$(curl -sS -o /tmp/fitgpt_health_body.txt -w "%{http_code}" --max-time 25 "$BACKEND_HEALTH_URL" || echo "000")
if [[ "$code" != "200" ]]; then
  echo "FAIL (HTTP $code)"
  cat /tmp/fitgpt_health_body.txt 2>/dev/null || true
  rm -f /tmp/fitgpt_health_body.txt
  echo ""
  echo "Fix backend or networking before the demo."
  exit 1
fi
echo "OK (HTTP 200)"
rm -f /tmp/fitgpt_health_body.txt

echo ""
echo "Manual checks (open in a browser):"
echo "  - Web app:     ${FRONTEND_URL}"
echo "  - Download:    ${DOWNLOAD_URL}"
echo ""
echo "Suggested next steps:"
echo "  - Log in, load wardrobe, add one item, refresh, confirm it persists."
echo "  - Generate recommendations; open AURA (or confirm graceful fallback)."
echo "  - On Android: install from /download; on iPhone Safari: confirm layout."
echo ""
