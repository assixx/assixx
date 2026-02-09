# ADR-014 Implementation Plan: node-pg-migrate Integration

> **ADR:** [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md)
> **Status:** Completed (2026-01-27)
> **Reference:** [DATABASE-MIGRATION-GUIDE.md](../../DATABASE-MIGRATION-GUIDE.md)

---

## Goal

Introduce automated migration tooling with `node-pg-migrate`. Tracking table, UP/DOWN rollbacks, TypeScript migrations.

---

## Architecture Decisions

| Decision               | Choice                            | Why                                                                             |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| Install Location       | Root `package.json`               | `pg` is resolved as peerDep via workspace; migrations are DevOps, not app logic |
| Migration Directory    | `database/migrations/` (existing) | Team knows the path, no unnecessary relocation                                  |
| Language               | TypeScript (`-j ts`)              | Consistent with project, `tsx` already installed                                |
| DB User for Migrations | `assixx_user` (Owner)             | `app_user` has no DDL rights (only SELECT/INSERT/UPDATE/DELETE)                 |
| Tracking Table         | `pgmigrations` (Default)          | No conflict, less config                                                        |
| File Format            | UTC Timestamps                    | Prevents the 003-duplicate problem                                              |
| Seeds                  | Separate `database/seeds/` folder | Clean separation of schema vs. data                                             |
| Execution              | From host (`localhost:5432`)      | DB port exposed, `assixx_user` credentials available                            |

---

## Step-by-Step Implementation

### Step 1: Install `node-pg-migrate`

**Status:** Completed
**File:** `package.json` (Root)

```bash
pnpm add -wD node-pg-migrate
```

Scripts added:

```json
"db:migrate": "node-pg-migrate -m database/migrations",
"db:migrate:up": "node-pg-migrate up -m database/migrations",
"db:migrate:down": "node-pg-migrate down -m database/migrations",
"db:migrate:create": "node-pg-migrate create -j ts -m database/migrations",
"db:migrate:redo": "node-pg-migrate redo -m database/migrations",
"db:migrate:dry": "node-pg-migrate up --dry-run -m database/migrations",
"db:seed": "./scripts/run-seeds.sh"
```

**Note:** `pnpm add -wD` (with `-w` flag) is required because root is in a pnpm workspace.

### Step 2: Create Config File

**Status:** Completed
**New File:** `.node-pg-migraterc.json`

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

### Step 3: Wrapper Script for DATABASE_URL

**Status:** Completed
**New File:** `scripts/run-migrations.sh`

Constructs `DATABASE_URL` from Doppler env vars (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).
Uses `assixx_user` (not `app_user`). Detects whether host or Docker (DB_HOST=postgres -> localhost).

### Step 4: Archive Existing SQL Migrations

**Status:** Completed

```
database/migrations/archive/              <- NEW folder
  001_baseline_complete_schema.sql        <- moved
  002_seed_data.sql                       <- moved
  003-drop-unused-tables.sql              <- moved
  003-feature-visits.sql                  <- moved
  003-notification-feature-id.sql         <- moved
  004-audit-log-partitioning.sql          <- moved
  005-blackboard-status-to-is_active.sql  <- moved
  006-chat-per-user-soft-delete.sql       <- moved
  007-audit-trail-request-id.sql          <- moved
  008-kvp-comments-admin-only-trigger.sql <- moved
  009-kvp-daily-limit-trigger.sql         <- moved
  010-kvp-confirmations.sql              <- moved
  011-blackboard-confirmations-first-seen.sql <- moved
  012-kvp-confirmations-first-seen.sql    <- moved
  013-kvp-status-restored.sql             <- moved
  014-remove-deprecated-availability-columns.sql <- moved
```

`backup_old/` and `backups/` remain where they are.

### Step 5: Create TypeScript Migrations (15 files)

**Status:** Completed

Each existing SQL migration was wrapped as a `.ts` file with `pgm.sql()`:

| New File                                                   | Original SQL                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `20260127000000_baseline.ts`                               | Reads `archive/001_baseline_complete_schema.sql` via `readFileSync` |
| `20260127000001_drop-unused-tables.ts`                     | `003-drop-unused-tables.sql`                                        |
| `20260127000002_feature-visits.ts`                         | `003-feature-visits.sql`                                            |
| `20260127000003_notification-feature-id.ts`                | `003-notification-feature-id.sql`                                   |
| `20260127000004_audit-log-partitioning.ts`                 | Reads `archive/004-audit-log-partitioning.sql` via `readFileSync`   |
| `20260127000005_blackboard-status-to-is-active.ts`         | `005-blackboard-status-to-is_active.sql`                            |
| `20260127000006_chat-per-user-soft-delete.ts`              | `006-chat-per-user-soft-delete.sql`                                 |
| `20260127000007_audit-trail-request-id.ts`                 | `007-audit-trail-request-id.sql`                                    |
| `20260127000008_kvp-comments-admin-only-trigger.ts`        | `008-kvp-comments-admin-only-trigger.sql`                           |
| `20260127000009_kvp-daily-limit-trigger.ts`                | `009-kvp-daily-limit-trigger.sql`                                   |
| `20260127000010_kvp-confirmations.ts`                      | `010-kvp-confirmations.sql`                                         |
| `20260127000011_blackboard-confirmations-first-seen.ts`    | `011-blackboard-confirmations-first-seen.sql`                       |
| `20260127000012_kvp-confirmations-first-seen.ts`           | `012-kvp-confirmations-first-seen.sql`                              |
| `20260127000013_kvp-status-restored.ts`                    | `013-kvp-status-restored.sql`                                       |
| `20260127000014_remove-deprecated-availability-columns.ts` | `014-remove-deprecated-availability-columns.sql`                    |

**Pattern for each file:**

```typescript
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Original SQL from archived file
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Rollback SQL (where possible)
  `);
}
```

**Baseline migration** (000) and **audit-log-partitioning** (004) read large SQL files via `readFileSync` instead of copying them inline.

### Step 6: Extract Seeds

**Status:** Completed

**New File:** `database/seeds/001_global-seed-data.sql`

Content from `002_seed_data.sql` with changes:

- `\restrict` / `\unrestrict` removed (psql-specific, does not work with `pg` library)
- All INSERTs updated with `ON CONFLICT (id) DO NOTHING` -> idempotent
- Sequences synchronized at the end with `GREATEST(MAX(id), seed_count)`

**New File:** `scripts/run-seeds.sh`

Executes all `.sql` files in `database/seeds/` via `psql` (sorted alphabetically).

### Step 7: Clean Up Dead Scripts

**Status:** Completed
**File:** `backend/package.json`

Removed:

```
"db:migrate": "node scripts/run-migration.js"     <- file did not exist
"db:seed": "node scripts/seed-database.js"         <- file did not exist
"setup:dev": "npm run build && npm run db:migrate && npm run db:seed"  <- broken
```

### Step 8: Create Migration Template

**Status:** Completed
**New File:** `database/migrations/template.ts`

Reference template (NOT an actual migration) with Assixx-specific patterns:

- RLS: `NULLIF(current_setting('app.tenant_id', true), '')` pattern
- `GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO app_user`
- `GRANT USAGE, SELECT ON SEQUENCE ... TO app_user`
- `is_active` INTEGER convention (0/1/3/4)

### Step 9: Update Docs

**Status:** Completed
**File:** `docs/DATABASE-MIGRATION-GUIDE.md`

Completely rewritten with:

- New architecture overview (node-pg-migrate instead of docker cp + psql)
- CLI commands reference
- Day 1 procedure for existing DBs
- Migration checklist (BEFORE/AFTER)
- Seeds section
- New Problem 5: "Migration failed (partial apply)"

---

## Migrating an Existing DB (Day 1)

**Status:** Pending (must be executed on each existing DB instance)

```bash
# 1. Create backup
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/pre-node-pg-migrate.dump

# 2. Mark all 15 migrations as "already applied"
doppler run -- ./scripts/run-migrations.sh up --fake

# 3. Verify
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM pgmigrations ORDER BY run_on;"
```

---

## New Workflow (from now on)

```bash
# Create new migration
doppler run -- pnpm run db:migrate:create add-employee-skills

# Edit migration (database/migrations/20260128HHMMSS_add-employee-skills.ts)

# Dry run
doppler run -- ./scripts/run-migrations.sh up --dry-run

# Execute
doppler run -- ./scripts/run-migrations.sh up

# Rollback (last migration)
doppler run -- ./scripts/run-migrations.sh down

# Apply seeds
doppler run -- pnpm run db:seed
```

---

## Files Overview

| File                                      | Action                       | Status    |
| ----------------------------------------- | ---------------------------- | --------- |
| `package.json` (Root)                     | EDIT - devDep + scripts      | Completed |
| `.node-pg-migraterc.json`                 | NEW - Config                 | Completed |
| `scripts/run-migrations.sh`               | NEW - DATABASE_URL wrapper   | Completed |
| `scripts/run-seeds.sh`                    | NEW - Seed runner            | Completed |
| `database/migrations/*.sql` (14 files)    | MOVE -> `archive/`           | Completed |
| `database/migrations/*.ts` (15 files)     | NEW - TypeScript migrations  | Completed |
| `database/migrations/template.ts`         | NEW - Reference template     | Completed |
| `database/seeds/001_global-seed-data.sql` | NEW - Idempotent seeds       | Completed |
| `backend/package.json`                    | EDIT - Remove dead scripts   | Completed |
| `docs/DATABASE-MIGRATION-GUIDE.md`        | EDIT - Document new workflow | Completed |

---

## Risks & Mitigations

| Risk                                      | Mitigation                                                                   | Status     |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| ESM compatibility                         | `tsx` already installed; `-j ts` flag uses tsx                               | No problem |
| 676KB baseline in transaction             | `pgm.noTransaction()` if needed                                              | Not needed |
| psql meta-commands (`\restrict`) in seeds | Removed during extraction to `seeds/`                                        | Done       |
| `--fake` wrong order                      | All 15 .ts files created BEFORE the fake run                                 | Done       |
| `pg` as peerDep                           | Already installed in backend, workspace hoisting resolves it                 | No problem |
| Linter import order                       | Some migrations had auto-fixed import order (node:fs before node-pg-migrate) | Done       |

---

## Verification

| Test                                          | Status    |
| --------------------------------------------- | --------- |
| `node-pg-migrate` v8.0.4 installed            | Completed |
| 15 TypeScript migrations created              | Completed |
| 14 SQL files archived                         | Completed |
| Seeds extracted + idempotent                  | Completed |
| Dead scripts removed                          | Completed |
| Template created                              | Completed |
| Docs updated                                  | Completed |
| Wrapper scripts created + chmod +x            | Completed |
| `--fake` executed on dev DB                   | Pending   |
| `pnpm run db:migrate:create test-check` works | Pending   |
| Backend starts normally                       | Pending   |
| `customer/fresh-install/install.sh` works     | Pending   |

---

## References

- [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md) - The architecture decision
- [DATABASE-MIGRATION-GUIDE.md](../../DATABASE-MIGRATION-GUIDE.md) - Complete guide
- [node-pg-migrate GitHub](https://github.com/salsita/node-pg-migrate)
- [database/migrations/template.ts](../../../database/migrations/template.ts) - Reference template

---

_Last Updated: 2026-01-27 (v1 - All implementation steps completed, Day 1 pending)_
