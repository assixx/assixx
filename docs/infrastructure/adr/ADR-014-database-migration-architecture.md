# ADR-014: Database & Migration Architecture

| Metadata                | Value                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                   |
| **Date**                | 2026-01-27                                                                 |
| **Decision Makers**     | SCS Technik                                                                |
| **Affected Components** | `database/migrations/`, `database/seeds/`, `scripts/`, Root `package.json` |

---

## Context

### Starting Point

Assixx uses PostgreSQL 17 as its central database with:

- **109 tables** (84 with RLS, 25 global)
- **89 RLS policies** for multi-tenant isolation
- **70+ triggers** (KVP rate limiting, admin-only comments, soft delete, etc.)
- **Monthly partitioning** for `audit_trail`

### Problem: No Migration Tooling

An internal audit (2026-01-27) identified 6 critical weaknesses in the migration workflow:

| #   | Problem                                                                       | Severity |
| --- | ----------------------------------------------------------------------------- | -------- |
| 1   | **No migration runner** - Manual `docker cp` + `psql` execution               | Critical |
| 2   | **No rollback strategy** - No `down()`, no undo                               | Critical |
| 3   | **No tracking table** - Unclear which migrations were executed on which DB    | Critical |
| 4   | **Baseline not idempotent** - 676KB SQL file without `IF NOT EXISTS` guards   | High     |
| 5   | **Seeds mixed with schema** - `002_seed_data.sql` alongside schema migrations | Medium   |
| 6   | **Numbering collision** - Three files with prefix `003-*`                     | Medium   |

### Previous Workflow (manual)

```
Developer writes SQL file
    ↓
docker cp migration.sql assixx-postgres:/tmp/
    ↓
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/migration.sql
    ↓
??? (no tracking, no rollback, no dry run)
```

**Risks:**

- Migrations can be executed twice (no idempotency protection)
- No way back on a faulty migration
- With multiple developers: No guarantee that all migrations run in the correct order
- Customer fresh install has no guarantee that schema state = migration state

### Two DB Users (Security Constraint)

| User          | Role                         | RLS                            | DDL Privileges                        |
| ------------- | ---------------------------- | ------------------------------ | ------------------------------------- |
| `app_user`    | Backend connection (runtime) | Yes (FORCE ROW LEVEL SECURITY) | No (only SELECT/INSERT/UPDATE/DELETE) |
| `assixx_user` | Migrations, Admin (DevOps)   | No (BYPASSRLS)                 | Yes (CREATE, ALTER, DROP, GRANT)      |

Migrations MUST run as `assixx_user` - `app_user` cannot create tables, create RLS policies, or issue GRANTs.

---

## Decision Drivers

1. **PostgreSQL-native** - Tool must work with raw SQL (RLS, triggers, partitioning are not ORM-capable)
2. **TypeScript** - Consistent with project stack
3. **Lightweight** - No runtime dependency, no code generator, no schema lock
4. **Rollback capability** - `down()` function for every migration
5. **Tracking** - Which migrations were executed on which DB?
6. **Doppler compatibility** - Secrets are injected via Doppler, not in `.env` files
7. **KISS** - Minimal complexity, no overkill

---

## Options Considered

### Option A: Continue manually (docker cp + psql)

**Pros:**

- No new dependency
- Full control over every SQL command
- Zero learning curve

**Cons:**

- **No tracking** - Unknown which migrations were executed where
- **No rollback** - Errors require manual correction
- **Error-prone** - Double execution, wrong order, forgotten migrations
- **Not scalable** - Untenable with multiple developers or customer instances
- **Dead scripts** - `backend/package.json` had `db:migrate` and `db:seed` scripts pointing to non-existent files

**Verdict:** REJECTED - Audit clearly documented the weaknesses

### Option B: Prisma Migrate

**Pros:**

- Type-safe schema definition
- Auto-generated migrations
- Popular, large community

**Cons:**

- **Massive runtime dependency** - Prisma Client as runtime dependency in backend
- **Schema lock** - Prisma wants to "own" the schema and generates code for it
- **RLS not supported** - Prisma cannot generate `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- **Triggers not supported** - `CREATE TRIGGER` is not in Prisma schema
- **Partitioning not supported** - `PARTITION BY RANGE` is not modelable
- **ENUM handling** - Prisma has its own ENUM abstraction that conflicts with PostgreSQL ENUMs
- **Overkill** - We don't need a query builder, we have `pg` + raw SQL

**Verdict:** REJECTED - Fundamental mismatch with PostgreSQL-native stack (RLS, triggers, partitioning)

### Option C: TypeORM Migrations

**Pros:**

- TypeScript-native
- Built-in migration runner
- Can execute raw SQL

**Cons:**

- **Massive runtime dependency** - TypeORM as ORM in backend (we use `pg` directly)
- **Decorator-based** - Different paradigm from our service layer
- **Migration format** - Expects TypeORM Connection, not `DATABASE_URL`
- **Overkill** - We use 1% of features (only migrations), pay 100% of complexity

**Verdict:** REJECTED - ORM overhead for a raw SQL project

### Option D: node-pg-migrate (RECOMMENDED)

**Pros:**

- **PostgreSQL-exclusive** - Knows PostgreSQL features (ENUMs, extensions, schemas)
- **Raw SQL via `pgm.sql()`** - Perfect for RLS, triggers, partitioning, GRANTs
- **TypeScript-native** - `-j ts` flag, `tsx` as runner (already installed)
- **Lightweight** - Dev dependency, no runtime impact
- **Tracking table** - `pgmigrations` automatically managed
- **UP/DOWN** - Rollback capability built-in
- **Dry-Run** - `--dry-run` flag shows what would happen
- **`--fake`** - Mark existing DBs as "already migrated"
- **`DATABASE_URL`** - Standard PostgreSQL connection string
- **UTC timestamps** - Prevents numbering collisions (no more `003-*` problem)
- **Community** - 2.5K+ GitHub Stars, actively maintained by Salsita Software

**Cons:**

- New devDependency (`node-pg-migrate` 8.x)
- Wrapper script needed for Doppler (`scripts/run-migrations.sh`)
- Existing migrations must be registered once with `--fake`

**Verdict:** ACCEPTED - Perfect fit for PostgreSQL-native stack

### Option E: Flyway / Liquibase

**Pros:**

- Enterprise-grade, battle-tested
- Flyway has PostgreSQL support

**Cons:**

- **Java runtime** - Requires JVM in Docker container or separate container
- **Not TypeScript** - SQL or XML/YAML migrations
- **Docker overhead** - Additional container or JVM in existing container
- **Overkill** - Enterprise features we don't need

**Verdict:** REJECTED - Java dependency in a TypeScript/Node.js stack

---

## Decision

**`node-pg-migrate` 8.x as migration tool, installed as root devDependency.**

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE MIGRATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Developer                                                     │
│      │                                                          │
│      │  pnpm run db:migrate:create add-feature-x                │
│      ▼                                                          │
│   ┌──────────────────────────────────────────┐                  │
│   │  database/migrations/                    │                  │
│   │  20260128XXXXXX_add-feature-x.ts         │                  │
│   │                                          │                  │
│   │  export function up(pgm) {               │                  │
│   │    pgm.sql(`CREATE TABLE ...`);          │                  │
│   │  }                                       │                  │
│   │  export function down(pgm) {             │                  │
│   │    pgm.sql(`DROP TABLE ...`);            │                  │
│   │  }                                       │                  │
│   └──────────────┬───────────────────────────┘                  │
│                  │                                               │
│                  │  doppler run -- ./scripts/run-migrations.sh   │
│                  ▼                                               │
│   ┌──────────────────────────────────────────┐                  │
│   │  scripts/run-migrations.sh               │                  │
│   │                                          │                  │
│   │  1. Reads Doppler env vars               │                  │
│   │  2. Builds DATABASE_URL                    │                  │
│   │  3. Detects Docker (postgres → localhost) │                  │
│   │  4. Calls node-pg-migrate             │                  │
│   └──────────────┬───────────────────────────┘                  │
│                  │                                               │
│                  │  DATABASE_URL=postgresql://assixx_user:...    │
│                  ▼                                               │
│   ┌──────────────────────────────────────────┐                  │
│   │  PostgreSQL 17                           │                  │
│   │                                          │                  │
│   │  ┌──────────────┐   ┌─────────────────┐  │                  │
│   │  │ pgmigrations │   │ Schema Changes  │  │                  │
│   │  │              │   │                 │  │                  │
│   │  │ id | name    │   │ CREATE TABLE    │  │                  │
│   │  │ 1  | base... │   │ ALTER TABLE     │  │                  │
│   │  │ 2  | drop... │   │ CREATE POLICY   │  │                  │
│   │  │ ...          │   │ GRANT ...       │  │                  │
│   │  └──────────────┘   └─────────────────┘  │                  │
│   └──────────────────────────────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
database/
├── migrations/                         ← node-pg-migrate (TypeScript)
│   ├── 20260127000000_baseline.ts      ← Complete schema (reads archive/001 via readFileSync)
│   ├── 20260127000001_drop-unused-tables.ts
│   ├── ...                             ← 15 migrations total (UTC timestamp + name)
│   ├── template.ts                     ← Reference template (NOT a migration)
│   └── archive/                        ← Original SQL files (historical)
│       ├── 001_baseline_complete_schema.sql
│       ├── 002_seed_data.sql
│       └── ...
├── seeds/                              ← Separated from schema migrations!
│   └── 001_global-seed-data.sql        ← Idempotent (ON CONFLICT DO NOTHING)
└── backups/                            ← pg_dump backups

scripts/
├── run-migrations.sh                   ← DATABASE_URL wrapper for Doppler
└── run-seeds.sh                        ← Seed runner (psql, assixx_user)
```

### File Naming Convention

**Old (Problem):**

```
003-drop-unused-tables.sql    ← Collision!
003-feature-visits.sql        ← Collision!
003-notification-feature-id.sql  ← Collision!
```

**New (UTC Timestamp):**

```
20260127000001_drop-unused-tables.ts
20260127000002_feature-visits.ts
20260127000003_notification-feature-id.ts
```

UTC timestamps are unique, even when multiple developers create migrations simultaneously.

### Migration Pattern

Every migration uses `pgm.sql()` for raw SQL:

```typescript
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS example (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- RLS (MANDATORY for tenant-isolated tables)
    ALTER TABLE example ENABLE ROW LEVEL SECURITY;
    ALTER TABLE example FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON example
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Permissions (MANDATORY)
    GRANT SELECT, INSERT, UPDATE, DELETE ON example TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE example_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS example CASCADE;`);
}
```

**Why `pgm.sql()` instead of `pgm.createTable()`?**

`node-pg-migrate` offers a builder API (`pgm.createTable()`, `pgm.addColumns()`), but we deliberately use `pgm.sql()` because:

1. **RLS** - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` has no builder method
2. **Policies** - `CREATE POLICY ... USING(...)` with complex NULLIF pattern not representable
3. **Triggers** - `CREATE TRIGGER ... EXECUTE FUNCTION ...` only in raw SQL
4. **Partitioning** - `PARTITION BY RANGE` not in builder
5. **GRANTs** - `GRANT ... TO app_user` not in builder
6. **Consistency** - One pattern for everything, not builder + SQL mixed

### Seeds vs. Migrations

| Aspect          | Migrations                    | Seeds                               |
| --------------- | ----------------------------- | ----------------------------------- |
| **Path**        | `database/migrations/*.ts`    | `database/seeds/*.sql`              |
| **Tool**        | `node-pg-migrate`             | `psql` (via `run-seeds.sh`)         |
| **Tracking**    | `pgmigrations` table          | No tracking (idempotent)            |
| **Idempotency** | Execute once                  | Can be run any number of times      |
| **Content**     | DDL (schema changes)          | DML (configuration data)            |
| **Example**     | `CREATE TABLE`, `ALTER TABLE` | `INSERT INTO addons VALUES(...)`    |
| **Rollback**    | `down()` function             | Not needed (ON CONFLICT DO NOTHING) |

### CLI Commands

```bash
# Execute migration (all pending)
doppler run -- ./scripts/run-migrations.sh up

# Rollback (last migration)
doppler run -- ./scripts/run-migrations.sh down

# Dry-Run
doppler run -- ./scripts/run-migrations.sh up --dry-run

# Create new migration
doppler run -- pnpm run db:migrate:create add-employee-skills

# Apply seeds
doppler run -- pnpm run db:seed

# Check status
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"
```

---

## Consequences

### Positive

- **Tracking table** - `pgmigrations` documents exactly which migrations run on which DB
- **Rollback** - `down()` enables reversal of faulty migrations
- **Dry-Run** - Review changes before execution
- **Idempotent seeds** - `ON CONFLICT DO NOTHING`, safe to run multiple times
- **UTC timestamps** - No more numbering collisions
- **TypeScript** - Consistent with backend stack, IDE support, type checking
- **Zero runtime impact** - `node-pg-migrate` is a devDependency, not in the production bundle
- **`--fake`** - Seamlessly integrate existing DBs
- **Customer fresh install** - Same migration path for dev and production

### Negative

- **One-time migration** - Existing DBs must run `--fake` once (Day 1 Procedure)
- **Wrapper script** - `scripts/run-migrations.sh` needed due to Doppler (no native `DATABASE_URL` support without env vars)
- **Learning curve** - Team must learn `node-pg-migrate` CLI (minimal: `up`, `down`, `create`)

### Neutral

- Archived SQL files remain in `database/migrations/archive/`
- `customer/fresh-install/` remains unchanged (still generated from pg_dump)
- Backend code is not affected (continues to use `pg` pool directly)

---

## Irreversible Migrations

Not all PostgreSQL operations are reversible:

| Operation              | Reversible? | `down()` Strategy                             |
| ---------------------- | ----------- | --------------------------------------------- |
| `CREATE TABLE`         | Yes         | `DROP TABLE CASCADE`                          |
| `ADD COLUMN`           | Yes         | `DROP COLUMN`                                 |
| `DROP TABLE`           | No          | Throw error                                   |
| `DROP COLUMN`          | No          | Throw error (data lost)                       |
| `ALTER TYPE ADD VALUE` | No          | Throw error (PostgreSQL limitation)           |
| `Data Migration`       | Conditional | Throw error (transformed data not reversible) |

**Convention:** Irreversible migrations throw a descriptive error in `down()`:

```typescript
export function down(): void {
  throw new Error('Cannot remove ENUM values in PostgreSQL. The "restored" value will remain.');
}
```

---

## Day 1 Procedure (Existing DB)

For databases that have already executed all migrations manually:

```bash
# 1. Backup
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 > database/backups/pre-node-pg-migrate.dump

# 2. Mark all 15 migrations as "already executed"
doppler run -- ./scripts/run-migrations.sh up --fake

# 3. Verify
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"
# → 15 entries

# 4. Seeds
doppler run -- pnpm run db:seed
```

---

## Verification

| Test                             | Status | Description                          |
| -------------------------------- | ------ | ------------------------------------ |
| `node-pg-migrate` installed      | Passed | v8.0.4 as root devDependency         |
| 15 TypeScript migrations created | Passed | UTC timestamp naming format          |
| SQL files archived               | Passed | 14 files in `archive/`               |
| Seeds extracted                  | Passed | Idempotent with ON CONFLICT          |
| Dead scripts removed             | Passed | `backend/package.json` cleaned up    |
| Template created                 | Passed | `database/migrations/template.ts`    |
| Docs updated                     | Passed | DATABASE-MIGRATION-GUIDE.md          |
| Wrapper scripts                  | Passed | `run-migrations.sh` + `run-seeds.sh` |

---

## Implementation Plan

See: [ADR-014-implementation-plan.md](./ADR-014-implementation-plan.md)

## References

- [DATABASE-MIGRATION-GUIDE.md](../../DATABASE-MIGRATION-GUIDE.md) - Complete guide with CLI commands, checklists, troubleshooting
- [node-pg-migrate GitHub](https://github.com/salsita/node-pg-migrate) - Official documentation
- [node-pg-migrate Docs](https://salsita.github.io/node-pg-migrate/) - API Reference
- [database/migrations/template.ts](../../../database/migrations/template.ts) - Reference template for new migrations
- [ADR Template](https://adr.github.io/) - ADR Format-Standard

## Related ADRs

- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) - RLS Policy Pattern (NULLIF)
- [ADR-009: Central Audit Logging](./ADR-009-central-audit-logging.md) - Audit Trail Partitioning (Migration 004)

---

_Last Updated: 2026-01-27 (v1 - Initial Decision)_
