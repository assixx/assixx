#!/usr/bin/env bash
# =============================================================================
# Assixx Load-Baseline Runner — One-Command Wrapper
# =============================================================================
#
# Was es macht:
#   1. Pre-flight: Postgres + Backend healthy?
#   2. Redis-FLUSHDB (Throttle-Reset, ADR-001)
#   3. k6-Baseline-Run (PROFILE=light default, full via env)
#   4. Auto-Cleanup von LOAD-* blackboard_entries (auch bei Failure via trap)
#   5. Auto-Bootstrap: wenn load/baselines/baseline-light.json fehlt,
#      Snapshot anlegen und User auf manuellen git-commit hinweisen
#
# Was es NICHT macht (bewusst, siehe CLAUDE.md):
#   - git add / git commit  — das ist Hand-Aktion
#   - Snapshot überschreiben — sobald baseline-light.json existiert,
#     wird sie nicht mehr automatisch aktualisiert (sonst silent perf-rot)
#
# Env-Overrides (optional):
#   PROFILE=full        # 8-min Capacity-Test, braucht LOGINS pool ≥5
#   WS=1                # +WebSocket-Soak
#   WS_URL=…            # default: ws://localhost:3000/chat-ws
#   LOGINS='[…]'        # JSON-Pool für Multi-Tenant
#   BOOTSTRAP=1         # erzwingt Snapshot-Update auch wenn vorhanden
#
# Usage:
#   ./scripts/run-load-baseline.sh
#   pnpm run test:load:baseline
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

# Farb-Helper (TTY-aware → keine Escapes in CI-Logs).
if [ -t 1 ]; then
  C_BOLD='\033[1m'; C_GREEN='\033[32m'; C_YELLOW='\033[33m'; C_RED='\033[31m'; C_RESET='\033[0m'
else
  C_BOLD=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_RESET=''
fi

step()  { printf "${C_BOLD}→ %s${C_RESET}\n" "$1"; }
ok()    { printf "${C_GREEN}✓ %s${C_RESET}\n" "$1"; }
warn()  { printf "${C_YELLOW}⚠ %s${C_RESET}\n" "$1"; }
fatal() { printf "${C_RED}✗ %s${C_RESET}\n" "$1" >&2; exit 1; }

# =============================================================================
# Cleanup-Trap: läuft IMMER (Pass, Fail, Strg-C, Threshold-Violation).
# Räumt LOAD-*-Blackboard-Entries auf. Wenn Postgres down ist, einfach
# überspringen — der nächste Run mit funktionierender DB cleanups das mit.
# =============================================================================
cleanup() {
  local rc=$?
  if docker exec assixx-postgres pg_isready -U assixx_user -d assixx >/dev/null 2>&1; then
    step "Cleanup: Lösche LOAD-* Blackboard-Entries"
    local deleted
    deleted=$(docker exec assixx-postgres psql -U assixx_user -d assixx -tAc \
      "DELETE FROM blackboard_entries WHERE title LIKE 'LOAD-%' RETURNING id;" 2>/dev/null | wc -l)
    ok "  → ${deleted} Einträge entfernt"
  else
    warn "  → Postgres unreachable, Cleanup übersprungen (next run räumt nach)"
  fi
  exit "$rc"
}
trap cleanup EXIT

# =============================================================================
# Pre-flight (failt früh mit klarer Botschaft statt mitten im Run)
# =============================================================================
step "Pre-flight: Container-Health"

docker exec assixx-postgres pg_isready -U assixx_user -d assixx >/dev/null 2>&1 \
  || fatal "Postgres unreachable. Fix: cd docker && doppler run -- docker-compose up -d"

curl -sf http://localhost:3000/health >/dev/null \
  || fatal "Backend :3000 unreachable. Fix: cd docker && doppler run -- docker-compose up -d"

docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning PING >/dev/null 2>&1 \
  || fatal "Redis unreachable. Fix: cd docker && doppler run -- docker-compose up -d"

ok "Postgres + Backend + Redis erreichbar"

# =============================================================================
# Throttle-Reset (ADR-001 — sonst startet baseline mit pre-existierendem
# Throttle-Counter aus vorherigen Tests und 429't früher als erwartet).
# =============================================================================
step "Throttle-Reset (Redis FLUSHDB)"
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB >/dev/null
ok "Redis throttle-keys geleert"

# =============================================================================
# k6 Baseline-Run
# =============================================================================
mkdir -p load/results
PROFILE_LABEL="${PROFILE:-light}"
WS_LABEL=$([ "${WS:-0}" = "1" ] && echo on || echo off)
step "k6 Baseline starten (profile=${PROFILE_LABEL}, ws=${WS_LABEL})"

# --user "$(id -u):$(id -g)" — k6-Image läuft per Default als UID 12345
# (User `k6`). Ohne user-mapping schlägt --summary-export mit "permission
# denied" fehl, weil das gemountete load/results Host-Owner gehört. Mit
# Mapping schreibt der Container unter Host-UID → Files gehören dir, kein
# chown nötig. Fastpath-Fix für das Mount-Permission-Problem.
docker run --rm --network=host \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/load:/scripts" \
  -e PROFILE -e WS -e WS_URL -e LOGINS \
  grafana/k6:latest run \
  --summary-export=/scripts/results/baseline-latest.json \
  /scripts/tests/baseline.ts

ok "k6 Run beendet (Thresholds passed)"

# =============================================================================
# Snapshot-Bootstrap
#
# Erste Ausführung (oder explicit BOOTSTRAP=1) → Snapshot anlegen.
# Sonst: Datei stehen lassen, User soll explizit pflegen.
# =============================================================================
SNAPSHOT="load/baselines/baseline-${PROFILE_LABEL}.json"
mkdir -p load/baselines

if [ ! -f "$SNAPSHOT" ] || [ "${BOOTSTRAP:-0}" = "1" ]; then
  cp load/results/baseline-latest.json "$SNAPSHOT"
  ok "Snapshot geschrieben: $SNAPSHOT"
  echo ""
  warn "MANUELLE AKTION ERFORDERLICH:"
  echo "    git add $SNAPSHOT"
  echo "    git commit -m \"perf: bootstrap baseline-${PROFILE_LABEL} snapshot\""
  echo ""
  echo "  Ab dann läuft 'pnpm run test:load:diff' gegen diesen Snapshot."
else
  ok "Snapshot existiert: $SNAPSHOT (kein Auto-Update — siehe BOOTSTRAP=1)"
  echo ""
  step "Diff gegen Snapshot:"
  if pnpm exec tsx scripts/load-diff.ts \
    --baseline="$SNAPSHOT" \
    --current="load/results/baseline-latest.json"; then
    ok "Keine Regression"
  else
    fatal "Regression detected (siehe Diff oben)"
  fi
fi
