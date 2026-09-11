#!/bin/bash
# Query the privacy-safe product dataset without mixing humans and automation.

set -eu

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/cloudflare-account.sh
source "$SCRIPT_DIR/cloudflare-account.sh"

REPORT_NAME="${1:-mau}"
WINDOW_DAYS="${PRODUCT_ANALYTICS_DAYS:-30}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN is required (Account Analytics: Read)." >&2
  exit 1
fi

if ! [[ "$WINDOW_DAYS" =~ ^[1-9][0-9]{0,2}$ ]] || [ "$WINDOW_DAYS" -gt 366 ]; then
  echo "PRODUCT_ANALYTICS_DAYS must be an integer from 1 to 366." >&2
  exit 1
fi

case "$REPORT_NAME" in
  mau)
    QUERY="SELECT blob6 AS actor_type, count(DISTINCT index1) AS active_actors
FROM researchtoolspy_product_metrics_v1
WHERE blob1 = 'product.metric.v1' AND blob2 = 'page_view'
  AND blob6 IN ('guest', 'authenticated')
  AND timestamp > NOW() - INTERVAL '$WINDOW_DAYS' DAY
GROUP BY actor_type ORDER BY actor_type FORMAT JSON"
    ;;
  features)
    QUERY="SELECT blob3 AS feature, blob2 AS event,
  count(DISTINCT index1) AS actors, sum(_sample_interval) AS events
FROM researchtoolspy_product_metrics_v1
WHERE blob1 = 'product.metric.v1'
  AND blob6 IN ('guest', 'authenticated')
  AND timestamp > NOW() - INTERVAL '$WINDOW_DAYS' DAY
GROUP BY feature, event ORDER BY actors DESC, feature, event FORMAT JSON"
    ;;
  outcomes)
    QUERY="SELECT blob3 AS feature, blob6 AS actor_type, blob7 AS outcome,
  sum(_sample_interval) AS requests,
  quantileExactWeighted(0.95)(double2, _sample_interval) AS p95_ms
FROM researchtoolspy_product_metrics_v1
WHERE blob1 = 'product.metric.v1' AND blob2 = 'api_request'
  AND timestamp > NOW() - INTERVAL '$WINDOW_DAYS' DAY
GROUP BY feature, actor_type, outcome ORDER BY requests DESC FORMAT JSON"
    ;;
  integrity)
    QUERY="SELECT blob6 AS actor_type, blob2 AS event,
  count(DISTINCT index1) AS actors, sum(_sample_interval) AS events
FROM researchtoolspy_product_metrics_v1
WHERE blob1 = 'product.metric.v1'
  AND timestamp > NOW() - INTERVAL '$WINDOW_DAYS' DAY
GROUP BY actor_type, event ORDER BY actor_type, event FORMAT JSON"
    ;;
  *)
    echo "Usage: $0 {mau|features|outcomes|integrity}" >&2
    exit 1
    ;;
esac

curl --fail --silent --show-error \
  -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H 'Content-Type: text/plain' \
  --data-binary "$QUERY"
echo
