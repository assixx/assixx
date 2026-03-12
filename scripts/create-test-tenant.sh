#!/bin/bash
# =====================================================
# Create Test Tenant for Development
# =====================================================
#
# Erstellt den apitest-Tenant über die Signup API.
# Benutzt den offiziellen Signup-Flow — kein manuelles SQL.
#
# VORAUSSETZUNG: Backend muss laufen (http://localhost:3000/health)
#
# USAGE:
#   ./scripts/create-test-tenant.sh
#
# CREDENTIALS NACH ERSTELLUNG:
#   URL:      http://localhost:5173/login
#   Domain:   apitest
#   Email:    admin@apitest.de
#   Passwort: ApiTest12345!
#   Rolle:    Root (has_full_access = true)
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
echo "  Create Test Tenant (apitest)"
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

# 2. Prüfe ob apitest schon existiert
EXISTING=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c \
    "SELECT COUNT(*) FROM tenants WHERE subdomain = 'apitest';" 2>/dev/null | tr -d ' ')

if [ "${EXISTING}" -gt 0 ]; then
    log_warn "Tenant 'apitest' existiert bereits!"
    log_info "Zum Löschen: docker exec assixx-postgres psql -U assixx_user -d assixx -c \"DELETE FROM tenants WHERE subdomain = 'apitest' CASCADE;\""
    exit 0
fi

# 3. Signup API aufrufen
log_info "Erstelle Tenant über Signup API..."

# JSON in Temp-Datei (vermeidet Shell-Escaping-Probleme mit ! und Sonderzeichen)
TMPFILE=$(mktemp /tmp/signup-XXXXXX.json)
cat > "${TMPFILE}" << 'EOF'
{
  "companyName": "API Test GmbH",
  "subdomain": "apitest",
  "email": "info@apitest.de",
  "phone": "+49123456789",
  "street": "Musterstraße",
  "houseNumber": "42",
  "postalCode": "10115",
  "city": "Berlin",
  "countryCode": "DE",
  "adminEmail": "admin@apitest.de",
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
SELECT 'Tenant' as typ, t.id::text, t.company_name as info FROM tenants t WHERE t.subdomain = 'apitest'
UNION ALL
SELECT 'User', u.id::text, u.email || ' (' || u.role || ', full_access=' || u.has_full_access || ')' FROM users u
    JOIN tenants t ON u.tenant_id = t.id WHERE t.subdomain = 'apitest'
UNION ALL
SELECT 'Addons', COUNT(*)::text, 'aktiviert' FROM tenant_addons ta
    JOIN tenants t ON ta.tenant_id = t.id WHERE t.subdomain = 'apitest' AND ta.is_active = 1;
"

echo ""
echo "=========================================="
echo "  CREDENTIALS"
echo "=========================================="
echo ""
echo "  URL:      http://localhost:5173/login"
echo "  Domain:   apitest"
echo "  Email:    admin@apitest.de"
echo "  Passwort: ApiTest12345!"
echo "  Rolle:    Root"
echo ""
log_info "Fertig!"
