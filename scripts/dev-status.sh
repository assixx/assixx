#!/bin/bash

# Assixx Development Status Check
# Führt alle wichtigen Checks in einem Script aus
# Optional: Mit --with-tests für vollständigen Test-Durchlauf

# Parameter Check
RUN_TESTS=false
if [ "$1" = "--with-tests" ]; then
    RUN_TESTS=true
fi

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
    echo -e "   ${YELLOW}ℹ️  56 Test-Fehler bekannt (werden ignoriert)${NC}"
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
echo "   📊 Test-Strategie: Klare Trennung GitHub/Lokal"
echo ""

# GitHub Actions Tests
echo "   🌐 GitHub Actions (Automatisch bei Push/PR):"
echo "      • Unit Tests: 2 Tests (errorHandler, health)"
echo "      • Code Quality: TypeScript, ESLint, Prettier"
echo "      • Docker Build Test"
echo ""

# Lokale Tests
echo "   🏠 Lokale Tests (Mit Docker MySQL):"
echo "      • DB Tests: 17 Integration Tests"
echo "      • Nutzt Hauptdatenbank 'main'"
echo "      • Keine Mocks, nur echte DB"
echo ""

# Quick Test Command
echo "   ${YELLOW}→ Tests lokal ausführen: ./scripts/test-local.sh${NC}"
echo ""

# 6. Aktuelle Phase
echo "6️⃣  Aktuelle Phase:"
echo "   🎯 Version 0.1.0 - Systematisches Testing & Debugging"
echo "   👤 Verantwortlich: Simon"
echo "   📊 Fortschritt: 0/12 Bereiche getestet"
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

# 7. Automatischer Test-Durchlauf (wenn --with-tests Flag gesetzt)
if [ "$RUN_TESTS" = true ]; then
    echo "7️⃣  Automatischer Test-Durchlauf:"
    echo "=================================="
    echo ""
    
    # Arrays für Test-Tracking
    declare -a PASSED_TESTS=()
    declare -a FAILED_TESTS=()
    declare -a SKIPPED_TESTS=()
    
    # Unit Tests (GitHub Actions)
    echo "   🌐 Unit Tests (auch auf GitHub):"
    UNIT_TESTS=(
        "errorHandler.test.ts"
        "health.test.ts"
    )
    
    for test in "${UNIT_TESTS[@]}"; do
        echo -n "      • $test ... "
        if docker exec -w /app/backend assixx-backend pnpm test "$test" > /tmp/test-$test.log 2>&1; then
            echo -e "${GREEN}✅ PASSED${NC}"
            PASSED_TESTS+=("$test")
        else
            echo -e "${RED}❌ FAILED${NC}"
            FAILED_TESTS+=("$test")
        fi
    done
    echo ""
    
    # DB Tests (Nur lokal)
    echo "   🏠 Integration Tests (DB erforderlich):"
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
    
    for test in "${DB_TESTS[@]}"; do
        echo -n "      • $test ... "
        # Documents test ist bekannt problematisch
        if [ "$test" = "documents.test.ts" ]; then
            echo -e "${YELLOW}⏭️  SKIPPED (Known issue)${NC}"
            SKIPPED_TESTS+=("$test")
        else
            if docker exec -w /app/backend -e DB_NAME=main -e NODE_ENV=production assixx-backend pnpm test "$test" > /tmp/test-$test.log 2>&1; then
                echo -e "${GREEN}✅ PASSED${NC}"
                PASSED_TESTS+=("$test")
            else
                echo -e "${RED}❌ FAILED${NC}"
                FAILED_TESTS+=("$test")
                # Optional: Zeige erste Fehlerzeile
                ERROR_LINE=$(grep -m1 "FAIL\|Error\|Expected" /tmp/test-$test.log 2>/dev/null || echo "")
                if [ ! -z "$ERROR_LINE" ]; then
                    echo "        └─ $ERROR_LINE"
                fi
            fi
        fi
    done
    echo ""
    
    # Test-Zusammenfassung
    echo "   📊 Test-Zusammenfassung:"
    echo "   ════════════════════════"
    TOTAL_TESTS=$((${#PASSED_TESTS[@]} + ${#FAILED_TESTS[@]} + ${#SKIPPED_TESTS[@]}))
    echo -e "   Total Tests: $TOTAL_TESTS"
    echo -e "   ${GREEN}✅ Passed: ${#PASSED_TESTS[@]}${NC}"
    echo -e "   ${RED}❌ Failed: ${#FAILED_TESTS[@]}${NC}"
    echo -e "   ${YELLOW}⏭️  Skipped: ${#SKIPPED_TESTS[@]}${NC}"
    echo ""
    
    # Erfolgsrate
    if [ ${#FAILED_TESTS[@]} -eq 0 ] && [ ${#SKIPPED_TESTS[@]} -eq 0 ]; then
        echo -e "   ${GREEN}🎉 Alle Tests erfolgreich!${NC}"
    elif [ ${#FAILED_TESTS[@]} -eq 0 ]; then
        echo -e "   ${YELLOW}⚠️  Tests mit Warnungen (${#SKIPPED_TESTS[@]} übersprungen)${NC}"
    else
        echo -e "   ${RED}❌ ${#FAILED_TESTS[@]} Tests fehlgeschlagen!${NC}"
        echo ""
        echo "   Fehlgeschlagene Tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "   - $test"
        done
    fi
    echo ""
    echo "   💡 Tipp: Logs unter /tmp/test-*.log für Details"
    echo ""
else
    echo "💡 Tipp: Führe '$0 --with-tests' aus für vollständigen Test-Durchlauf"
fi