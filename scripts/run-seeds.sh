#!/bin/bash
# =============================================================================
# Seed Data Runner
# =============================================================================
#
# Executes all SQL files in database/seeds/ against PostgreSQL.
# Seeds are idempotent (ON CONFLICT DO NOTHING) - safe to run multiple times.
#
# Usage:
#   doppler run -- ./scripts/run-seeds.sh
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SEEDS_DIR="${PROJECT_ROOT}/database/seeds"

# Use assixx_user (DB owner) for seeding
SEED_HOST="${DB_HOST:-localhost}"
SEED_PORT="${DB_PORT:-5432}"
SEED_DB="${POSTGRES_DB:-assixx}"
SEED_USER="${POSTGRES_USER:-assixx_user}"
SEED_PASS="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set (use: doppler run -- ./scripts/run-seeds.sh)}"

# When DB_HOST is a Docker-internal hostname (only resolvable inside the
# compose network), redirect to localhost so the host-side `psql` can reach
# the postgres container via its mapped port. Doppler dev-config injects
# `DB_HOST=assixx-postgres` (container_name); legacy compose stacks used
# the bare service name `postgres`.
case "${SEED_HOST}" in
  postgres|assixx-postgres)
    SEED_HOST="localhost"
    ;;
esac

echo "=== Assixx Seed Runner ==="
echo "Host: ${SEED_HOST}:${SEED_PORT}"
echo "Database: ${SEED_DB}"
echo "User: ${SEED_USER}"
echo "Seeds dir: ${SEEDS_DIR}"
echo "=========================="

if [ ! -d "${SEEDS_DIR}" ]; then
  echo "ERROR: Seeds directory not found: ${SEEDS_DIR}"
  exit 1
fi

SEED_FILES=$(find "${SEEDS_DIR}" -name '*.sql' -type f | sort)

if [ -z "${SEED_FILES}" ]; then
  echo "No seed files found in ${SEEDS_DIR}"
  exit 0
fi

export PGPASSWORD="${SEED_PASS}"

for seed_file in ${SEED_FILES}; do
  filename=$(basename "${seed_file}")
  echo "Applying seed: ${filename}..."
  psql -h "${SEED_HOST}" -p "${SEED_PORT}" -U "${SEED_USER}" -d "${SEED_DB}" \
    -f "${seed_file}" \
    --set ON_ERROR_STOP=1 \
    -q
  echo "  Done."
done

unset PGPASSWORD

echo "=== All seeds applied ==="
