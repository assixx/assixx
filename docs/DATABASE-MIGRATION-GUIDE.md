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
| **Tables**         | 128 base (109 with RLS, 19 global) + partitions |
| **RLS Policies**   | 114                                  |
| **Migration Tool** | `node-pg-migrate` 8.x                |
| **Tracking Table** | `pgmigrations`                       |
| **GUI Tool**       | DBeaver (Windows)                    |

---

## Architecture

```
/database/
├── migrations/                    <- node-pg-migrate TypeScript migrations
│   ├── 20260127000000_baseline.ts        (complete schema)
│   ├── 20260127000001_drop-unused-tables.ts
│   ├── 20260127000002_feature-visits.ts
│   ├── ...                               (UTC timestamp + description)
│   ├── template.ts                       (reference template, NOT a migration)
│   └── archive/                          (original SQL files, historical)
│       ├── 001_baseline_complete_schema.sql
│       ├── 002_seed_data.sql
│       └── ...
├── seeds/                         <- Idempotent seed data (separate!)
│   └── 001_global-seed-data.sql          (ON CONFLICT DO NOTHING)
└── backups/                       <- pg_dump backups

/customer/fresh-install/           <- Customer deployment (in .gitignore)
├── 001_schema.sql
├── 002_seed_data.sql
├── install.sh
└── README.md

/scripts/
├── run-migrations.sh              <- DATABASE_URL wrapper for node-pg-migrate
└── run-seeds.sh                   <- Seed runner (psql)
```

**Important:**

- `database/migrations/*.ts` = Incremental migration history, in Git
- `database/seeds/` = Seed data (global, no tenant_id), in Git
- `database/migrations/archive/` = Original SQL files (historical, no longer executed directly)
- `customer/fresh-install/` = Copy for customers, in .gitignore

---

## Credentials

See `docker/.env` for passwords.

| User          | Purpose            | RLS                  | DDL Rights |
| ------------- | ------------------ | -------------------- | ---------- |
| `app_user`    | Backend connection | Yes (subject to RLS) | No         |
| `assixx_user` | Migrations, admin  | No (BYPASSRLS)       | Yes        |

**Migrations MUST be run as `assixx_user`** — `app_user` has no DDL rights (no CREATE TABLE, ALTER, DROP).

---

## Migration CLI Commands

All commands run via Doppler (secrets are injected):

```bash
# Run migrations (all pending)
doppler run -- ./scripts/run-migrations.sh up

# Roll back last migration
doppler run -- ./scripts/run-migrations.sh down

# Dry run (shows what would happen, executes nothing)
doppler run -- ./scripts/run-migrations.sh up --dry-run

# Create new migration (UTC timestamp + name)
doppler run -- pnpm run db:migrate:create add-employee-skills
# -> database/migrations/20260128XXXXXX_add-employee-skills.ts

# Redo (down + up of the last migration)
doppler run -- ./scripts/run-migrations.sh redo

# Apply seeds (idempotent, safe to run multiple times)
doppler run -- pnpm run db:seed

# Check status (which migrations have been applied?)
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"
```

**Alternative without Doppler** (for local development with docker/.env):

```bash
# Set env vars manually and run migration
export POSTGRES_USER=assixx_user
export POSTGRES_PASSWORD=<from docker/.env>
export POSTGRES_DB=assixx
export DB_HOST=localhost
export DB_PORT=5432
./scripts/run-migrations.sh up
```

---

## Workflow: Creating a New Migration

### 1. Generate Migration File

```bash
doppler run -- pnpm run db:migrate:create add-employee-skills
```

This creates `database/migrations/20260128XXXXXX_add-employee-skills.ts`.

### 2. Implement Migration

Open the generated file and implement `up()` and `down()`:

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

    -- RLS (MANDATORY for tenant-isolated tables!)
    ALTER TABLE employee_skills ENABLE ROW LEVEL SECURITY;
    ALTER TABLE employee_skills FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON employee_skills
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON employee_skills TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE employee_skills_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS employee_skills CASCADE;`);
}
```

**See also:** `database/migrations/template.ts` for the complete reference template.

### 3. Dry Run

```bash
doppler run -- ./scripts/run-migrations.sh up --dry-run
```

### 4. Run Migration

```bash
# Create backup (MANDATORY!)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/full_backup_${TIMESTAMP}.dump

# Run migration
doppler run -- ./scripts/run-migrations.sh up
```

### 5. Verify

```bash
# Check table
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d employee_skills"

# Check RLS policy
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM pg_policies WHERE tablename = 'employee_skills';"

# Check migration in tracking table
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"

# Restart backend
cd /home/scs/projects/Assixx/docker && docker-compose restart backend deletion-worker
```

### 6. Update Customer Fresh-Install (MANDATORY!)

```bash
# Automatic: Sync schema, seeds, and pgmigrations
./scripts/sync-customer-migrations.sh
```

The script does:

1. Dump schema -> `database/migrations/archive/001_baseline_complete_schema.sql` + `customer/fresh-install/001_schema.sql`
2. Dump seed data -> `customer/fresh-install/002_seed_data.sql`
3. Generate `005_pgmigrations.sql` (registers all migrations for node-pg-migrate)

---

## Rollback (Rolling Back a Migration)

```bash
# Roll back last migration
doppler run -- ./scripts/run-migrations.sh down

# WARNING: Not all migrations are reversible!
# e.g. ENUM values CANNOT be removed in PostgreSQL.
# Such migrations throw an error in down().
```

**Irreversible Migrations:**

- Data migrations (data was transformed, no way to reconstruct)
- Baseline (dropping the complete schema is not an option)

**Note on ENUMs:** `ALTER TYPE ... ADD VALUE` cannot be rolled back in the same
transaction. Removing ENUM values requires the detach-drop-recreate pattern
(see migration 038 for example). Both directions are possible if data is
truncated or converted first.

---

## Seeds

Seeds are **global configuration data** without tenant_id:

| Table                | Rows | Description                                          |
| -------------------- | ---- | ---------------------------------------------------- |
| `plans`              | 3    | Subscription plans (Basic, Professional, Enterprise) |
| `features`           | 12   | Available features                                   |
| `plan_features`      | 36   | Plan-to-feature mapping                              |
| `kvp_categories`     | 6    | KVP proposal categories                              |
| `machine_categories` | 11   | Machine categories                                   |

```bash
# Apply seeds (idempotent — safe to run multiple times)
doppler run -- pnpm run db:seed

# Seeds use ON CONFLICT (id) DO NOTHING
# and synchronize sequences automatically
```

**Adding new seed data:** Create a file in `database/seeds/` (e.g. `002_new-seed.sql`). Files are executed in alphabetical order.

---

## Migrating an Existing DB (Day 1 Setup)

For existing databases that have already had all migrations applied manually:

```bash
# 1. Create backup
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/pre-node-pg-migrate.dump

# 2. Mark all 15 migrations as "already applied" (NO SQL is executed!)
doppler run -- ./scripts/run-migrations.sh up --fake

# 3. Verify: 15 entries in pgmigrations
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"

# 4. Apply seeds (idempotent, safe)
doppler run -- pnpm run db:seed
```

**What does `--fake` do?** Marks migrations in the `pgmigrations` table as applied without actually executing the SQL. Needed when the DB is already up to date.

---

## Migration Files Overview

| File                                                       | Content                              |
| ---------------------------------------------------------- | ------------------------------------ |
| `20260127000000_baseline.ts`                               | Complete schema (baseline, 89 RLS at time of creation) |
| `20260127000001_drop-unused-tables.ts`                     | 16 unused tables removed             |
| `20260127000002_feature-visits.ts`                         | Feature visit tracking with RLS      |
| `20260127000003_notification-feature-id.ts`                | ADR-004 notification feature_id      |
| `20260127000004_audit-log-partitioning.ts`                 | Monthly partitioning                 |
| `20260127000005_blackboard-status-to-is-active.ts`         | ENUM to INTEGER migration            |
| `20260127000006_chat-per-user-soft-delete.ts`              | WhatsApp-style "Delete for me"       |
| `20260127000007_audit-trail-request-id.ts`                 | UUID request correlation             |
| `20260127000008_kvp-comments-admin-only-trigger.ts`        | Admin-only comment trigger           |
| `20260127000009_kvp-daily-limit-trigger.ts`                | Rate limiting trigger                |
| `20260127000010_kvp-confirmations.ts`                      | Read tracking with RLS               |
| `20260127000011_blackboard-confirmations-first-seen.ts`    | New badge vs. read status            |
| `20260127000012_kvp-confirmations-first-seen.ts`           | Same pattern for KVP                 |
| `20260127000013_kvp-status-restored.ts`                    | ENUM value "restored" added          |
| `20260127000014_remove-deprecated-availability-columns.ts` | Data migration + column drop         |

---

## Config Files

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

Wrapper script that constructs `DATABASE_URL` from Doppler env vars:

- Uses `POSTGRES_USER` / `POSTGRES_PASSWORD` (assixx_user)
- Detects Docker hostname (`DB_HOST=postgres` -> `localhost`)
- Forwards all arguments to `pnpm run db:migrate`

---

## Connection Commands

### Via Docker (Recommended)

```bash
# Interactive psql shell
docker exec -it assixx-postgres psql -U assixx_user -d assixx

# Single SQL command
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT 1;"

# Execute SQL file
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/migration.sql

# With app_user (RLS active — for testing)
docker exec assixx-postgres psql -U app_user -d assixx -c "SELECT * FROM users;"
```

### Via DBeaver (Windows)

```
Host: localhost
Port: 5432
Database: assixx
User: assixx_user (Admin) or app_user (RLS)
Password: see docker/.env
```

> **Tip:** Install DBeaver on Windows, NOT in WSL. Docker exposes ports automatically.

---

## Migration Checklist

### BEFORE the Migration

- [ ] Backup created (`pg_dump --format=custom --compress=9`)
- [ ] Dry run executed (`./scripts/run-migrations.sh up --dry-run`)
- [ ] RLS policy present (for tenant-isolated tables)
- [ ] GRANTs for `app_user` present
- [ ] `down()` implemented (or error for irreversible migrations)

### AFTER the Migration

- [ ] `pgmigrations` table checked
- [ ] Tables/columns verified
- [ ] RLS policies checked (`pg_policies`)
- [ ] Backend restarted
- [ ] Customer fresh-install updated

---

## Migration Quality Standards (Verbindlich)

> **Jede neue Migration MUSS diese Regeln einhalten. Verstöße blockieren den PR.**

### Verbotene Patterns (NEVER)

| Pattern                                        | Warum verboten                                                   | Richtige Alternative                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `TRUNCATE` in Migrations                       | Löscht Produktionsdaten unwiderruflich                           | `UPDATE ... SET` zum Remappen, oder separate Data-Migration                             |
| `IF NOT EXISTS` im `up()`                      | Maskiert fehlgeschlagene Partial-Applies statt laut zu scheitern | Nur `CREATE TABLE` / `ADD COLUMN` ohne Guard — Migration-Runner garantiert Einmaligkeit |
| Stille Data-Fixes (`UPDATE` vor Schema-Change) | Versteckt Datenprobleme statt sie zu lösen                       | `RAISE EXCEPTION` wenn Daten nicht passen (Vorbild: Migration 028)                      |
| `RAISE NOTICE` bei Datenverlust                | Warnt aber löscht trotzdem — schlimmer als nichts                | `RAISE EXCEPTION` — Migration MUSS abbrechen                                            |
| Schema + Data in einer Migration               | Partial Failure zerstört Daten ohne Rollback-Möglichkeit         | Separate Migrations: (1) Schema-DDL, (2) Data-Backfill, (3) Cleanup                     |
| Hardcoded Year-Ranges (Partitionen)            | Zeitbombe — INSERTs scheitern nach Ablauf                        | Mindestens 5 Jahre voraus + Kommentar wann nächste Erweiterung nötig                    |
| `ON CONFLICT DO NOTHING` ohne Kommentar        | Schluckt Duplikate still — maskiert Korruptionsrisiko            | Expliziter Kommentar WARUM, oder `ON CONFLICT DO UPDATE`                                |
| MySQL-Legacy-Namen (`idx_19037_*`, `_ibfk_*`)  | Fragile OID-basierte Namen brechen in anderen Umgebungen         | Aussagekräftige Namen: `idx_tablename_column`                                           |

### Pflicht-Patterns (ALWAYS)

- **FAIL LOUD**: Wenn bestehende Daten die Migration blockieren könnten → `DO $$ ... RAISE EXCEPTION` Pre-Check (Vorbild: Migration 028 `teams-deputy-lead`)
- **`IF EXISTS` nur in `down()`**: Rollbacks dürfen defensiv sein, `up()` nicht
- **Enum-Addition**: `ADD VALUE IF NOT EXISTS` ist erlaubt (PostgreSQL Enum-Sonderfall, keine Transaktion möglich)
- **Feature-Flag-Inserts**: `ON CONFLICT (code) DO NOTHING` ist erlaubt für Seed-Daten — mit Kommentar
- **Lossy Rollback dokumentieren**: Wenn `down()` Daten nicht wiederherstellen kann → Kommentar im Header: `WARNING: One-way migration. Rollback does NOT restore converted data.`
- **Partitionen**: Bei Erstellung immer ≥5 Jahre voraus + Kommentar: `Next action required: Before YYYY, create migration for YYYY-YYYY+4`

### Pre-Commit Checklist für neue Migrations

```
- [ ] Kein TRUNCATE
- [ ] Kein IF NOT EXISTS im up() (außer ENUM ADD VALUE)
- [ ] Kein stiller UPDATE vor Schema-Change (RAISE EXCEPTION stattdessen)
- [ ] Schema und Data sind getrennte Migrations (wenn beides nötig)
- [ ] down() dokumentiert wenn lossy
- [ ] Keine hardcoded IDs, OIDs, oder environment-spezifische Werte
- [ ] Keine MySQL-Legacy-Namen (idx_NNNNN_*, _ibfk_*)
- [ ] RLS Policy + GRANTs vorhanden (für tenant-isolierte Tabellen)
- [ ] Kein IF EXISTS im up() (Ausnahme: DROP vor REPLACE bei Triggern)
```

---

## PostgreSQL vs MySQL Syntax

| MySQL                     | PostgreSQL                                 | Note                    |
| ------------------------- | ------------------------------------------ | ----------------------- |
| `AUTO_INCREMENT`          | `SERIAL` or `GENERATED ALWAYS AS IDENTITY` |                         |
| `?` Placeholder           | `$1, $2, $3`                               | In queries              |
| `LIMIT ?, ?`              | `LIMIT $1 OFFSET $2`                       |                         |
| `` `column` ``            | `"column"`                                 | Quoting                 |
| `IFNULL(a, b)`            | `COALESCE(a, b)`                           |                         |
| `NOW()`                   | `NOW()`                                    | Identical               |
| `DATETIME`                | `TIMESTAMPTZ`                              | With timezone           |
| `TINYINT(1)`              | `BOOLEAN`                                  |                         |
| `JSON`                    | `JSONB`                                    | Better! Native indexing |
| `ENUM('a','b')`           | `CREATE TYPE ... AS ENUM`                  | Own type                |
| `ON DUPLICATE KEY UPDATE` | `ON CONFLICT ... DO UPDATE`                | Upsert                  |

---

## Row Level Security (RLS)

### Concept

```
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL with RLS                                          │
│                                                             │
│  Request -> app_user -> SET app.tenant_id = X -> Query       │
│                                                             │
│  SELECT * FROM users;                                       │
│  ↓ (RLS policy filters automatically)                      │
│  SELECT * FROM users WHERE tenant_id = X;                   │
│                                                             │
│  No more "AND tenant_id = ?" needed in queries!             │
└─────────────────────────────────────────────────────────────┘
```

### Setting Tenant Context (Backend)

```typescript
// Automatically implemented in db.ts
const client = await pool.connect();
await client.query('SET app.tenant_id = $1', [tenantId.toString()]);
```

### RLS Policy Template

```sql
-- Standard RLS policy for tenant tables
-- IMPORTANT: NULLIF() in the first part is MANDATORY!
-- After set_config() + COMMIT, app.tenant_id becomes '' (empty string), NOT NULL!
-- Without NULLIF, '' IS NULL = FALSE -> RLS blocks EVERYTHING!
CREATE POLICY tenant_isolation ON table_name
    FOR ALL
    USING (
        -- Root/Admin access (no tenant context or empty string)
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        -- Or matching tenant
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );
```

### Testing RLS

```bash
# As app_user WITH tenant context
docker exec assixx-postgres psql -U app_user -d assixx -c "
SET app.tenant_id = '1';
SELECT COUNT(*) FROM users;  -- Only Tenant 1 data
"

# As app_user WITHOUT tenant context (root access)
docker exec assixx-postgres psql -U app_user -d assixx -c "
SELECT COUNT(*) FROM users;  -- All data (if policy allows)
"

# Show RLS policies
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT tablename, policyname, qual FROM pg_policies WHERE schemaname = 'public';
"
```

---

## ENUM Types

PostgreSQL ENUMs are strict types:

```sql
-- Create ENUM
CREATE TYPE user_role AS ENUM ('root', 'admin', 'employee');

-- Use ENUM
CREATE TABLE users (
    role user_role DEFAULT 'employee'
);

-- Show ENUM values
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype;

-- Extend ENUM (add value)
ALTER TYPE user_role ADD VALUE 'manager' AFTER 'admin';

-- NOTE: There is no ALTER TYPE ... REMOVE VALUE in PostgreSQL.
-- Workaround: detach column → TEXT, DROP old type, CREATE new type, cast back.
-- See migration 038 (simplify-vacation-types) for a working example.
```

### Existing ENUMs

```bash
# List all ENUMs
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
ORDER BY t.typname, e.enumsortorder;
"
```

---

## Protected Tables

These tables are protected from DELETE:

- `plans` - Subscription plans
- `features` - Available features
- `plan_features` - Plan-to-feature mapping

```sql
-- DELETE attempt will be blocked
DELETE FROM plans WHERE id = 1;
-- ERROR: PROTECTED TABLE: DELETE not allowed on plans - system critical data
```

---

## Backup & Restore

### Creating a Backup

```bash
# Full backup (compressed — RECOMMENDED)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/full_backup_$(date +%Y%m%d_%H%M%S).dump

# Full backup (SQL format)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    > database/backups/full_backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only (no data)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx --schema-only \
    > database/backups/schema_only.sql

# Single table
docker exec assixx-postgres pg_dump -U assixx_user -d assixx -t users \
    > database/backups/users_backup.sql
```

### Restore

```bash
# From .dump (pg_restore)
docker exec -i assixx-postgres pg_restore -U assixx_user -d assixx \
    < database/backups/full_backup_XXXXXX.dump

# From .sql
docker exec -i assixx-postgres psql -U assixx_user -d assixx \
    < database/backups/backup.sql

# IMPORTANT: After restore, restore GRANTs!
cd /home/scs/projects/Assixx/customer/fresh-install && ./install.sh --grants-only
```

> **IMPORTANT:** After a restore, GRANTs for `app_user` are missing because the backup is created with `--no-privileges`. Without GRANTs, the backend gets "permission denied" errors!

---

## Common Problems

### Problem 1: RLS Blocks Query

```
ERROR: new row violates row-level security policy for table "users"
```

**Solution:** Set tenant context or run as `assixx_user` (BYPASSRLS).

### Problem 2: ENUM Value Does Not Exist

```
ERROR: invalid input value for enum user_role: "new_role"
```

**Solution:** Extend ENUM with a migration:

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'new_role';
```

### Problem 3: Foreign Key Constraint

```
ERROR: insert or update on table "X" violates foreign key constraint
```

**Solution:** Insert dependent data first or check the constraint:

```sql
SELECT tc.constraint_name, kcu.column_name,
       ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'your_table';
```

### Problem 4: Sequence Out of Sync

```
ERROR: duplicate key value violates unique constraint
```

**Solution:** Reset the sequence:

```sql
SELECT setval('table_name_id_seq', (SELECT MAX(id) FROM table_name));
```

### Problem 5: Migration Failed (Partial Apply)

```
ERROR: relation "xxx" already exists
```

**Solution:** Migration uses `IF NOT EXISTS` / `IF EXISTS` for idempotency. If not:

```bash
# Fix manually, then mark as "already applied"
doppler run -- ./scripts/run-migrations.sh up --fake
```

---

## Useful Queries

### Database Overview

```sql
-- All tables with row counts
SELECT schemaname, relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- Tables with RLS
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;

-- Table sizes
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Migration status
SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;
```

### Schema Information

```sql
-- Columns of a table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Indexes of a table
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';
```

---

## Test Commands

```bash
# Quick test suite
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

### What is pg_stat_statements?

PostgreSQL extension that tracks all queries and collects performance statistics.

```
┌─────────────────────────────────────────────────────────────┐
│  Every query is normalized and tracked:                      │
│                                                             │
│  SELECT * FROM users WHERE id = 123                         │
│  SELECT * FROM users WHERE id = 456                         │
│                 ↓                                           │
│  Normalized: SELECT * FROM users WHERE id = $1              │
│                                                             │
│  Statistics: calls, total_time, mean_time, rows, etc.       │
└─────────────────────────────────────────────────────────────┘
```

### Configuration (automatic in docker-compose.yml)

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

### Enable Extension (one-time after container restart)

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

### Useful Queries

```sql
-- Top 10 slowest queries (by total time)
SELECT left(query, 80) as query_preview, calls,
       round(total_exec_time::numeric, 2) as total_ms,
       round(mean_exec_time::numeric, 2) as avg_ms, rows
FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC LIMIT 10;

-- Most frequent queries (potential N+1 problems)
SELECT left(query, 80) as query_preview, calls, rows,
       round(mean_exec_time::numeric, 4) as avg_ms
FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%'
ORDER BY calls DESC LIMIT 10;
```

---

## is_active Convention

Consistent status values for all tables:

| Value | Meaning  | Description                       |
| ----- | -------- | --------------------------------- |
| `0`   | inactive | Deactivated, not visible          |
| `1`   | active   | Active, normally visible          |
| `3`   | archive  | Archived, only visible via filter |
| `4`   | deleted  | Soft delete, not visible          |

---

## Related Documentation

- [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) - Database structure and table overview
- [POSTGRESQL-MIGRATION-PLAN.md](./POSTGRESQL-MIGRATION-PLAN.md) - Historical migration plan MySQL -> PostgreSQL
- [DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md](./DATABASE-MIGRATION-GUIDE-MYSQL-BACKUP.md) - Old MySQL guide (backup)

---

**Remember:** PostgreSQL with RLS = Watertight multi-tenant isolation at the database level!
