# Database Migration Guide - PostgreSQL

> **Last Update:** 2026-01-27
> **Database:** PostgreSQL 17 with Row Level Security (RLS)
> **Migration Tool:** `node-pg-migrate` 8.x (TypeScript)
> **Previous Version:** See `DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md` for MySQL guide

---

## Quick Reference

| Setting            | Value                                |
| ------------------ | ------------------------------------ |
| **Container**      | `assixx-postgres`                    |
| **Port**           | `5432`                               |
| **Database**       | `assixx`                             |
| **App User**       | `app_user` (RLS enforced)            |
| **Admin User**     | `assixx_user` (superuser, BYPASSRLS) |
| **Tables**         | 109 total (84 mit RLS, 25 global)    |
| **RLS Policies**   | 89                                   |
| **Migration Tool** | `node-pg-migrate` 8.x                |
| **Tracking Table** | `pgmigrations`                       |
| **GUI Tool**       | DBeaver (Windows)                    |

---

## Architektur

```
/database/
├── migrations/                    ← node-pg-migrate TypeScript Migrationen
│   ├── 20260127000000_baseline.ts        (komplettes Schema)
│   ├── 20260127000001_drop-unused-tables.ts
│   ├── 20260127000002_feature-visits.ts
│   ├── ...                               (UTC-Timestamp + Beschreibung)
│   ├── template.ts                       (Referenz-Template, KEIN Migration)
│   └── archive/                          (originale SQL-Dateien, historisch)
│       ├── 001_baseline_complete_schema.sql
│       ├── 002_seed_data.sql
│       └── ...
├── seeds/                         ← Idempotente Seed-Daten (separate!)
│   └── 001_global-seed-data.sql          (ON CONFLICT DO NOTHING)
└── backups/                       ← pg_dump Backups

/customer/fresh-install/           ← Kunden-Deployment (in .gitignore)
├── 001_schema.sql
├── 002_seed_data.sql
├── install.sh
└── README.md

/scripts/
├── run-migrations.sh              ← DATABASE_URL Wrapper fuer node-pg-migrate
└── run-seeds.sh                   ← Seed Runner (psql)
```

**Wichtig:**

- `database/migrations/*.ts` = Inkrementelle Migration-Historie, im Git
- `database/seeds/` = Seed-Daten (global, kein tenant_id), im Git
- `database/migrations/archive/` = Originale SQL-Dateien (historisch, nicht mehr direkt ausgefuehrt)
- `customer/fresh-install/` = Kopie fuer Kunden, in .gitignore

---

## Credentials

Siehe `docker/.env` fuer Passwoerter.

| User          | Zweck              | RLS                 | DDL-Rechte |
| ------------- | ------------------ | ------------------- | ---------- |
| `app_user`    | Backend-Verbindung | Ja (unterliegt RLS) | Nein       |
| `assixx_user` | Migrationen, Admin | Nein (BYPASSRLS)    | Ja         |

**Migrationen MUESSEN als `assixx_user` ausgefuehrt werden** - `app_user` hat keine DDL-Rechte (kein CREATE TABLE, ALTER, DROP).

---

## Migration CLI Commands

Alle Befehle ueber Doppler ausfuehren (Secrets werden injected):

```bash
# Migration ausfuehren (alle pending)
doppler run -- ./scripts/run-migrations.sh up

# Letzte Migration zurueckrollen
doppler run -- ./scripts/run-migrations.sh down

# Dry-Run (zeigt was passieren wuerde, fuehrt nichts aus)
doppler run -- ./scripts/run-migrations.sh up --dry-run

# Neue Migration erstellen (UTC-Timestamp + Name)
doppler run -- pnpm run db:migrate:create add-employee-skills
# → database/migrations/20260128XXXXXX_add-employee-skills.ts

# Redo (down + up der letzten Migration)
doppler run -- ./scripts/run-migrations.sh redo

# Seeds anwenden (idempotent, sicher mehrfach ausfuehrbar)
doppler run -- pnpm run db:seed

# Status pruefen (welche Migrationen wurden ausgefuehrt?)
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"
```

**Alternative ohne Doppler** (fuer lokale Entwicklung mit docker/.env):

```bash
# Env-Vars manuell setzen und Migration ausfuehren
export POSTGRES_USER=assixx_user
export POSTGRES_PASSWORD=<aus docker/.env>
export POSTGRES_DB=assixx
export DB_HOST=localhost
export DB_PORT=5432
./scripts/run-migrations.sh up
```

---

## Workflow: Neue Migration erstellen

### 1. Migration-Datei generieren

```bash
doppler run -- pnpm run db:migrate:create add-employee-skills
```

Dies erstellt `database/migrations/20260128XXXXXX_add-employee-skills.ts`.

### 2. Migration implementieren

Oeffne die generierte Datei und implementiere `up()` und `down()`:

```typescript
/**
 * Migration: Add employee skills tracking
 *
 * Purpose: Enable skill management for workforce planning
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS employee_skills (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_name VARCHAR(255) NOT NULL,
        skill_level INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_employee_skills_tenant
    ON employee_skills(tenant_id);

    CREATE INDEX IF NOT EXISTS idx_employee_skills_employee
    ON employee_skills(employee_id);

    -- RLS (PFLICHT bei tenant-isolated tables!)
    ALTER TABLE employee_skills ENABLE ROW LEVEL SECURITY;
    ALTER TABLE employee_skills FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON employee_skills
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Permissions fuer app_user (PFLICHT!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON employee_skills TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE employee_skills_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS employee_skills CASCADE;`);
}
```

**Siehe auch:** `database/migrations/template.ts` fuer vollstaendiges Referenz-Template.

### 3. Dry-Run

```bash
doppler run -- ./scripts/run-migrations.sh up --dry-run
```

### 4. Migration ausfuehren

```bash
# Backup erstellen (PFLICHT!)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/full_backup_${TIMESTAMP}.dump

# Migration ausfuehren
doppler run -- ./scripts/run-migrations.sh up
```

### 5. Verifizieren

```bash
# Tabelle pruefen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d employee_skills"

# RLS Policy pruefen
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM pg_policies WHERE tablename = 'employee_skills';"

# Migration in Tracking-Tabelle pruefen
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"

# Backend neustarten
cd /home/scs/projects/Assixx/docker && docker-compose restart backend deletion-worker
```

### 6. Customer Fresh-Install aktualisieren (PFLICHT!)

```bash
# Automatisch: Schema, Seeds und pgmigrations synchronisieren
./scripts/sync-customer-migrations.sh
```

Das Script macht:

1. Schema dumpen → `database/migrations/archive/001_baseline_complete_schema.sql` + `customer/fresh-install/001_schema.sql`
2. Seed-Data dumpen → `customer/fresh-install/002_seed_data.sql`
3. `005_pgmigrations.sql` generieren (registriert alle Migrationen fuer node-pg-migrate)

---

## Rollback (Migration zurueckrollen)

```bash
# Letzte Migration zurueckrollen
doppler run -- ./scripts/run-migrations.sh down

# ACHTUNG: Nicht alle Migrationen sind reversibel!
# z.B. ENUM-Werte koennen in PostgreSQL NICHT entfernt werden.
# Solche Migrationen werfen einen Error in down().
```

**Irreversible Migrationen:**

- ENUM-Wert hinzufuegen (`ALTER TYPE ... ADD VALUE`)
- Daten-Migrationen (Daten wurden transformiert)
- Baseline (vollstaendiges Schema droppen ist keine Option)

---

## Seeds

Seeds sind **globale Konfigurationsdaten** ohne tenant_id:

| Tabelle              | Rows | Beschreibung                                          |
| -------------------- | ---- | ----------------------------------------------------- |
| `plans`              | 3    | Subscription-Plaene (Basic, Professional, Enterprise) |
| `features`           | 12   | Verfuegbare Features                                  |
| `plan_features`      | 36   | Zuordnung Plan zu Features                            |
| `kvp_categories`     | 6    | KVP Vorschlagskategorien                              |
| `machine_categories` | 11   | Maschinenkategorien                                   |

```bash
# Seeds anwenden (idempotent - sicher mehrfach ausfuehrbar)
doppler run -- pnpm run db:seed

# Seeds verwenden ON CONFLICT (id) DO NOTHING
# und synchronisieren Sequences automatisch
```

**Neue Seed-Daten hinzufuegen:** Datei in `database/seeds/` erstellen (z.B. `002_new-seed.sql`). Dateien werden alphabetisch sortiert ausgefuehrt.

---

## Bestehende DB migrieren (Day 1 Setup)

Fuer existierende Datenbanken die bereits alle Migrationen manuell ausgefuehrt haben:

```bash
# 1. Backup erstellen
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/pre-node-pg-migrate.dump

# 2. Alle 15 Migrationen als "bereits ausgefuehrt" markieren (KEIN SQL wird ausgefuehrt!)
doppler run -- ./scripts/run-migrations.sh up --fake

# 3. Verifizieren: 15 Eintraege in pgmigrations
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"

# 4. Seeds anwenden (idempotent, sicher)
doppler run -- pnpm run db:seed
```

**Was macht `--fake`?** Markiert Migrationen in der `pgmigrations`-Tabelle als ausgefuehrt, ohne das SQL tatsaechlich auszufuehren. Noetig wenn die DB bereits auf dem aktuellen Stand ist.

---

## Migrations-Dateien Uebersicht

| Datei                                                      | Inhalt                                   |
| ---------------------------------------------------------- | ---------------------------------------- |
| `20260127000000_baseline.ts`                               | Komplettes Schema (109 Tabellen, 89 RLS) |
| `20260127000001_drop-unused-tables.ts`                     | 16 unused tables entfernt                |
| `20260127000002_feature-visits.ts`                         | Feature Visit Tracking mit RLS           |
| `20260127000003_notification-feature-id.ts`                | ADR-004 notification feature_id          |
| `20260127000004_audit-log-partitioning.ts`                 | Monatliche Partitionierung               |
| `20260127000005_blackboard-status-to-is-active.ts`         | ENUM zu INTEGER Migration                |
| `20260127000006_chat-per-user-soft-delete.ts`              | WhatsApp-style "Delete for me"           |
| `20260127000007_audit-trail-request-id.ts`                 | UUID Request Correlation                 |
| `20260127000008_kvp-comments-admin-only-trigger.ts`        | Admin-only Kommentar Trigger             |
| `20260127000009_kvp-daily-limit-trigger.ts`                | Rate Limiting Trigger                    |
| `20260127000010_kvp-confirmations.ts`                      | Read-Tracking mit RLS                    |
| `20260127000011_blackboard-confirmations-first-seen.ts`    | Neu-Badge vs. Read-Status                |
| `20260127000012_kvp-confirmations-first-seen.ts`           | Selbes Pattern fuer KVP                  |
| `20260127000013_kvp-status-restored.ts`                    | ENUM-Wert "restored" hinzugefuegt        |
| `20260127000014_remove-deprecated-availability-columns.ts` | Daten-Migration + Column Drop            |

---

## Config-Dateien

### `.node-pg-migraterc.json` (Root)

```json
{
  "migrationsDir": "database/migrations",
  "migrationsTable": "pgmigrations",
  "schema": "public",
  "checkOrder": true,
  "verbose": true,
  "decamelize": true,
  "migrationFilenameFormat": "utc",
  "migrationFileLanguage": "ts"
}
```

### `scripts/run-migrations.sh`

Wrapper-Script das `DATABASE_URL` aus Doppler-Env-Vars konstruiert:

- Verwendet `POSTGRES_USER` / `POSTGRES_PASSWORD` (assixx_user)
- Erkennt Docker-Hostname (`DB_HOST=postgres` → `localhost`)
- Leitet alle Argumente an `pnpm run db:migrate` weiter

---

## Connection Commands

### Via Docker (Empfohlen)

```bash
# Interaktive psql Shell
docker exec -it assixx-postgres psql -U assixx_user -d assixx

# Einzelner SQL Befehl
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT 1;"

# SQL-Datei ausfuehren
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/migration.sql

# Mit app_user (RLS aktiv - fuer Tests)
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

### VOR der Migration

- [ ] Backup erstellt (`pg_dump --format=custom --compress=9`)
- [ ] Dry-Run ausgefuehrt (`./scripts/run-migrations.sh up --dry-run`)
- [ ] RLS Policy vorhanden (fuer tenant-isolated tables)
- [ ] GRANTs fuer `app_user` vorhanden
- [ ] `down()` implementiert (oder Error fuer irreversible Migrationen)

### NACH der Migration

- [ ] `pgmigrations` Tabelle geprueft
- [ ] Tabellen/Spalten verifiziert
- [ ] RLS Policies geprueft (`pg_policies`)
- [ ] Backend neugestartet
- [ ] Customer Fresh-Install aktualisiert

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
│  Kein "AND tenant_id = ?" mehr in Queries noetig!           │
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
-- Standard RLS Policy fuer Tenant-Tabellen
-- WICHTIG: NULLIF() im ersten Teil ist PFLICHT!
-- Nach set_config() + COMMIT wird app.tenant_id zu '' (empty string), NICHT NULL!
-- Ohne NULLIF wuerde '' IS NULL = FALSE → RLS blockiert ALLES!
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

-- ENUM erweitern (Wert hinzufuegen)
ALTER TYPE user_role ADD VALUE 'manager' AFTER 'admin';

-- ACHTUNG: ENUM-Werte koennen NICHT entfernt werden in PostgreSQL!
-- down() Migrations muessen einen Error werfen.
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

Diese Tabellen sind vor DELETE geschuetzt:

- `plans` - Subscription Plaene
- `features` - Verfuegbare Features
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
# Vollstaendiges Backup (komprimiert - EMPFOHLEN)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/full_backup_$(date +%Y%m%d_%H%M%S).dump

# Vollstaendiges Backup (SQL-Format)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    > database/backups/full_backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only (keine Daten)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx --schema-only \
    > database/backups/schema_only.sql

# Einzelne Tabelle
docker exec assixx-postgres pg_dump -U assixx_user -d assixx -t users \
    > database/backups/users_backup.sql
```

### Restore

```bash
# Aus .dump (pg_restore)
docker exec -i assixx-postgres pg_restore -U assixx_user -d assixx \
    < database/backups/full_backup_XXXXXX.dump

# Aus .sql
docker exec -i assixx-postgres psql -U assixx_user -d assixx \
    < database/backups/backup.sql

# WICHTIG: Nach Restore GRANTs wiederherstellen!
cd /home/scs/projects/Assixx/customer/fresh-install && ./install.sh --grants-only
```

> **WICHTIG:** Nach einem Restore fehlen die GRANTs fuer `app_user` weil das Backup mit `--no-privileges` erstellt wird. Ohne GRANTs bekommt das Backend "permission denied" Fehler!

---

## Haeufige Probleme

### Problem 1: RLS blockiert Query

```
ERROR: new row violates row-level security policy for table "users"
```

**Loesung:** Tenant Context setzen oder als `assixx_user` (BYPASSRLS) ausfuehren.

### Problem 2: ENUM Wert existiert nicht

```
ERROR: invalid input value for enum user_role: "new_role"
```

**Loesung:** ENUM erweitern mit Migration:

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'new_role';
```

### Problem 3: Foreign Key Constraint

```
ERROR: insert or update on table "X" violates foreign key constraint
```

**Loesung:** Abhaengige Daten zuerst einfuegen oder Constraint pruefen:

```sql
SELECT tc.constraint_name, kcu.column_name,
       ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'your_table';
```

### Problem 4: Sequence out of sync

```
ERROR: duplicate key value violates unique constraint
```

**Loesung:** Sequence zuruecksetzen:

```sql
SELECT setval('table_name_id_seq', (SELECT MAX(id) FROM table_name));
```

### Problem 5: Migration fehlgeschlagen (partial apply)

```
ERROR: relation "xxx" already exists
```

**Loesung:** Migration verwendet `IF NOT EXISTS` / `IF EXISTS` fuer Idempotenz. Falls nicht:

```bash
# Manuell fixen, dann als "already applied" markieren
doppler run -- ./scripts/run-migrations.sh up --fake
```

---

## Nuetzliche Queries

### Datenbank-Uebersicht

```sql
-- Alle Tabellen mit Zeilen-Anzahl
SELECT schemaname, relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- Tabellen mit RLS
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;

-- Tabellengroesse
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Migration-Status
SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;
```

### Schema-Informationen

```sql
-- Spalten einer Tabelle
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Indexes einer Tabelle
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';
```

---

## Test Commands

```bash
# Quick Test Suite
echo "=== PostgreSQL Version ==="
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT version();"

echo "=== Table Count ==="
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';"

echo "=== RLS Enabled Tables ==="
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;"

echo "=== Migration Status ==="
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT COUNT(*) as applied_migrations FROM pgmigrations;"

echo "=== Connection Pool Status ==="
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'assixx';"
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

### Extension aktivieren (einmalig nach Container-Neustart)

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

### Nuetzliche Queries

```sql
-- Top 10 langsamste Queries (nach Gesamtzeit)
SELECT left(query, 80) as query_preview, calls,
       round(total_exec_time::numeric, 2) as total_ms,
       round(mean_exec_time::numeric, 2) as avg_ms, rows
FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC LIMIT 10;

-- Haeufigste Queries (potentielle N+1 Probleme)
SELECT left(query, 80) as query_preview, calls, rows,
       round(mean_exec_time::numeric, 4) as avg_ms
FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%'
ORDER BY calls DESC LIMIT 10;
```

---

## is_active Convention

Konsistente Status-Werte fuer alle Tabellen:

| Wert | Bedeutung | Beschreibung                          |
| ---- | --------- | ------------------------------------- |
| `0`  | inactive  | Deaktiviert, nicht sichtbar           |
| `1`  | active    | Aktiv, normal sichtbar                |
| `3`  | archive   | Archiviert, nur ueber Filter sichtbar |
| `4`  | deleted   | Soft Delete, nicht sichtbar           |

---

## Verwandte Dokumentation

- [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) - Datenbankstruktur und Tabellen-Uebersicht
- [POSTGRESQL-MIGRATION-PLAN.md](./POSTGRESQL-MIGRATION-PLAN.md) - Historischer Migrationsplan MySQL → PostgreSQL
- [DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md](./DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md) - Alte MySQL Anleitung (Backup)

---

**Merke:** PostgreSQL mit RLS = Wasserdichte Multi-Tenant-Isolation auf DB-Ebene!
