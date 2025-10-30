#!/bin/bash

# Docker Build Test Script
# Testet ob das Docker Setup korrekt funktioniert

set -e

echo "🐳 Assixx Docker Build Test"
echo "=========================="

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker ist nicht installiert!${NC}"
    echo "Bitte installiere Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose ist nicht installiert!${NC}"
    echo "Bitte installiere Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker gefunden:${NC} $(docker --version)"
echo -e "${GREEN}✅ Docker Compose gefunden:${NC} $(docker-compose --version)"

# Test 1: Dockerfile Build
echo -e "\n${YELLOW}Test 1: Building Dockerfile...${NC}"
if docker build -t assixx-test . ; then
    echo -e "${GREEN}✅ Dockerfile build erfolgreich!${NC}"
else
    echo -e "${RED}❌ Dockerfile build fehlgeschlagen!${NC}"
    exit 1
fi

# Test 2: Docker Compose Validation
echo -e "\n${YELLOW}Test 2: Validating docker-compose.yml...${NC}"
if docker-compose config > /dev/null 2>&1; then
    echo -e "${GREEN}✅ docker-compose.yml ist valide!${NC}"
else
    echo -e "${RED}❌ docker-compose.yml hat Fehler!${NC}"
    docker-compose config
    exit 1
fi

# Test 3: Environment Check
echo -e "\n${YELLOW}Test 3: Checking environment...${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✅ .env Datei gefunden${NC}"
else
    echo -e "${YELLOW}⚠️  .env Datei nicht gefunden - verwende Defaults${NC}"
    echo "Tipp: cp .env.docker.example .env"
fi

# Test 4: Port Availability
echo -e "\n${YELLOW}Test 4: Checking port availability...${NC}"
for port in 3000 3306; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ Port $port ist bereits belegt!${NC}"
        echo "Prozess auf Port $port:"
        lsof -Pi :$port
    else
        echo -e "${GREEN}✅ Port $port ist frei${NC}"
    fi
done

# Test 5: Dry Run
echo -e "\n${YELLOW}Test 5: Docker Compose dry run...${NC}"
if docker-compose up --no-start 2>/dev/null; then
    echo -e "${GREEN}✅ Container können erstellt werden${NC}"
    docker-compose down 2>/dev/null
else
    echo -e "${RED}❌ Container-Erstellung fehlgeschlagen${NC}"
fi

# Cleanup
echo -e "\n${YELLOW}Cleanup...${NC}"
docker rmi assixx-test 2>/dev/null || true

echo -e "\n${GREEN}🎉 Alle Tests abgeschlossen!${NC}"
echo -e "\nNächste Schritte:"
echo "1. cp .env.docker.example .env"
echo "2. .env anpassen (Secrets ändern!)"
echo "3. docker-compose up -d"
echo "4. docker-compose logs -f"