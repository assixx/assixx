#!/usr/bin/env bash
# =============================================================================
# Grafana Cloud Alert Rule Provisioning
# =============================================================================
#
# WHY: Single-source-of-truth fuer Alert-Rules (Git-tracked JSONs statt UI-Klicks).
# Idempotent — uses PUT with deterministic UIDs, safe to re-run.
#
# Usage:
#   doppler run -- ./docker/grafana/alerts/apply.sh
#
# Requires:
#   GRAFANA_CLOUD_ADMIN_TOKEN  — Service Account Token (Admin role) via Doppler
#   GRAFANA_URL                — optional, defaults to https://assixx.grafana.net
#
# @see docs/infrastructure/adr/ADR-002-alerting-monitoring.md
# =============================================================================

set -euo pipefail

GRAFANA_URL="${GRAFANA_URL:-https://assixx.grafana.net}"
TOKEN="${GRAFANA_CLOUD_ADMIN_TOKEN:?GRAFANA_CLOUD_ADMIN_TOKEN must be set - use doppler run}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

# Ensure folder exists (idempotent — 412 if already present, 200 on create)
echo "==> Ensuring folder 'assixx-prod-alerts' exists..."
curl -fsS -o /dev/null -w "  folder check: HTTP %{http_code}\n" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Assixx Production Alerts","uid":"assixx-prod-alerts"}' \
  "$GRAFANA_URL/api/folders" || true  # 409 = already exists, ignore

# Apply each rule via PUT (idempotent, requires UID in JSON)
applied=0
for f in "$SCRIPT_DIR"/*.json; do
  [ -e "$f" ] || continue
  uid=$(python3 -c "import json,sys; print(json.load(open('$f'))['uid'])")
  title=$(python3 -c "import json,sys; print(json.load(open('$f'))['title'])")

  echo "==> Applying: $title (uid=$uid)"

  # Try PUT (update). If 404, fall back to POST (create).
  status=$(curl -s -o /tmp/grafana-apply-resp.json -w "%{http_code}" \
    -X PUT \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Disable-Provenance: true" \
    -d "@$f" \
    "$GRAFANA_URL/api/v1/provisioning/alert-rules/$uid")

  if [ "$status" = "404" ]; then
    echo "  not found, creating via POST..."
    status=$(curl -s -o /tmp/grafana-apply-resp.json -w "%{http_code}" \
      -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -H "X-Disable-Provenance: true" \
      -d "@$f" \
      "$GRAFANA_URL/api/v1/provisioning/alert-rules")
  fi

  if [[ "$status" =~ ^2 ]]; then
    echo "  OK (HTTP $status)"
    applied=$((applied + 1))
  else
    echo "  FAILED (HTTP $status):"
    cat /tmp/grafana-apply-resp.json
    echo
    exit 1
  fi
done

rm -f /tmp/grafana-apply-resp.json
echo
echo "==> Done. $applied rule(s) applied to $GRAFANA_URL"
