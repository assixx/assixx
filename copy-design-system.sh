#!/bin/bash

# Script zum Kopieren des Design Systems in Docker Container
# Führe mit: sudo bash copy-design-system.sh

echo "🎨 Kopiere Design System in Docker Container..."

# 1. Erstelle tar-Archiv
echo "📦 Erstelle Archiv..."
sudo tar -czf /tmp/design-system.tar.gz -C /home/scs/projects/Assixx design-system

# 2. Kopiere in Container
echo "📤 Kopiere in Container..."
sudo docker cp /tmp/design-system.tar.gz assixx-backend:/tmp/

# 3. Entpacke im Container
echo "📂 Entpacke im Container..."
sudo docker exec assixx-backend sh -c "cd /app && tar -xzf /tmp/design-system.tar.gz && rm /tmp/design-system.tar.gz"

# 4. Setze Berechtigungen
echo "🔑 Setze Berechtigungen..."
sudo docker exec assixx-backend sh -c "chown -R node:node /app/design-system"

# 5. Installiere Dependencies
echo "📦 Installiere Dependencies..."
sudo docker exec -u node assixx-backend sh -c "cd /app/design-system && pnpm install"

# 6. Baue Design Tokens
echo "🏗️ Baue Design Tokens..."
sudo docker exec -u node assixx-backend sh -c "cd /app/design-system && pnpm run build"

# 7. Aufräumen
echo "🧹 Räume auf..."
sudo rm /tmp/design-system.tar.gz

echo "✅ Design System erfolgreich kopiert und gebaut!"

# 8. Zeige generierte Dateien
echo "📁 Generierte Token-Dateien:"
sudo docker exec assixx-backend ls -la /app/design-system/build/web/css/