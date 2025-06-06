#!/bin/bash

# Assixx Development Status Check
# Führt alle wichtigen Checks in einem Script aus

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
if docker-compose ps 2>/dev/null | grep -q "Up"; then
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

# 4. TypeScript Status (nur Info)
echo "4️⃣  TypeScript Status:"
echo -e "   ${YELLOW}ℹ️  56 Test-Fehler bekannt (werden ignoriert für v0.1.0)${NC}"
echo ""

# 5. Aktuelle Phase
echo "5️⃣  Aktuelle Phase:"
echo "   🎯 Version 0.1.0 - Systematisches Testing & Debugging"
echo "   👤 Verantwortlich: Simon"
echo "   📊 Fortschritt: 0/12 Bereiche getestet"
echo ""

# Zusammenfassung
echo "=================================="
if curl -s http://localhost:3000/health | jq -e '.status == "ok"' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ System bereit für Entwicklung!${NC}"
else
    echo -e "${RED}❌ Bitte Probleme beheben bevor Sie starten${NC}"
fi
echo ""