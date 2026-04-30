#!/bin/bash
# =====================================================
# Create Test Tenant for Development (Signup-API path)
# =====================================================
#
# Erstellt den `assixx`-Test-Tenant über `POST /api/v2/signup`.
# Smoke-Test des live Signup-Flows — kein manuelles SQL.
#
# === ALTERNATIVE (bevorzugt für Dev-Setup): ===
#
#   doppler run -- pnpm run db:seed
#
# Der Seed (`database/seeds/002_test-tenants-dev-only.sql`) legt 5 Dev-Tenants
# atomar an (assixx + firma-a + firma-b + scs + unverified-e2e), mit fixed IDs
# 1-5 (API-Tests verlassen sich darauf), `is_active=1` und verifizierten
# Domains. Voraussetzung: leere `tenants`-Tabelle (TRUNCATE oder DROP SCHEMA).
# Siehe docs/how-to/HOW-TO-CREATE-TEST-USER.md.
#
# === WANN DIESES SCRIPT VERWENDEN: ===
#
#   - Smoke-Test der Signup-API nach Backend-Refactor
#   - Frontend-Dev ohne Cross-Tenant-Tests (firma-a/b nicht nötig)
#   - Nach `db:seed` REDUNDANT — Script erkennt existierenden Tenant + exited
#
# WHY assixx (statt apitest): Migration 2026-04 weg von `apitest`/`apitest.de`
# (fremde reale Domain → Catch-All-Risiko bei Password-Reset/Notification-Mails).
# `assixx.com` ist projekt-eigene Domain.
#
# VORAUSSETZUNG: Backend muss laufen (http://localhost:3000/health)
#
# USAGE:
#   ./scripts/create-test-tenant.sh
#
# CREDENTIALS NACH ERSTELLUNG:
#   URL:      http://localhost:5173/login
#   Domain:   assixx
#   Email:    info@assixx.com
#   Passwort: ApiTest12345!
#   Rolle:    Root (has_full_access = true)
#
# KNOWN QUIRK (feat/add-2FA, 2026-04-30): Signup legt User mit is_active=0 an,
# 2FA-Verifikations-Mail erreicht Mailpit pending nicht zuverlässig. Quick-Fix:
#   docker exec assixx-postgres psql -U assixx_user -d assixx \
#     -c "UPDATE users SET is_active = 1 WHERE email = 'info@assixx.com';"
# `pnpm run db:seed` umgeht dies komplett (setzt is_active=1 direkt).
#
# =====================================================

set -e

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="http://localhost:3000/api/v2/signup"
HEALTH_URL="http://localhost:3000/health"
CONTAINER="assixx-postgres"
DB_USER="assixx_user"
DB_NAME="assixx"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Health Check
echo ""
echo "=========================================="
echo "  Create Test Tenant (assixx)"
echo "=========================================="
echo ""

log_info "Prüfe Backend..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || echo "000")
if [ "${HEALTH}" != "200" ]; then
    log_error "Backend nicht erreichbar (HTTP ${HEALTH})"
    log_info "Starte Docker: cd docker && doppler run -- docker-compose up -d"
    exit 1
fi
log_info "Backend läuft ✓"

# 2. Prüfe ob assixx-Test-Tenant schon existiert
EXISTING=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c \
    "SELECT COUNT(*) FROM tenants WHERE subdomain = 'assixx';" 2>/dev/null | tr -d ' ')

if [ "${EXISTING}" -gt 0 ]; then
    log_warn "Tenant 'assixx' existiert bereits!"
    log_info "Zum Löschen: docker exec assixx-postgres psql -U assixx_user -d assixx -c \"DELETE FROM tenants WHERE subdomain = 'assixx' CASCADE;\""
    exit 0
fi

# 3. Signup API aufrufen
log_info "Erstelle Tenant über Signup API..."

# JSON in Temp-Datei (vermeidet Shell-Escaping-Probleme mit ! und Sonderzeichen)
TMPFILE=$(mktemp /tmp/signup-XXXXXX.json)
cat > "${TMPFILE}" << 'EOF'
{
  "companyName": "Assixx Test GmbH",
  "subdomain": "assixx",
  "email": "info@assixx.com",
  "phone": "+49123456789",
  "street": "Musterstraße",
  "houseNumber": "42",
  "postalCode": "10115",
  "city": "Berlin",
  "countryCode": "DE",
  "adminEmail": "info@assixx.com",
  "adminPassword": "ApiTest12345!",
  "adminFirstName": "Admin",
  "adminLastName": "Test"
}
EOF

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}" \
    -H 'Content-Type: application/json' \
    -d @"${TMPFILE}")

rm -f "${TMPFILE}"

HTTP_CODE=$(echo "${RESPONSE}" | tail -1)
BODY=$(echo "${RESPONSE}" | head -n -1)

if [ "${HTTP_CODE}" -ge 200 ] && [ "${HTTP_CODE}" -lt 300 ]; then
    log_info "Tenant erstellt ✓"
else
    log_error "Signup fehlgeschlagen (HTTP ${HTTP_CODE})"
    echo "${BODY}" | jq '.' 2>/dev/null || echo "${BODY}"
    exit 1
fi

# 4. Verifizierung
log_info "Verifiziere..."
docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "
SELECT 'Tenant' as typ, t.id::text, t.company_name as info FROM tenants t WHERE t.subdomain = 'assixx'
UNION ALL
SELECT 'User', u.id::text, u.email || ' (' || u.role || ', full_access=' || u.has_full_access || ')' FROM users u
    JOIN tenants t ON u.tenant_id = t.id WHERE t.subdomain = 'assixx'
UNION ALL
SELECT 'Addons', COUNT(*)::text, 'aktiviert' FROM tenant_addons ta
    JOIN tenants t ON ta.tenant_id = t.id WHERE t.subdomain = 'assixx' AND ta.is_active = 1;
"

echo ""
echo "=========================================="
echo "  CREDENTIALS"
echo "=========================================="
echo ""
echo "  URL:      http://localhost:5173/login"
echo "  Domain:   assixx"
echo "  Email:    info@assixx.com"
echo "  Passwort: ApiTest12345!"
echo "  Rolle:    Root"
echo ""
log_info "Fertig!"
