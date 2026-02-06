#!/bin/bash

# Assixx Development Status Check
# Prüft Docker, API, Git, Code Quality

echo "🚀 Assixx Development Status Check"
echo "=================================="
echo ""

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Working Directory
cd /home/scs/projects/Assixx/docker

# 1. Docker Status
echo "1️⃣  Docker Status:"
if doppler run -- docker-compose ps 2>/dev/null | grep -q "Up"; then
    echo -e "   ${GREEN}✅ Docker Container laufen${NC}"
else
    echo -e "   ${RED}❌ Docker Container nicht gestartet${NC}"
    echo "   → Führe aus: docker-compose up -d"
fi
echo ""

# 2. API Health Check
echo "2️⃣  API Health Check:"
if curl -s http://localhost:3000/health | jq -e '.status == "ok"' > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ API ist erreichbar${NC}"
else
    echo -e "   ${RED}❌ API nicht erreichbar${NC}"
    echo "   → Prüfe Docker Logs: docker-compose logs backend"
fi
echo ""

# 3. Git Status
echo "3️⃣  Git Status:"
cd /home/scs/projects/Assixx
BRANCH=$(git branch --show-current)
echo "   📌 Branch: $BRANCH"
if git diff --quiet; then
    echo -e "   ${GREEN}✅ Keine uncommitted changes${NC}"
else
    echo -e "   ${YELLOW}⚠️  Uncommitted changes vorhanden${NC}"
fi
echo ""

# 4. Code Quality Check (Format, Lint, TypeScript)
echo "4️⃣  Code Quality Check:"
echo "   🔍 Führe vollständige Code-Prüfung aus..."

# Tracking für Fehler
HAS_ERRORS=false
ERROR_SUMMARY=""

# Format Check
echo -n "   📝 Format Check... "
if docker exec assixx-backend pnpm run format --check > /tmp/format-check.log 2>&1; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${YELLOW}⚠️  Format-Änderungen nötig${NC}"
    HAS_ERRORS=true
    ERROR_SUMMARY="${ERROR_SUMMARY}\n   - Format: Dateien müssen formatiert werden"
fi

# Lint Check
echo -n "   🔍 Lint Check... "
LINT_OUTPUT=$(docker exec assixx-backend pnpm run lint 2>&1)
if echo "$LINT_OUTPUT" | grep -q "0 errors"; then
    echo -e "${GREEN}✅${NC}"
elif echo "$LINT_OUTPUT" | grep -q "error"; then
    ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -oE "[0-9]+ error" | head -1)
    echo -e "${RED}❌ $ERROR_COUNT gefunden${NC}"
    HAS_ERRORS=true
    ERROR_SUMMARY="${ERROR_SUMMARY}\n   - Lint: $ERROR_COUNT gefunden"
else
    echo -e "${GREEN}✅${NC}"
fi

# TypeScript Check
echo -n "   🏗️  TypeScript Check... "
if docker exec assixx-backend pnpm run type-check > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌ TypeScript Fehler${NC}"
    HAS_ERRORS=true
    ERROR_SUMMARY="${ERROR_SUMMARY}\n   - TypeScript: Fehler gefunden"
fi

# Zusammenfassung Code Quality
if [ "$HAS_ERRORS" = true ]; then
    echo -e "\n   ${YELLOW}📋 Code Quality Probleme:${NC}"
    echo -e "$ERROR_SUMMARY"
    echo -e "\n   ${YELLOW}→ Führe aus: docker exec assixx-backend sh -c \"pnpm run format && pnpm run lint:fix && pnpm run type-check\"${NC}"
else
    echo -e "\n   ${GREEN}✅ Alle Code Quality Checks bestanden${NC}"
fi
echo ""

# 5. Test Status
echo "5️⃣  Test Status:"
echo "   📊 API Tests: pnpm run test:api (Vitest, 175 Tests)"
echo "   📊 CI: code-quality-checks.yml (Backend + Frontend)"
echo ""

# Zusammenfassung
echo "=================================="

# Prüfe ob System bereit ist
SYSTEM_READY=true
if ! curl -s http://localhost:3000/health | jq -e '.status == "ok"' > /dev/null 2>&1; then
    SYSTEM_READY=false
fi

if [ "$SYSTEM_READY" = true ] && [ "$HAS_ERRORS" = false ]; then
    echo -e "${GREEN}✅ System bereit für Entwicklung!${NC}"
elif [ "$SYSTEM_READY" = true ] && [ "$HAS_ERRORS" = true ]; then
    echo -e "${YELLOW}⚠️  System läuft, aber Code Quality Probleme gefunden${NC}"
else
    echo -e "${RED}❌ Bitte Probleme beheben bevor Sie starten${NC}"
fi
echo ""

