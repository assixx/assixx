# 🛡️ Assixx Backup & Recovery Guide

## 📋 Übersicht

Dieses Backup-System schützt Ihre Assixx-Datenbank vor Datenverlust durch:

- ✅ Automatische tägliche Backups
- ✅ Wöchentliche und monatliche Archivierung
- ✅ Einfache Wiederherstellung
- ✅ Komprimierte Speicherung

## 🚀 Quick Start

### Sofort-Backup erstellen

```bash
# Schnelles Backup mit optionalem Kommentar
./quick-backup.sh "vor_wichtiger_aenderung"

# Oder ohne Kommentar
./quick-backup.sh
```

### Automatische Backups einrichten

```bash
# Interaktives Setup für Cron-Jobs
./setup-backup-cron.sh
```

## 📁 Backup-Struktur

```
backups/
├── daily/          # Tägliche Backups (7 Tage aufbewahrt)
├── weekly/         # Wöchentliche Backups (30 Tage aufbewahrt)
├── monthly/        # Monatliche Backups (365 Tage aufbewahrt)
├── quick/          # Manuelle Quick-Backups
├── latest_backup.sql.gz  # Immer das neueste Backup
└── cron.log        # Log der automatischen Backups
```

## 🔧 Scripts im Detail

### 1. `backup-database.sh`

Hauptscript für automatische Backups:

- Erstellt komprimierte SQL-Dumps
- Verwaltet tägliche/wöchentliche/monatliche Rotation
- Löscht automatisch alte Backups
- Zeigt Statistiken

**Manuell ausführen:**

```bash
./backup-database.sh
```

### 2. `restore-database.sh`

Interaktives Wiederherstellungs-Tool:

- Zeigt alle verfügbaren Backups
- Erstellt Sicherheits-Backup vor Wiederherstellung
- Validiert die Wiederherstellung

**Verwendung:**

```bash
# Interaktiv (zeigt Menü)
./restore-database.sh

# Direkt mit Datei
./restore-database.sh /pfad/zum/backup.sql.gz
```

### 3. `quick-backup.sh`

Für schnelle manuelle Backups:

```bash
# Mit Beschreibung
./quick-backup.sh "vor_migration"

# Erstellt: quick_backup_20250601_120000_vor_migration.sql.gz
```

### 4. `setup-backup-cron.sh`

Richtet automatische Backups ein:

- Verschiedene Zeitpläne wählbar
- Verwaltet Cron-Jobs
- Zeigt aktuelle Einstellungen

## 📊 Backup-Strategie

### Aufbewahrung

- **Tägliche Backups**: 7 Tage
- **Wöchentliche Backups**: 30 Tage
- **Monatliche Backups**: 365 Tage
- **Quick Backups**: Manuell löschen

### Empfohlene Praxis

1. **Automatische Backups**: Täglich um 02:00 Uhr
2. **Vor großen Änderungen**: Quick-Backup erstellen
3. **Regelmäßig prüfen**: Backup-Statistiken kontrollieren

## 🚨 Notfall-Wiederherstellung

### Fall 1: Datenbank komplett verloren

```bash
# Docker neu starten
docker-compose down
docker-compose up -d

# Warten bis MySQL bereit
sleep 10

# Schema importieren
mysql -u root -pStrongP@ssw0rd!123 assixx < database/docker-init.sql

# Daten wiederherstellen
./restore-database.sh
```

### Fall 2: Fehlerhafte Daten korrigieren

```bash
# Quick-Backup vor Änderung
./quick-backup.sh "vor_korrektur"

# Änderungen durchführen...

# Bei Problemen: Wiederherstellen
./restore-database.sh backups/quick/quick_backup_*.sql.gz
```

### Fall 3: Docker Volume defekt

```bash
# Neues Volume erstellen
docker-compose down -v
docker-compose up -d

# Schema und Daten wiederherstellen
bash setup-docker-db.sh
./restore-database.sh
```

## 🔐 Sicherheitshinweise

1. **Backup-Dateien schützen**:

   - Enthalten sensible Daten
   - Verschlüsseln für externe Speicherung
   - Zugriff beschränken

2. **Passwörter**:

   - In Scripts hartcodiert (ändern in Produktion!)
   - Umgebungsvariablen verwenden

3. **Externe Speicherung**:
   ```bash
   # Backup zu externem Server kopieren
   rsync -avz backups/ user@backup-server:/path/to/backups/
   ```

## 📈 Monitoring

### Backup-Status prüfen

```bash
# Zeige Backup-Statistik
ls -la backups/*/ | wc -l

# Zeige Speicherplatz
du -sh backups/

# Prüfe letztes Backup
ls -la backups/latest_backup.sql.gz
```

### Cron-Logs prüfen

```bash
# Live-Log verfolgen
tail -f backups/cron.log

# Letzte Backups
grep "abgeschlossen" backups/cron.log | tail -10
```

## 🆘 Troubleshooting

### Problem: "MySQL Container läuft nicht"

```bash
docker-compose up -d
docker ps | grep mysql
```

### Problem: "Backup zu groß"

```bash
# Nur Struktur ohne Daten
docker exec assixx-mysql mysqldump -u root -p'StrongP@ssw0rd!123' --no-data assixx > structure_only.sql
```

### Problem: "Restore schlägt fehl"

```bash
# Prüfe MySQL Logs
docker logs assixx-mysql --tail 50

# Versuche mit kleineren Batches
zcat backup.sql.gz | split -l 1000 - partial_
# Dann einzeln importieren
```

## 💡 Best Practices

1. **Testen Sie Backups regelmäßig**

   - Monatlich eine Test-Wiederherstellung
   - Dokumentieren Sie den Prozess

2. **3-2-1 Regel**

   - 3 Kopien Ihrer Daten
   - 2 verschiedene Medien
   - 1 externe Kopie

3. **Automatisierung**
   - Cron-Jobs für regelmäßige Backups
   - Monitoring für Fehler
   - Alerts bei Problemen

## 📞 Support

Bei Problemen:

1. Prüfen Sie die Logs: `backups/cron.log`
2. Führen Sie manuelles Backup aus
3. Kontaktieren Sie den Administrator

---

**Letzte Aktualisierung:** 01.06.2025  
**Version:** 1.0
