#!/bin/bash

# Assixx Local Test Runner
# Führt alle Tests mit echter lokaler Datenbank aus

echo "🧪 Assixx Local Test Runner"
echo "=================================="
echo ""

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Working Directory
cd /home/scs/projects/Assixx

# 1. Docker & DB Status prüfen
echo "1️⃣  Prüfe Docker & Datenbank Status:"
if docker exec assixx-mysql mysql -u assixx_user -pAssixxP@ss2025! main -e "SELECT 1" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ MySQL Datenbank erreichbar${NC}"
else
    echo -e "   ${RED}❌ MySQL Datenbank nicht erreichbar${NC}"
    echo "   → Starte Docker: cd docker && docker-compose up -d"
    exit 1
fi

if docker exec assixx-backend echo "OK" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Backend Container läuft${NC}"
else
    echo -e "   ${RED}❌ Backend Container läuft nicht${NC}"
    echo "   → Starte Docker: cd docker && docker-compose up -d"
    exit 1
fi
echo ""

# 2. Wichtiger Hinweis
echo "2️⃣  Datenbank-Konfiguration:"
echo -e "   ${BLUE}ℹ️  Tests nutzen die HAUPT-Datenbank 'main' (nicht 'main_test')${NC}"
echo -e "   ${YELLOW}⚠️  Alle Test-Daten werden nach jedem Test gelöscht${NC}"
echo ""

# 3. Test Kategorien definieren
echo "3️⃣  Test Kategorien:"
echo ""

# Unit Tests (keine DB benötigt)
echo -e "   ${BLUE}📦 Unit Tests (keine DB):${NC}"
UNIT_TESTS=(
    "errorHandler.test.ts"
    "health.test.ts"
)

# Alle Tests die DB brauchen (laufen NUR lokal)
echo -e "   ${BLUE}🔄 Alle Tests mit Datenbank (NUR LOKAL):${NC}"
DB_TESTS=(
    "auth.test.ts"
    "auth-refactored.test.ts"
    "users.test.ts"
    "teams.test.ts"
    "departments.test.ts"
    "shifts.test.ts"
    "calendar.test.ts"
    "chat.test.ts"
    "notifications.test.ts"
    "surveys.test.ts"
    "kvp.test.ts"
    "signup.test.ts"
    "blackboard.integration.test.ts"
    "tenantDeletion.integration.test.ts"
    "blackboard.test.ts"
    "tenantDeletion.service.test.ts"
    "documents.test.ts"
)

# Problematische Tests (aktuell fehlerhaft)
echo -e "   ${YELLOW}⚠️  Problematische Tests:${NC}"
PROBLEMATIC_TESTS=(
    "documents.test.ts"
)

echo ""

# 4. Test Optionen
echo "4️⃣  Test Optionen:"
echo "   [1] Alle DB-Tests ausführen (empfohlen)"
echo "   [2] Nur Unit Tests (läuft auch auf GitHub)"
echo "   [3] Einzelnen Test ausführen"
echo "   [4] Tests mit Coverage"
echo ""

read -p "   Wähle Option (1-4): " OPTION

case $OPTION in
    1)
        echo -e "\n${BLUE}▶️  Führe alle DB-Tests aus...${NC}\n"
        echo -e "${YELLOW}Nutze Hauptdatenbank 'main' für Tests${NC}\n"
        for test in "${DB_TESTS[@]}"; do
            echo -e "${BLUE}Testing: $test${NC}"
            docker exec -w /app/backend -e DB_NAME=main -e NODE_ENV=production assixx-backend pnpm test "$test" || echo -e "${RED}❌ Test failed: $test${NC}"
        done
        ;;
    2)
        echo -e "\n${BLUE}▶️  Führe Unit Tests aus (keine DB)...${NC}\n"
        for test in "${UNIT_TESTS[@]}"; do
            echo -e "${BLUE}Testing: $test${NC}"
            docker exec -w /app/backend assixx-backend pnpm test "$test"
        done
        ;;
    3)
        echo ""
        read -p "   Test-Datei eingeben (z.B. auth.test.ts): " TEST_FILE
        echo -e "\n${BLUE}▶️  Führe $TEST_FILE aus...${NC}\n"
        docker exec -w /app/backend -e DB_NAME=main -e NODE_ENV=production assixx-backend pnpm test "$TEST_FILE"
        ;;
    4)
        echo -e "\n${BLUE}▶️  Führe Tests mit Coverage aus...${NC}\n"
        docker exec -w /app/backend -e DB_NAME=main -e NODE_ENV=production assixx-backend pnpm test --coverage
        ;;
    *)
        echo -e "${RED}Ungültige Option${NC}"
        exit 1
        ;;
esac

echo ""
echo "=================================="
echo -e "${GREEN}✅ Test-Lauf abgeschlossen${NC}"

# 5. Zeige Test-Zusammenfassung
echo ""
echo "📊 Test-Zusammenfassung:"
echo "   - Unit Tests (GitHub): ${#UNIT_TESTS[@]} Tests"
echo "   - DB Tests (NUR lokal): ${#DB_TESTS[@]} Tests"
echo ""

# 6. Wichtige Hinweise
echo "📌 Wichtige Hinweise:"
echo "   - GitHub Actions: NUR Unit Tests & Code Quality"
echo "   - Lokale Tests: ALLE DB-Tests mit Hauptdatenbank 'main'"
echo "   - Keine Mocks mehr, nur echte Datenbank!"
echo ""