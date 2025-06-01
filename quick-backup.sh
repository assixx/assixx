#!/bin/bash

# Quick Backup Script - Für schnelle manuelle Backups

CONTAINER_NAME="assixx-mysql"
DB_NAME="assixx"
DB_USER="root"
DB_PASSWORD="StrongP@ssw0rd!123"
BACKUP_DIR="/home/scs/projects/Assixx/backups/quick"

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Erstelle Verzeichnis
mkdir -p "$BACKUP_DIR"

# Backup-Name mit optionalem Kommentar
if [ "$1" ]; then
    COMMENT="_${1// /_}"  # Ersetze Leerzeichen mit Unterstrichen
else
    COMMENT=""
fi

FILENAME="quick_backup_$(date +%Y%m%d_%H%M%S)${COMMENT}.sql.gz"
FILEPATH="$BACKUP_DIR/$FILENAME"

echo -e "${YELLOW}🔄 Erstelle Quick-Backup...${NC}"

# Erstelle Backup
if docker exec "$CONTAINER_NAME" mysqldump -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" 2>/dev/null | gzip > "$FILEPATH"; then
    SIZE=$(ls -lh "$FILEPATH" | awk '{print $5}')
    echo -e "${GREEN}✅ Backup erstellt!${NC}"
    echo "   Datei: $FILENAME"
    echo "   Größe: $SIZE"
    echo "   Pfad: $FILEPATH"
    
    # Zeige die letzten 5 Quick-Backups
    echo ""
    echo "Letzte Quick-Backups:"
    ls -1t "$BACKUP_DIR"/*.gz 2>/dev/null | head -5 | while read file; do
        echo "  - $(basename "$file") ($(ls -lh "$file" | awk '{print $5}'))"
    done
else
    echo -e "${RED}❌ Fehler beim Erstellen des Backups!${NC}"
    exit 1
fi

# Warnung wenn zu viele Quick-Backups
COUNT=$(ls -1 "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l)
if [ "$COUNT" -gt 20 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Sie haben $COUNT Quick-Backups. Erwägen Sie alte zu löschen mit:${NC}"
    echo "   rm $BACKUP_DIR/quick_backup_*.gz"
fi