#!/bin/bash
# =====================================================
# Sync Customer Migrations Script
# Aktualisiert customer/fresh-install/ aus aktueller DB
# =====================================================
#
# VERWENDUNG: Nach jeder Migration ausführen!
#   ./scripts/sync-customer-migrations.sh
#
# =====================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Config
CONTAINER="assixx-postgres"
DB_USER="assixx_user"
DB_NAME="assixx"
PROJECT_ROOT="/home/scs/projects/Assixx"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    log_error "Container '${CONTAINER}' nicht running!"
    exit 1
fi

log_info "Synchronisiere Customer Migrations..."

# 1. Schema dumpen
log_info "Dumpe Schema..."
docker exec ${CONTAINER} pg_dump -U ${DB_USER} -d ${DB_NAME} \
    --schema-only --no-owner --no-privileges --quote-all-identifiers \
    -f /tmp/schema.sql

docker cp ${CONTAINER}:/tmp/schema.sql ${PROJECT_ROOT}/database/migrations/001_baseline_complete_schema.sql

# 2. Seed-Data dumpen
log_info "Dumpe Seed-Data..."
docker exec ${CONTAINER} pg_dump -U ${DB_USER} -d ${DB_NAME} \
    --data-only --inserts --no-owner --no-privileges \
    -t plans -t features -t plan_features -t kvp_categories -t machine_categories \
    -f /tmp/seed.sql

docker cp ${CONTAINER}:/tmp/seed.sql ${PROJECT_ROOT}/database/migrations/002_seed_data.sql

# 3. Customer aktualisieren
log_info "Aktualisiere Customer Fresh-Install..."
mkdir -p ${PROJECT_ROOT}/customer/fresh-install

cp ${PROJECT_ROOT}/database/migrations/001_baseline_complete_schema.sql \
   ${PROJECT_ROOT}/customer/fresh-install/001_schema.sql

cp ${PROJECT_ROOT}/database/migrations/002_seed_data.sql \
   ${PROJECT_ROOT}/customer/fresh-install/002_seed_data.sql

# 4. Verifizieren
log_info "Verifiziere..."
DIFF1=$(diff ${PROJECT_ROOT}/database/migrations/001_baseline_complete_schema.sql \
             ${PROJECT_ROOT}/customer/fresh-install/001_schema.sql && echo "OK" || echo "DIFF")
DIFF2=$(diff ${PROJECT_ROOT}/database/migrations/002_seed_data.sql \
             ${PROJECT_ROOT}/customer/fresh-install/002_seed_data.sql && echo "OK" || echo "DIFF")

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           SYNC COMPLETE                                   ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  001_schema.sql:     migrations ↔ customer  ${DIFF1}     ║"
echo "║  002_seed_data.sql:  migrations ↔ customer  ${DIFF2}     ║"
echo "╚═══════════════════════════════════════════════════════════╝"

if [ "$DIFF1" = "OK" ] && [ "$DIFF2" = "OK" ]; then
    log_info "✅ Alle Dateien synchronisiert!"
else
    log_error "❌ Synchronisation fehlgeschlagen!"
    exit 1
fi
