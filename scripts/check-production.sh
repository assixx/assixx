#!/bin/bash
# =============================================================================
# Assixx Production Health Check Script
# =============================================================================
# Usage: ./scripts/check-production.sh
# =============================================================================

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Assixx Production Health Check                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to docker directory
cd "$(dirname "$0")/../docker"

echo "📦 Container Status"
echo "─────────────────────────────────────────────────────────────────"
docker-compose --profile production ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "🏥 Health Checks"
echo "─────────────────────────────────────────────────────────────────"

# Backend Health
BACKEND_HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null || echo '{"status":"error"}')
BACKEND_STATUS=$(echo $BACKEND_HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$BACKEND_STATUS" = "ok" ]; then
    echo -e "Backend (:3000):  ${GREEN}✓ OK${NC}"
else
    echo -e "Backend (:3000):  ${RED}✗ FAILED${NC}"
fi

# Frontend Health
FRONTEND_HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null || echo '{"status":"error"}')
FRONTEND_STATUS=$(echo $FRONTEND_HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$FRONTEND_STATUS" = "ok" ]; then
    echo -e "Frontend (:3001): ${GREEN}✓ OK${NC}"
else
    echo -e "Frontend (:3001): ${RED}✗ FAILED${NC}"
fi

# Nginx Health (via /health endpoint)
NGINX_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
if [ "$NGINX_CODE" = "200" ]; then
    echo -e "Nginx (:80):      ${GREEN}✓ OK${NC}"
else
    echo -e "Nginx (:80):      ${RED}✗ FAILED (HTTP $NGINX_CODE)${NC}"
fi

# Postgres Health
PG_READY=$(docker exec assixx-postgres pg_isready -U assixx_user -d assixx 2>/dev/null || echo "failed")
if [[ "$PG_READY" == *"accepting"* ]]; then
    echo -e "Postgres (:5432): ${GREEN}✓ OK${NC}"
else
    echo -e "Postgres (:5432): ${RED}✗ FAILED${NC}"
fi

# Redis Health
REDIS_PING=$(docker exec assixx-redis redis-cli ping 2>/dev/null || echo "failed")
if [ "$REDIS_PING" = "PONG" ]; then
    echo -e "Redis (:6379):    ${GREEN}✓ OK${NC}"
else
    echo -e "Redis (:6379):    ${RED}✗ FAILED${NC}"
fi

echo ""
echo "🌐 Production URLs"
echo "─────────────────────────────────────────────────────────────────"
echo "Landing Page:  http://localhost"
echo "Login:         http://localhost/login"
echo "API:           http://localhost/api/v2/"
echo "Health:        http://localhost/health"
echo ""

echo "🔧 Quick Commands"
echo "─────────────────────────────────────────────────────────────────"
echo "Logs (all):    docker-compose --profile production logs -f"
echo "Logs (nginx):  docker logs -f assixx-nginx"
echo "Logs (front):  docker logs -f assixx-frontend"
echo "Logs (back):   docker logs -f assixx-backend"
echo "Restart:       docker-compose --profile production restart"
echo ""
