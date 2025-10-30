# 🔐 Assixx Backup-Strategie

## 📊 Was wird gesichert?

1. **MySQL Datenbank** (Kritisch)
   - Alle Tenant-Daten
   - Benutzerkonten
   - Systemkonfiguration

2. **Upload-Verzeichnis** (Wichtig)
   - Dokumente
   - Profilbilder
   - Chat-Anhänge
   - KVP-Dateien

3. **Environment Config** (Wichtig)
   - .env Datei
   - SSL-Zertifikate
   - Custom Configs

## 🕐 Backup-Zeitplan

- **Täglich**: Datenbank (Incremental)
- **Wöchentlich**: Vollbackup (DB + Uploads)
- **Monatlich**: Archiv-Backup (Langzeitspeicherung)

## 📝 Backup-Skripte

### Automatisches Backup-Skript

Erstelle `/home/assixx/backup.sh`:

```bash
#!/bin/bash
# Assixx Automated Backup Script

# Konfiguration
BACKUP_DIR="/backup/assixx"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Verzeichnisse erstellen
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

# 1. Datenbank-Backup
echo "Starting database backup..."
docker exec assixx-mysql mysqldump \
    -u root -p${MYSQL_ROOT_PASSWORD} \
    --all-databases \
    --single-transaction \
    --quick \
    --lock-tables=false \
    > "$BACKUP_DIR/daily/db_${DATE}.sql"

# Komprimieren
gzip "$BACKUP_DIR/daily/db_${DATE}.sql"

# 2. Uploads-Backup (nur geänderte Dateien)
echo "Starting uploads backup..."
rsync -av --delete \
    ./uploads/ \
    "$BACKUP_DIR/daily/uploads_${DATE}/"

# 3. Config-Backup
echo "Backing up configuration..."
cp .env "$BACKUP_DIR/daily/env_${DATE}"
cp docker-compose.yml "$BACKUP_DIR/daily/docker-compose_${DATE}.yml"

# 4. Wöchentliches Vollbackup (Sonntags)
if [ $(date +%u) -eq 7 ]; then
    echo "Creating weekly backup..."
    tar -czf "$BACKUP_DIR/weekly/full_${DATE}.tar.gz" \
        "$BACKUP_DIR/daily/db_${DATE}.sql.gz" \
        "$BACKUP_DIR/daily/uploads_${DATE}/" \
        "$BACKUP_DIR/daily/env_${DATE}"
fi

# 5. Monatliches Archiv (1. des Monats)
if [ $(date +%d) -eq 1 ]; then
    echo "Creating monthly archive..."
    cp "$BACKUP_DIR/weekly/full_${DATE}.tar.gz" \
       "$BACKUP_DIR/monthly/"
fi

# 6. Alte Backups löschen
echo "Cleaning old backups..."
find "$BACKUP_DIR/daily" -type f -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/weekly" -type f -mtime +90 -delete

echo "Backup completed successfully!"
```

### Crontab einrichten

```bash
# Backup täglich um 2:00 Uhr
0 2 * * * /home/assixx/backup.sh >> /var/log/assixx-backup.log 2>&1
```

## 🔄 Restore-Prozedur

### Datenbank wiederherstellen

```bash
# 1. Container stoppen
docker-compose stop backend

# 2. Datenbank leeren (optional)
docker exec -it assixx-mysql mysql -u root -p -e "DROP DATABASE assixx; CREATE DATABASE assixx;"

# 3. Backup einspielen
gunzip < backup/db_20250531_020000.sql.gz | \
    docker exec -i assixx-mysql mysql -u root -p assixx

# 4. Container neu starten
docker-compose start backend
```

### Uploads wiederherstellen

```bash
# Uploads-Verzeichnis wiederherstellen
rsync -av backup/uploads_20250531_020000/ ./uploads/
```

## 🌐 Offsite-Backup

### Option 1: S3-kompatible Storage

```bash
# Mit rclone zu S3 synchronisieren
rclone sync /backup/assixx s3:assixx-backup/ \
    --transfers 4 \
    --checkers 8 \
    --contimeout 60s
```

### Option 2: SFTP/SSH

```bash
# Zu Remote-Server synchronisieren
rsync -avz -e "ssh -p 22" \
    /backup/assixx/ \
    backup@remote-server.com:/backups/assixx/
```

## 🧪 Backup-Test

Monatlicher Test-Restore:

1. Test-Container erstellen
2. Backup einspielen
3. Funktionalität prüfen
4. Test-Container löschen

## 📊 Monitoring

### Backup-Status prüfen

```bash
#!/bin/bash
# check-backup-status.sh

BACKUP_DIR="/backup/assixx/daily"
MAX_AGE_HOURS=26

# Letztes Backup finden
LATEST_BACKUP=$(ls -t $BACKUP_DIR/db_*.sql.gz 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "CRITICAL: No backup found!"
    exit 2
fi

# Alter prüfen
BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))

if [ $BACKUP_AGE -gt $MAX_AGE_HOURS ]; then
    echo "WARNING: Latest backup is $BACKUP_AGE hours old"
    exit 1
else
    echo "OK: Latest backup is $BACKUP_AGE hours old"
    exit 0
fi
```

### E-Mail-Benachrichtigung

```bash
# In backup.sh hinzufügen:
if [ $? -eq 0 ]; then
    echo "Backup successful" | mail -s "Assixx Backup OK" admin@example.com
else
    echo "Backup FAILED!" | mail -s "Assixx Backup FEHLER" admin@example.com
fi
```

## 🔒 Sicherheit

1. **Verschlüsselung**

   ```bash
   # Backup verschlüsseln
   gpg --encrypt --recipient admin@example.com backup.tar.gz
   ```

2. **Berechtigungen**

   ```bash
   chmod 600 /backup/assixx/*
   chown root:root /backup/assixx/*
   ```

3. **Backup-Passwörter**
   - Niemals im Skript hardcoden
   - Environment-Variablen verwenden
   - Oder MySQL config file

---

**Wichtig**: Teste regelmäßig die Restore-Prozedur!
