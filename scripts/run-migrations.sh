#!/bin/bash
# =============================================================================
# Migration Runner Wrapper
# =============================================================================
#
# Constructs DATABASE_URL from Doppler-injected environment variables.
# Migrations run as assixx_user (DB owner with DDL permissions).
# app_user is RLS-restricted and CANNOT create tables/indexes/policies.
#
# Usage:
#   doppler run -- ./scripts/run-migrations.sh up
#   doppler run -- ./scripts/run-migrations.sh down
#   doppler run -- ./scripts/run-migrations.sh create my-migration-name
#   doppler run -- ./scripts/run-migrations.sh up --fake
#   doppler run -- ./scripts/run-migrations.sh up --dry-run
#
# =============================================================================

set -euo pipefail

# Migrations use assixx_user (DB owner) - NOT app_user (RLS-restricted)
MIGRATE_HOST="${DB_HOST:-localhost}"
MIGRATE_PORT="${DB_PORT:-5432}"
MIGRATE_DB="${POSTGRES_DB:-assixx}"
MIGRATE_USER="${POSTGRES_USER:-assixx_user}"
MIGRATE_PASS="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set (use: doppler run -- ./scripts/run-migrations.sh)}"

# When DB_HOST is "postgres" (Docker internal), redirect to localhost
# because migrations run from the host, not inside a container
if [ "${MIGRATE_HOST}" = "postgres" ]; then
  MIGRATE_HOST="localhost"
fi

export DATABASE_URL="postgresql://${MIGRATE_USER}:${MIGRATE_PASS}@${MIGRATE_HOST}:${MIGRATE_PORT}/${MIGRATE_DB}"

echo "=== Assixx Migration Runner ==="
echo "Host: ${MIGRATE_HOST}:${MIGRATE_PORT}"
echo "Database: ${MIGRATE_DB}"
echo "User: ${MIGRATE_USER}"
echo "Command: node-pg-migrate $*"
echo "==============================="

pnpm run db:migrate "$@"
