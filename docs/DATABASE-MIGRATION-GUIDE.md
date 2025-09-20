# 📚 Database Migration Guide für Assixx

> **Letztes Update:** 02.06.2025
> **Erstellt aus:** Lernerfahrungen der plans-system Migration

## 🎯 Übersicht

Diese Anleitung dokumentiert den **richtigen Weg** für Datenbank-Migrationen im Assixx-Projekt.

## ⚡ Quick Migration (2-3 Minuten)

```bash
# 1. Backup erstellen (30 Sekunden)
bash scripts/quick-backup.sh "before_migration_$(date +%Y%m%d_%H%M%S)"

# 2. Migration kopieren und ausführen (1 Minute)
MIGRATION_FILE="database/migrations/XXX-your-migration.sql"
docker cp $MIGRATION_FILE assixx-mysql:/tmp/
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main < /tmp/'$(basename $MIGRATION_FILE)

# 3. Verifizieren (30 Sekunden)
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SHOW TABLES;"'
```

## 🏗️ Komplette Migration Checkliste

### 1️⃣ **VOR der Migration**

```bash
# Container Status prüfen
docker ps --format "table {{.Names}}\t{{.Status}}"
# Erwartete Ausgabe:
# NAMES            STATUS
# assixx-backend   Up X minutes (healthy)
# assixx-mysql     Up X minutes (healthy)
# assixx-redis     Up X minutes (healthy)

# Backup erstellen
bash scripts/quick-backup.sh "before_migration_$(date +%Y%m%d_%H%M%S)"

# MySQL Verbindung testen
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SELECT 1;"'
```

### 2️⃣ **Migration Datei vorbereiten**

#### ⚠️ **WICHTIG bei DROP TABLE Statements:**

```sql
-- FALSCH ❌ (führt zu Foreign Key Errors)
DROP TABLE IF EXISTS plans;

-- RICHTIG ✅ (prüft und entfernt Foreign Keys zuerst)
-- Drop foreign key constraint if exists
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tenants'
    AND COLUMN_NAME = 'current_plan_id'
    AND REFERENCED_TABLE_NAME = 'plans'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE tenants DROP FOREIGN KEY tenants_ibfk_1',
    'SELECT "Foreign key does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Jetzt kann die Tabelle gedroppt werden
DROP TABLE IF EXISTS plans;
```

### 3️⃣ **Migration ausführen**

#### **Option A: Direkte Ausführung (EMPFOHLEN)**

```bash
# Migration in Container kopieren
docker cp database/migrations/003-add-plans-system.sql assixx-mysql:/tmp/

# Migration ausführen
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main < /tmp/003-add-plans-system.sql'
```

#### **Option B: Via Node.js Script**

```bash
# NUR wenn run-migration.js existiert
docker exec assixx-backend node /app/backend/src/utils/scripts/run-migration.js
```

### 4️⃣ **Nach der Migration**

```bash
# Tabellen verifizieren
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SHOW TABLES LIKE '\''%neue_tabelle%'\'';"'

# Daten prüfen
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SELECT COUNT(*) FROM neue_tabelle;"'

# Bei Schema-Änderungen: Backend neustarten
cd docker && docker-compose restart backend
```

## 🚨 Häufige Fehler und Lösungen

### Problem 1: MySQL Access Denied

```bash
# FALSCH ❌
docker exec assixx-mysql mysql -u root -p'StrongP@ssw0rd!123' main

# RICHTIG ✅ (mit sh -c wrapper)
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "YOUR SQL HERE"'
```

### Problem 2: Foreign Key Constraint Error

```sql
-- Error: Cannot drop table 'X' referenced by a foreign key constraint

-- Lösung: Erst Constraints finden
SELECT
    TABLE_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME = 'your_table'
AND TABLE_SCHEMA = DATABASE();

-- Dann Constraint entfernen
ALTER TABLE referencing_table DROP FOREIGN KEY constraint_name;
```

### Problem 3: Container Name falsch

```bash
# FALSCH ❌
docker exec assixx-mysql-1 ...  # Auto-generierter Name

# RICHTIG ✅
docker exec assixx-mysql ...     # Definierter Container-Name
```

## 📋 Migration Template

Erstelle neue Migrationen nach diesem Template:

```sql
-- =====================================================
-- Migration: Beschreibung
-- Date: YYYY-MM-DD
-- Author: Name
-- =====================================================

-- 1. Cleanup (wenn nötig)
-- Prüfe Foreign Keys VOR dem DROP!

-- 2. Create Tables
CREATE TABLE IF NOT EXISTS table_name (
    id INT PRIMARY KEY AUTO_INCREMENT,
    -- columns
);

-- 3. Insert Default Data
INSERT INTO table_name (...) VALUES (...);

-- 4. Create Indexes
CREATE INDEX idx_name ON table_name(column);

-- 5. Create Views (mit CREATE OR REPLACE, nicht IF NOT EXISTS)
CREATE OR REPLACE VIEW view_name AS
SELECT ...;
```

## 🧪 Test Commands

```bash
# Quick Test Suite für Migrationen
echo "=== Testing MySQL Connection ==="
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SELECT VERSION();"'

echo "=== Listing Tables ==="
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SHOW TABLES;"'

echo "=== Checking Foreign Keys ==="
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "
SELECT TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME IS NOT NULL
AND TABLE_SCHEMA = DATABASE();"'
```

## 💡 Lessons Learned

1. **IMMER** die funktionierende Verbindungsmethode verwenden (sh -c wrapper)
2. **NIEMALS** blind verschiedene Auth-Methoden probieren
3. **IMMER** Foreign Keys prüfen vor DROP TABLE
4. **IMMER** Backup vor Migration
5. **IMMER** die exakten Container-Namen aus `docker ps` verwenden

## 🔗 Verwandte Dokumentation

- [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) - Datenbankstruktur
- [BACKUP-GUIDE.md](./BACKUP-GUIDE.md) - Backup-Strategien
- [DOCKER-SETUP.md](./DOCKER-SETUP.md) - Docker-Konfiguration

---

**Merke:** Eine gut vorbereitete Migration dauert 2-3 Minuten. Wenn es länger dauert, stoppe und überprüfe diese Anleitung!
