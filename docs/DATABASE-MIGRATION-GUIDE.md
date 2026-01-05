# Database Migration Guide - PostgreSQL

> **Last Update:** 2026-01-05
> **Database:** PostgreSQL 17 with Row Level Security (RLS)
> **Previous Version:** See `DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md` for MySQL guide

---

## Quick Reference

| Setting        | Value                                |
| -------------- | ------------------------------------ |
| **Container**  | `assixx-postgres`                    |
| **Port**       | `5432`                               |
| **Database**   | `assixx`                             |
| **App User**   | `app_user` (RLS enforced)            |
| **Admin User** | `assixx_user` (superuser, BYPASSRLS) |
| **Tables**     | 119 total (95 with RLS, 24 global)   |
| **GUI Tool**   | DBeaver (Windows)                    |

---

## Credentials

Siehe `docker/.env` für Passwörter.

| User | Zweck | RLS |
|------|-------|-----|
| `app_user` | Backend-Verbindung | Ja (unterliegt RLS) |
| `assixx_user` | Migrationen, Admin | Nein (BYPASSRLS) |

Für Migrationen immer `assixx_user` verwenden.

---

## Quick Migration (2-3 Minuten)

```bash
# 1. Backup erstellen (30 Sekunden)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Migration ausführen (1 Minute)
MIGRATION_FILE="database/migrations/XXX-your-migration.sql"
docker cp $MIGRATION_FILE assixx-postgres:/tmp/
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/$(basename $MIGRATION_FILE)

# 3. Verifizieren (30 Sekunden)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt"
```

---

## Migration Workflow

### System-Tabellen (Seed-Daten)

Diese Tabellen enthalten globale Konfiguration und unterliegen NICHT der RLS:

| Tabelle | Beschreibung | RLS |
|---------|--------------|-----|
| `plans` | Subscription-Pläne (Basic, Professional, Enterprise) | Nein |
| `features` | Verfügbare Features | Nein |
| `plan_features` | Zuordnung Plan zu Features | Nein |

Alle anderen Tabellen mit `tenant_id` unterliegen der Row Level Security.

### Migrations-Dateien

Pfad: `/database/migrations/`

| Datei | Inhalt |
|-------|--------|
| `001_baseline_complete_schema.sql` | Komplettes Schema (Tabellen, Indexes, RLS, Triggers) |
| `002_seed_data.sql` | System-Tabellen Daten |
| `003_xxx.sql` | Inkrementelle Änderungen |

### Workflow: Schema oder Seed ändern

```bash
# 1. Backup erstellen (PFLICHT)
cd /home/scs/projects/Assixx/docker
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx --schema-only > ../database/backups/schema_${TIMESTAMP}.sql
docker exec assixx-postgres pg_dump -U assixx_user -d assixx --data-only --inserts -t plans -t features -t plan_features > ../database/backups/seed_${TIMESTAMP}.sql

# 2. Migration erstellen und ausführen
docker cp ../database/migrations/003_name.sql assixx-postgres:/tmp/
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/003_name.sql

# 3. Backend neustarten
docker-compose restart backend
```

### Backup-Verzeichnis

Pfad: `/database/backups/` - Schema und Seed Backups vor Änderungen.

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

## Verwandte Dokumentation

- [POSTGRESQL-MIGRATION-PLAN.md](./POSTGRESQL-MIGRATION-PLAN.md) - Vollständiger Migrationsplan MySQL → PostgreSQL
- [DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md](./DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md) - Alte MySQL Anleitung (Backup)
- [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) - Datenbankstruktur

---

**Merke:** PostgreSQL mit RLS = Wasserdichte Multi-Tenant-Isolation auf DB-Ebene!
