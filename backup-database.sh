#!/bin/bash

# Assixx Database Backup Script
# Automatisches Backup der MySQL Datenbank

# Konfiguration
BACKUP_DIR="/home/scs/projects/Assixx/backups"
CONTAINER_NAME="assixx-mysql"
DB_NAME="assixx"
DB_USER="root"
DB_PASSWORD="StrongP@ssw0rd!123"
RETENTION_DAYS=30  # Behalte Backups für 30 Tage

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Erstelle Backup-Verzeichnis falls nicht vorhanden
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

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

# Prüfe ob Container läuft
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    error "MySQL Container '$CONTAINER_NAME' läuft nicht!"
    exit 1
fi

# Variablen für Dateinamen
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Montag, 7=Sonntag
DAY_OF_MONTH=$(date +%d)

# Basis-Dateiname
BASE_FILENAME="assixx_backup_${TIMESTAMP}"

# Tägliches Backup
log "Erstelle tägliches Backup..."
DAILY_FILE="$BACKUP_DIR/daily/${BASE_FILENAME}.sql"

if docker exec "$CONTAINER_NAME" mysqldump -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$DAILY_FILE" 2>/dev/null; then
    # Komprimiere das Backup
    gzip "$DAILY_FILE"
    log "✅ Tägliches Backup erstellt: ${DAILY_FILE}.gz"
    
    # Zeige Backup-Größe
    SIZE=$(ls -lh "${DAILY_FILE}.gz" | awk '{print $5}')
    log "   Größe: $SIZE"
else
    error "Fehler beim Erstellen des täglichen Backups!"
    exit 1
fi

# Wöchentliches Backup (Sonntags)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    log "Erstelle wöchentliches Backup..."
    cp "${DAILY_FILE}.gz" "$BACKUP_DIR/weekly/assixx_weekly_${TIMESTAMP}.sql.gz"
    log "✅ Wöchentliches Backup erstellt"
fi

# Monatliches Backup (am 1. des Monats)
if [ "$DAY_OF_MONTH" -eq "01" ]; then
    log "Erstelle monatliches Backup..."
    cp "${DAILY_FILE}.gz" "$BACKUP_DIR/monthly/assixx_monthly_${TIMESTAMP}.sql.gz"
    log "✅ Monatliches Backup erstellt"
fi

# Cleanup alte Backups
log "Bereinige alte Backups..."

# Lösche tägliche Backups älter als 7 Tage
find "$BACKUP_DIR/daily" -name "*.sql.gz" -type f -mtime +7 -delete
DELETED_DAILY=$(find "$BACKUP_DIR/daily" -name "*.sql.gz" -type f -mtime +7 | wc -l)
if [ "$DELETED_DAILY" -gt 0 ]; then
    log "   $DELETED_DAILY alte tägliche Backups gelöscht"
fi

# Lösche wöchentliche Backups älter als 30 Tage
find "$BACKUP_DIR/weekly" -name "*.sql.gz" -type f -mtime +30 -delete

# Lösche monatliche Backups älter als 365 Tage
find "$BACKUP_DIR/monthly" -name "*.sql.gz" -type f -mtime +365 -delete

# Zeige Backup-Statistik
log "📊 Backup-Statistik:"
log "   Tägliche Backups: $(ls -1 $BACKUP_DIR/daily/*.gz 2>/dev/null | wc -l)"
log "   Wöchentliche Backups: $(ls -1 $BACKUP_DIR/weekly/*.gz 2>/dev/null | wc -l)"
log "   Monatliche Backups: $(ls -1 $BACKUP_DIR/monthly/*.gz 2>/dev/null | wc -l)"

# Zeige Speicherplatz
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "   Gesamt-Speicherplatz: $TOTAL_SIZE"

# Optional: Kopiere letztes Backup zu einem festen Namen (für einfachen Zugriff)
cp "${DAILY_FILE}.gz" "$BACKUP_DIR/latest_backup.sql.gz"

log "✅ Backup-Prozess abgeschlossen!"