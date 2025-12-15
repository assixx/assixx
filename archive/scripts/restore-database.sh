#!/bin/bash

# Assixx Database Restore Script
# Stellt ein Backup der MySQL Datenbank wieder her

# Konfiguration
BACKUP_DIR="/home/scs/projects/Assixx/backups"
CONTAINER_NAME="assixx-mysql"
DB_NAME="main"
DB_USER="root"
DB_PASSWORD="StrongP@ssw0rd!123"

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Funktion für Logging
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Banner
echo "======================================"
echo "   Assixx Database Restore Tool"
echo "======================================"
echo ""

# Prüfe ob Container läuft
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    error "MySQL Container '$CONTAINER_NAME' läuft nicht!"
    exit 1
fi

# Wenn Backup-Datei als Parameter übergeben wurde
if [ "$#" -eq 1 ]; then
    BACKUP_FILE="$1"
    if [ ! -f "$BACKUP_FILE" ]; then
        error "Backup-Datei nicht gefunden: $BACKUP_FILE"
        exit 1
    fi
else
    # Zeige verfügbare Backups
    info "Verfügbare Backups:"
    echo ""
    
    # Latest Backup
    if [ -f "$BACKUP_DIR/latest_backup.sql.gz" ]; then
        echo "  [0] latest_backup.sql.gz (Letztes Backup)"
    fi
    
    # Tägliche Backups
    echo ""
    echo "  Tägliche Backups:"
    DAILY_FILES=($(ls -1t $BACKUP_DIR/daily/*.gz 2>/dev/null | head -10))
    for i in "${!DAILY_FILES[@]}"; do
        FILE="${DAILY_FILES[$i]}"
        SIZE=$(ls -lh "$FILE" | awk '{print $5}')
        DATE=$(basename "$FILE" | sed 's/main_backup_\([0-9]\{8\}\)_\([0-9]\{6\}\).*/\1 \2/' | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\) \([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
        echo "  [$((i+1))] $(basename "$FILE") - $DATE ($SIZE)"
    done
    
    # Wöchentliche Backups
    echo ""
    echo "  Wöchentliche Backups:"
    WEEKLY_FILES=($(ls -1t $BACKUP_DIR/weekly/*.gz 2>/dev/null | head -5))
    for i in "${!WEEKLY_FILES[@]}"; do
        FILE="${WEEKLY_FILES[$i]}"
        SIZE=$(ls -lh "$FILE" | awk '{print $5}')
        echo "  [W$((i+1))] $(basename "$FILE") ($SIZE)"
    done
    
    # Monatliche Backups
    echo ""
    echo "  Monatliche Backups:"
    MONTHLY_FILES=($(ls -1t $BACKUP_DIR/monthly/*.gz 2>/dev/null | head -5))
    for i in "${!MONTHLY_FILES[@]}"; do
        FILE="${MONTHLY_FILES[$i]}"
        SIZE=$(ls -lh "$FILE" | awk '{print $5}')
        echo "  [M$((i+1))] $(basename "$FILE") ($SIZE)"
    done
    
    echo ""
    read -p "Wählen Sie ein Backup (0-10, W1-W5, M1-M5) oder 'q' zum Abbrechen: " choice
    
    if [ "$choice" = "q" ]; then
        log "Abgebrochen."
        exit 0
    fi
    
    # Bestimme Backup-Datei basierend auf Auswahl
    if [ "$choice" = "0" ]; then
        BACKUP_FILE="$BACKUP_DIR/latest_backup.sql.gz"
    elif [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le 10 ]; then
        BACKUP_FILE="${DAILY_FILES[$((choice-1))]}"
    elif [[ "$choice" =~ ^W[0-9]+$ ]]; then
        NUM="${choice:1}"
        BACKUP_FILE="${WEEKLY_FILES[$((NUM-1))]}"
    elif [[ "$choice" =~ ^M[0-9]+$ ]]; then
        NUM="${choice:1}"
        BACKUP_FILE="${MONTHLY_FILES[$((NUM-1))]}"
    else
        error "Ungültige Auswahl!"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        error "Backup-Datei nicht gefunden!"
        exit 1
    fi
fi

# Zeige Backup-Informationen
info "Ausgewähltes Backup: $(basename "$BACKUP_FILE")"
info "Größe: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"

# Sicherheitsabfrage
warning "⚠️  WARNUNG: Diese Aktion wird die aktuelle Datenbank überschreiben!"
echo ""
read -p "Sind Sie sicher? Geben Sie 'JA' ein um fortzufahren: " confirm

if [ "$confirm" != "JA" ]; then
    log "Abgebrochen."
    exit 0
fi

# Erstelle Sicherheits-Backup der aktuellen DB
info "Erstelle Sicherheits-Backup der aktuellen Datenbank..."
SAFETY_BACKUP="$BACKUP_DIR/safety_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
if docker exec "$CONTAINER_NAME" mysqldump -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" 2>/dev/null | gzip > "$SAFETY_BACKUP"; then
    log "✅ Sicherheits-Backup erstellt: $SAFETY_BACKUP"
else
    error "Fehler beim Erstellen des Sicherheits-Backups!"
    exit 1
fi

# Dekomprimiere Backup falls nötig
if [[ "$BACKUP_FILE" == *.gz ]]; then
    info "Dekomprimiere Backup..."
    TEMP_FILE="/tmp/restore_$(date +%s).sql"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
else
    TEMP_FILE="$BACKUP_FILE"
fi

# Restore durchführen
info "Stelle Datenbank wieder her..."
if docker exec -i "$CONTAINER_NAME" mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$TEMP_FILE"; then
    log "✅ Datenbank erfolgreich wiederhergestellt!"
    
    # Zeige Tabellen-Statistik
    TABLE_COUNT=$(docker exec "$CONTAINER_NAME" mysql -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" -s 2>/dev/null)
    log "   Tabellen wiederhergestellt: $TABLE_COUNT"
else
    error "Fehler beim Wiederherstellen der Datenbank!"
    warning "Sie können das Sicherheits-Backup verwenden: $SAFETY_BACKUP"
    exit 1
fi

# Cleanup temporäre Datei
if [[ "$BACKUP_FILE" == *.gz ]] && [ -f "$TEMP_FILE" ]; then
    rm "$TEMP_FILE"
fi

log "✅ Wiederherstellung abgeschlossen!"
info "Tipp: Starten Sie den Backend-Container neu für saubere Verbindungen:"
echo "  docker restart assixx-backend"