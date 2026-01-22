# Database Migration Guide - PostgreSQL

> **Last Update:** 2026-01-14
> **Database:** PostgreSQL 17 with Row Level Security (RLS)
> **Previous Version:** See `DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md` for MySQL guide

---

## Quick Reference

| Setting          | Value                                |
| ---------------- | ------------------------------------ |
| **Container**    | `assixx-postgres`                    |
| **Port**         | `5432`                               |
| **Database**     | `assixx`                             |
| **App User**     | `app_user` (RLS enforced)            |
| **Admin User**   | `assixx_user` (superuser, BYPASSRLS) |
| **Tables**       | 109 total (84 mit RLS, 25 global)    |
| **RLS Policies** | 89                                   |
| **GUI Tool**     | DBeaver (Windows)                    |

---

## Architektur: Zwei Orte für Migrations

```
/database/migrations/           ← Inkrementelle Historie (Git)
├── 001_baseline_complete_schema.sql   (aktueller Snapshot)
├── 002_seed_data.sql                  (aktueller Snapshot)
├── 003-xxx.sql                        (zukünftige Änderungen)
└── backup_old/                        (historische Migrations)

/customer/fresh-install/        ← Kunden-Deployment (in .gitignore)
├── 001_schema.sql                     (= 001_baseline)
├── 002_seed_data.sql                  (= 002_seed_data)
├── install.sh                         (Automatisches Script)
└── README.md
```

**Wichtig:**

- `database/migrations/` = Source of Truth, im Git
- `customer/fresh-install/` = Kopie für Kunden, in .gitignore
- Beide müssen IMMER identisch sein!

---

## Credentials

Siehe `docker/.env` für Passwörter.

| User          | Zweck              | RLS                 |
| ------------- | ------------------ | ------------------- |
| `app_user`    | Backend-Verbindung | Ja (unterliegt RLS) |
| `assixx_user` | Migrationen, Admin | Nein (BYPASSRLS)    |

Für Migrationen immer `assixx_user` verwenden.

---

## Quick Migration (5 Minuten)

```bash
# 1. GLOBAL BACKUP erstellen (PFLICHT!)
cd /home/scs/projects/Assixx
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/full_backup_${TIMESTAMP}.dump

# 2. Migration ausführen
MIGRATION_FILE="database/migrations/003-your-migration.sql"
docker cp $MIGRATION_FILE assixx-postgres:/tmp/
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/$(basename $MIGRATION_FILE)

# 3. Customer Fresh-Install aktualisieren (PFLICHT!)
./scripts/sync-customer-migrations.sh
# Oder manuell - siehe "Nach jeder Migration" Sektion

# 4. Verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt" | head -20
```

---

## Migration Workflow

### System-Tabellen (Seed-Daten)

Diese 5 Tabellen enthalten globale Konfiguration und unterliegen NICHT der RLS:

| Tabelle              | Rows | Beschreibung                                         | RLS  |
| -------------------- | ---- | ---------------------------------------------------- | ---- |
| `plans`              | 3    | Subscription-Pläne (Basic, Professional, Enterprise) | Nein |
| `features`           | 12   | Verfügbare Features                                  | Nein |
| `plan_features`      | 36   | Zuordnung Plan zu Features                           | Nein |
| `kvp_categories`     | 6    | KVP Vorschlagskategorien                             | Nein |
| `machine_categories` | 11   | Maschinenkategorien                                  | Nein |

Alle anderen Tabellen mit `tenant_id` unterliegen der Row Level Security (84 Tabellen).

### Migrations-Dateien

Pfad: `/database/migrations/`

| Datei                              | Inhalt                                               |
| ---------------------------------- | ---------------------------------------------------- |
| `001_baseline_complete_schema.sql` | Komplettes Schema (109 Tabellen, 89 RLS, 260 FK)     |
| `002_seed_data.sql`                | Seed-Daten (5 Tabellen, UTF-8 korrekt)               |
| `003-xxx.sql`                      | Zukünftige inkrementelle Änderungen                  |
| `backup_old/`                      | Historische Migrations (003-008 vor Baseline-Update) |

### Workflow: Schema oder Seed ändern

```bash
# ═══════════════════════════════════════════════════════════════
# SCHRITT 1: GLOBAL BACKUP (PFLICHT vor jeder Migration!)
# ═══════════════════════════════════════════════════════════════
cd /home/scs/projects/Assixx
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Global Backup (komprimiert, vollständig)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/full_backup_${TIMESTAMP}.dump

echo "Backup erstellt: database/backups/full_backup_${TIMESTAMP}.dump"

# ═══════════════════════════════════════════════════════════════
# SCHRITT 2: MIGRATION ERSTELLEN UND AUSFÜHREN
# ═══════════════════════════════════════════════════════════════
# Migration-Datei erstellen (z.B. 003-add-new-feature.sql)
# Dann ausführen:
docker cp database/migrations/003-add-new-feature.sql assixx-postgres:/tmp/
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/003-add-new-feature.sql

# ═══════════════════════════════════════════════════════════════
# SCHRITT 3: BASELINE + CUSTOMER AKTUALISIEREN (PFLICHT!)
# ═══════════════════════════════════════════════════════════════
# Schema neu dumpen
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --schema-only --no-owner --no-privileges --quote-all-identifiers \
    -f /tmp/schema.sql
docker cp assixx-postgres:/tmp/schema.sql database/migrations/001_baseline_complete_schema.sql

# Seed-Data neu dumpen (nur die 5 Seed-Tabellen)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --data-only --inserts --no-owner --no-privileges \
    -t plans -t features -t plan_features -t kvp_categories -t machine_categories \
    -f /tmp/seed.sql
docker cp assixx-postgres:/tmp/seed.sql database/migrations/002_seed_data.sql

# Customer aktualisieren
cp database/migrations/001_baseline_complete_schema.sql customer/fresh-install/001_schema.sql
cp database/migrations/002_seed_data.sql customer/fresh-install/002_seed_data.sql

echo "✅ Baseline und Customer synchronisiert!"

# ═══════════════════════════════════════════════════════════════
# SCHRITT 4: VERIFIZIEREN
# ═══════════════════════════════════════════════════════════════
# Prüfe dass alle 3 identisch sind
diff database/migrations/001_baseline_complete_schema.sql customer/fresh-install/001_schema.sql && echo "001: ✅"
diff database/migrations/002_seed_data.sql customer/fresh-install/002_seed_data.sql && echo "002: ✅"

# Backend neustarten
cd docker && docker-compose restart backend deletion-worker
```

### Backup-Verzeichnis

Pfad: `/database/backups/`

| Typ           | Format                   | Verwendung                    |
| ------------- | ------------------------ | ----------------------------- |
| Global Backup | `.dump` (pg_dump custom) | Vor jeder Migration (PFLICHT) |
| Schema Backup | `.sql`                   | Optional für Vergleiche       |
| Seed Backup   | `.sql`                   | Optional für Vergleiche       |

**Restore aus Global Backup:**

```bash
docker exec -i assixx-postgres pg_restore -U assixx_user -d assixx < database/backups/full_backup_XXXXXX.dump
```

---

## Connection Commands

### Via Docker (Empfohlen)

```bash
# Interaktive psql Shell
docker exec -it assixx-postgres psql -U assixx_user -d assixx

# Einzelner SQL Befehl
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT 1;"

# SQL-Datei ausführen
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/migration.sql

# Mit app_user (RLS aktiv - für Tests)
docker exec assixx-postgres psql -U app_user -d assixx -c "SELECT * FROM users;"
```

### Via DBeaver (Windows)

```
Host: localhost
Port: 5432
Database: assixx
User: assixx_user (Admin) oder app_user (RLS)
Password: siehe docker/.env
```

> **Tipp:** DBeaver auf Windows installieren, NICHT in WSL. Docker exposed Ports automatisch.

---

## Migration Checkliste

### 1. VOR der Migration

```bash
# Container Status prüfen
docker-compose ps

# PostgreSQL Verbindung testen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT version();"

# Backup erstellen
docker exec assixx-postgres pg_dump -U assixx_user -d assixx > backups/before_migration_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Migration Datei vorbereiten

```sql
-- =====================================================
-- Migration: Beschreibung
-- Date: YYYY-MM-DD
-- Author: Name
-- =====================================================

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS table_name (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Indexes
CREATE INDEX IF NOT EXISTS idx_table_tenant ON table_name(tenant_id);

-- 3. Enable RLS (für Tenant-Tabellen)
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_name FORCE ROW LEVEL SECURITY;

-- WICHTIG: NULLIF() im ersten Teil ist PFLICHT (Bug-Fix 2025-12-03)
CREATE POLICY tenant_isolation ON table_name
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

-- 4. Grant Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON table_name TO app_user;
GRANT USAGE, SELECT ON SEQUENCE table_name_id_seq TO app_user;

-- 5. Insert Default Data (optional)
INSERT INTO table_name (...) VALUES (...)
ON CONFLICT DO NOTHING;
```

### 3. Migration ausführen

```bash
# Migration kopieren
docker cp database/migrations/XXX-migration.sql assixx-postgres:/tmp/

# Migration ausführen (als Admin)
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/XXX-migration.sql

# Bei Fehlern: Verbose Output
docker exec assixx-postgres psql -U assixx_user -d assixx -v ON_ERROR_STOP=1 -f /tmp/XXX-migration.sql
```

### 4. Nach der Migration

```bash
# Tabellen verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt *table_name*"

# RLS Policies prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT * FROM pg_policies WHERE tablename = 'table_name';"

# Daten prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT COUNT(*) FROM table_name;"

# Backend neustarten (bei Schema-Änderungen)
cd /home/scs/projects/Assixx/docker && docker-compose restart backend deletion-worker
```

---

## PostgreSQL vs MySQL Syntax

| MySQL                     | PostgreSQL                                   | Notiz                      |
| ------------------------- | -------------------------------------------- | -------------------------- |
| `AUTO_INCREMENT`          | `SERIAL` oder `GENERATED ALWAYS AS IDENTITY` |                            |
| `?` Placeholder           | `$1, $2, $3`                                 | In Queries                 |
| `LIMIT ?, ?`              | `LIMIT $1 OFFSET $2`                         |                            |
| `` `column` ``            | `"column"`                                   | Quoting                    |
| `IFNULL(a, b)`            | `COALESCE(a, b)`                             |                            |
| `NOW()`                   | `NOW()`                                      | Identisch                  |
| `DATETIME`                | `TIMESTAMPTZ`                                | Mit Timezone               |
| `TINYINT(1)`              | `BOOLEAN`                                    |                            |
| `JSON`                    | `JSONB`                                      | Besser! Native Indexierung |
| `ENUM('a','b')`           | `CREATE TYPE ... AS ENUM`                    | Eigener Typ                |
| `ON DUPLICATE KEY UPDATE` | `ON CONFLICT ... DO UPDATE`                  | Upsert                     |

---

## Row Level Security (RLS)

### Konzept

```
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL mit RLS                                          │
│                                                             │
│  Request → app_user → SET app.tenant_id = X → Query         │
│                                                             │
│  SELECT * FROM users;                                       │
│  ↓ (RLS Policy filtert automatisch)                        │
│  SELECT * FROM users WHERE tenant_id = X;                   │
│                                                             │
│  ✅ Kein "AND tenant_id = ?" mehr in Queries nötig!         │
└─────────────────────────────────────────────────────────────┘
```

### Tenant Context setzen (Backend)

```typescript
// Automatisch in db.ts implementiert
const client = await pool.connect();
await client.query('SET app.tenant_id = $1', [tenantId.toString()]);
```

### RLS Policy Template

```sql
-- Standard RLS Policy für Tenant-Tabellen
-- WICHTIG: NULLIF() im ersten Teil ist PFLICHT!
-- Nach set_config() + COMMIT wird app.tenant_id zu '' (empty string), NICHT NULL!
-- Ohne NULLIF würde '' IS NULL = FALSE → RLS blockiert ALLES!
CREATE POLICY tenant_isolation ON table_name
    FOR ALL
    USING (
        -- Root/Admin Zugriff (kein Tenant Context oder empty string)
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        -- Oder passender Tenant
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );
```

### RLS testen

```bash
# Als app_user MIT Tenant Context
docker exec assixx-postgres psql -U app_user -d assixx -c "
SET app.tenant_id = '1';
SELECT COUNT(*) FROM users;  -- Nur Tenant 1 Daten
"

# Als app_user OHNE Tenant Context (Root-Zugriff)
docker exec assixx-postgres psql -U app_user -d assixx -c "
SELECT COUNT(*) FROM users;  -- Alle Daten (wenn Policy es erlaubt)
"

# RLS Policies anzeigen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT tablename, policyname, qual FROM pg_policies WHERE schemaname = 'public';
"
```

---

## ENUM Typen

PostgreSQL ENUMs sind strenge Typen:

```sql
-- ENUM erstellen
CREATE TYPE user_role AS ENUM ('root', 'admin', 'employee');

-- ENUM verwenden
CREATE TABLE users (
    role user_role DEFAULT 'employee'
);

-- ENUM Werte anzeigen
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype;

-- ENUM erweitern (Wert hinzufügen)
ALTER TYPE user_role ADD VALUE 'manager' AFTER 'admin';
```

### Existierende ENUMs

```bash
# Alle ENUMs auflisten
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
ORDER BY t.typname, e.enumsortorder;
"
```

---

## Protected Tables

Diese Tabellen sind vor DELETE geschützt:

- `plans` - Subscription Pläne
- `features` - Verfügbare Features
- `plan_features` - Plan-Feature Zuordnung

```sql
-- DELETE Versuch wird geblockt
DELETE FROM plans WHERE id = 1;
-- ERROR: PROTECTED TABLE: DELETE not allowed on plans - system critical data
```

---

## Backup & Restore

### Backup erstellen

```bash
# Vollständiges Backup
docker exec assixx-postgres pg_dump -U assixx_user -d assixx > backups/full_backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only (keine Daten)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx --schema-only > backups/schema_only.sql

# Einzelne Tabelle
docker exec assixx-postgres pg_dump -U assixx_user -d assixx -t users > backups/users_backup.sql
```

### Restore

```bash
# Vollständiges Restore (Achtung: löscht existierende Daten!)
docker exec -i assixx-postgres psql -U assixx_user -d assixx < backups/backup.sql

# Einzelne Tabelle (mit Truncate vorher)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "TRUNCATE users CASCADE;"
docker exec -i assixx-postgres psql -U assixx_user -d assixx < backups/users_backup.sql
```

---

## Häufige Probleme

### Problem 1: RLS blockiert Query

```
ERROR: new row violates row-level security policy for table "users"
```

**Lösung:** Tenant Context setzen oder als `assixx_user` (BYPASSRLS) ausführen.

```bash
# Mit Tenant Context
docker exec assixx-postgres psql -U app_user -d assixx -c "
SET app.tenant_id = '1';
INSERT INTO users (tenant_id, ...) VALUES (1, ...);
"

# Oder als Admin (bypasses RLS)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "INSERT INTO users ..."
```

### Problem 2: ENUM Wert existiert nicht

```
ERROR: invalid input value for enum user_role: "new_role"
```

**Lösung:** ENUM erweitern

```sql
ALTER TYPE user_role ADD VALUE 'new_role';
```

### Problem 3: Foreign Key Constraint

```
ERROR: insert or update on table "X" violates foreign key constraint
```

**Lösung:** Abhängige Daten zuerst einfügen oder Constraint prüfen

```sql
-- Foreign Keys einer Tabelle anzeigen
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'your_table';
```

### Problem 4: Sequence out of sync

```
ERROR: duplicate key value violates unique constraint
```

**Lösung:** Sequence zurücksetzen

```sql
SELECT setval('table_name_id_seq', (SELECT MAX(id) FROM table_name));
```

---

## Nützliche Queries

### Datenbank-Übersicht

```sql
-- Alle Tabellen mit Zeilen-Anzahl
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Tabellen mit RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Tabellengröße
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### Schema-Informationen

```sql
-- Spalten einer Tabelle
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Indexes einer Tabelle
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users';
```

---

## Test Commands

```bash
# Quick Test Suite
echo "=== PostgreSQL Version ==="
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT version();"

echo "=== Table Count ==="
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';"

echo "=== RLS Enabled Tables ==="
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;"

echo "=== Connection Pool Status ==="
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'assixx';"
```

---

## pg_stat_statements - Query Performance Monitoring

### Was ist pg_stat_statements?

PostgreSQL Extension die alle Queries trackt und Performance-Statistiken sammelt.

```
┌─────────────────────────────────────────────────────────────┐
│  Jede Query wird normalisiert und getrackt:                 │
│                                                             │
│  SELECT * FROM users WHERE id = 123                         │
│  SELECT * FROM users WHERE id = 456                         │
│                 ↓                                           │
│  Normalisiert: SELECT * FROM users WHERE id = $1            │
│                                                             │
│  Statistiken: calls, total_time, mean_time, rows, etc.      │
└─────────────────────────────────────────────────────────────┘
```

### Konfiguration (automatisch in docker-compose.yml)

```yaml
command:
  - 'postgres'
  - '-c'
  - 'shared_preload_libraries=pg_stat_statements'
  - '-c'
  - 'pg_stat_statements.track=all'
  - '-c'
  - 'pg_stat_statements.max=10000'
  - '-c'
  - 'track_io_timing=on'
```

| Parameter                  | Wert               | Beschreibung                            |
| -------------------------- | ------------------ | --------------------------------------- |
| `shared_preload_libraries` | pg_stat_statements | Extension beim Start laden              |
| `pg_stat_statements.track` | all                | Alle Queries tracken (inkl. Funktionen) |
| `pg_stat_statements.max`   | 10000              | Max. 10.000 unique Queries speichern    |
| `track_io_timing`          | on                 | I/O-Zeiten pro Query messen             |

### Extension aktivieren (einmalig nach Container-Neustart)

```bash
# Extension erstellen (falls nicht vorhanden)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# Pruefen ob aktiviert
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';"
```

### Nuetzliche Queries

```sql
-- Top 10 langsamste Queries (nach Gesamtzeit)
SELECT
    left(query, 80) as query_preview,
    calls,
    round(total_exec_time::numeric, 2) as total_ms,
    round(mean_exec_time::numeric, 2) as avg_ms,
    rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- Haeufigste Queries (potentielle N+1 Probleme)
SELECT
    left(query, 80) as query_preview,
    calls,
    rows,
    round(mean_exec_time::numeric, 4) as avg_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY calls DESC
LIMIT 10;

-- Queries mit hohem I/O
SELECT
    left(query, 80) as query_preview,
    calls,
    round(blk_read_time::numeric, 2) as read_ms,
    round(blk_write_time::numeric, 2) as write_ms
FROM pg_stat_statements
WHERE blk_read_time > 0 OR blk_write_time > 0
ORDER BY (blk_read_time + blk_write_time) DESC
LIMIT 10;

-- Statistiken zuruecksetzen (nur wenn noetig)
SELECT pg_stat_statements_reset();
```

### Bash-Alias fuer schnellen Zugriff

```bash
# Top 10 langsame Queries
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT left(query, 60), calls, round(total_exec_time::numeric, 2) as total_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC LIMIT 10;"
```

### Best Practices

1. **Regelmaessig pruefen:** Wöchentlich Top-10 Queries analysieren
2. **Nach Deployments:** Neue langsame Queries identifizieren
3. **N+1 Detection:** Queries mit >1000 calls untersuchen
4. **Index-Optimierung:** Langsame Queries mit EXPLAIN ANALYZE pruefen
5. **Reset nach Optimierung:** Statistiken zuruecksetzen um Verbesserung zu messen

---

## Verwandte Dokumentation

- [POSTGRESQL-MIGRATION-PLAN.md](./POSTGRESQL-MIGRATION-PLAN.md) - Vollständiger Migrationsplan MySQL → PostgreSQL
- [DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md](./DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md) - Alte MySQL Anleitung (Backup)
- [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) - Datenbankstruktur

---

**Merke:** PostgreSQL mit RLS = Wasserdichte Multi-Tenant-Isolation auf DB-Ebene!
