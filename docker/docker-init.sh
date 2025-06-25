#!/bin/bash

# Docker Initialization Script for New Developers
# This script sets up the required Docker volumes and starts the containers

echo "🚀 Assixx Docker Setup für neue Entwickler"
echo "=========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker ist nicht installiert! Bitte Docker installieren."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose ist nicht installiert! Bitte Docker Compose installieren."
    exit 1
fi

# Check if we're in the docker directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Bitte dieses Script aus dem docker/ Verzeichnis ausführen!"
    echo "   cd docker && ./docker-init.sh"
    exit 1
fi

# Create external volumes
echo ""
echo "📦 Erstelle Docker Volumes..."

# Check if volumes already exist
if docker volume inspect assixx_mysql_data &> /dev/null; then
    echo "✅ Volume 'assixx_mysql_data' existiert bereits"
else
    docker volume create assixx_mysql_data
    echo "✅ Volume 'assixx_mysql_data' erstellt"
fi

if docker volume inspect assixx_redis_data &> /dev/null; then
    echo "✅ Volume 'assixx_redis_data' existiert bereits"
else
    docker volume create assixx_redis_data
    echo "✅ Volume 'assixx_redis_data' erstellt"
fi

# Check if .env file exists
echo ""
echo "🔧 Prüfe Konfiguration..."
if [ ! -f "../.env" ]; then
    if [ -f "../.env.example" ]; then
        echo "📝 Erstelle .env Datei aus .env.example..."
        cp ../.env.example ../.env
        echo "⚠️  Bitte .env Datei anpassen (JWT_SECRET, SESSION_SECRET, etc.)"
    else
        echo "❌ Keine .env oder .env.example Datei gefunden!"
        exit 1
    fi
else
    echo "✅ .env Datei gefunden"
fi

# Start Docker containers
echo ""
echo "🐳 Starte Docker Container..."
docker-compose up -d

# Wait for services to be ready
echo ""
echo "⏳ Warte auf Services..."
sleep 5

# Check container status
echo ""
echo "📊 Container Status:"
docker-compose ps

# Show access URLs
echo ""
echo "✨ Setup abgeschlossen!"
echo ""
echo "🌐 Zugriff:"
echo "   - Anwendung: http://localhost:3000"
echo "   - phpMyAdmin: http://localhost:8080"
echo "   - Health Check: http://localhost:3000/health"
echo ""
echo "📝 Nützliche Befehle:"
echo "   - Logs anzeigen: docker-compose logs -f"
echo "   - Container stoppen: docker-compose down"
echo "   - Container neustarten: docker-compose restart backend"
echo ""
echo "🎉 Viel Erfolg mit Assixx!"