# ADR-014: Database & Migration Architecture

| Metadata                | Value                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                   |
| **Date**                | 2026-01-27                                                                 |
| **Decision Makers**     | SCS Technik                                                                |
| **Affected Components** | `database/migrations/`, `database/seeds/`, `scripts/`, Root `package.json` |

---

## Context

### Ausgangslage

Assixx nutzt PostgreSQL 17 als zentrale Datenbank mit:

- **109 Tabellen** (84 mit RLS, 25 global)
- **89 RLS Policies** für Multi-Tenant-Isolation
- **70+ Trigger** (KVP Rate Limiting, Admin-only Comments, Soft-Delete, etc.)
- **Monatliche Partitionierung** für `audit_trail`

### Problem: Kein Migration-Tooling

Ein internes Audit (2026-01-27) hat 6 kritische Schwächen im Migration-Workflow identifiziert:

| #   | Problem                                                                                 | Schwere  |
| --- | --------------------------------------------------------------------------------------- | -------- |
| 1   | **Kein Migration Runner** - Manuelle `docker cp` + `psql` Ausführung                    | Kritisch |
| 2   | **Keine Rollback-Strategie** - Kein `down()`, kein Undo                                 | Kritisch |
| 3   | **Keine Tracking-Tabelle** - Unklar welche Migrationen auf welcher DB ausgeführt wurden | Kritisch |
| 4   | **Baseline nicht idempotent** - 676KB SQL-Datei ohne `IF NOT EXISTS` Guards             | Hoch     |
| 5   | **Seeds mit Schema gemischt** - `002_seed_data.sql` neben Schema-Migrationen            | Mittel   |
| 6   | **Nummerierungskollision** - Drei Dateien mit Prefix `003-*`                            | Mittel   |

### Bisheriger Workflow (manuell)

```
Developer schreibt SQL-Datei
    ↓
docker cp migration.sql assixx-postgres:/tmp/
    ↓
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/migration.sql
    ↓
??? (kein Tracking, kein Rollback, kein Dry-Run)
```

**Risiken:**

- Migrationen können doppelt ausgeführt werden (kein idempotency-Schutz)
- Kein Weg zurück bei fehlerhafter Migration
- Bei mehreren Entwicklern: Keine Garantie dass alle Migrationen in korrekter Reihenfolge laufen
- Customer Fresh-Install hat keine Garantie dass Schema-Stand = Migrations-Stand

### Zwei DB-User (Security-Constraint)

| User          | Rolle                        | RLS                           | DDL-Rechte                             |
| ------------- | ---------------------------- | ----------------------------- | -------------------------------------- |
| `app_user`    | Backend-Verbindung (Runtime) | Ja (FORCE ROW LEVEL SECURITY) | Nein (nur SELECT/INSERT/UPDATE/DELETE) |
| `assixx_user` | Migrationen, Admin (DevOps)  | Nein (BYPASSRLS)              | Ja (CREATE, ALTER, DROP, GRANT)        |

Migrationen MÜSSEN als `assixx_user` laufen - `app_user` kann keine Tabellen erstellen, keine RLS Policies anlegen, keine GRANTs vergeben.

---

## Decision Drivers

1. **PostgreSQL-nativ** - Tool muss mit Raw SQL arbeiten (RLS, Trigger, Partitioning sind nicht ORM-fähig)
2. **TypeScript** - Konsistent mit Projekt-Stack
3. **Leichtgewichtig** - Keine Runtime-Dependency, kein Code-Generator, kein Schema-Lock
4. **Rollback-Fähigkeit** - `down()` Funktion für jede Migration
5. **Tracking** - Welche Migrationen wurden auf welcher DB ausgeführt?
6. **Doppler-Kompatibilität** - Secrets werden über Doppler injected, nicht in `.env` Dateien
7. **KISS** - Minimale Komplexität, kein Overkill

---

## Options Considered

### Option A: Weiterhin manuell (docker cp + psql)

**Pros:**

- Keine neue Dependency
- Volle Kontrolle über jeden SQL-Befehl
- Zero Learning Curve

**Cons:**

- **Kein Tracking** - Unbekannt welche Migrationen wo ausgeführt wurden
- **Kein Rollback** - Fehler erfordern manuelle Korrektur
- **Fehleranfällig** - Doppelte Ausführung, falsche Reihenfolge, vergessene Migrationen
- **Nicht skalierbar** - Bei mehreren Entwicklern oder Kunden-Instanzen unhaltbar
- **Tote Scripts** - `backend/package.json` hatte `db:migrate` und `db:seed` Scripts die auf nicht-existierende Dateien zeigten

**Verdict:** REJECTED - Audit hat die Schwächen klar dokumentiert

### Option B: Prisma Migrate

**Pros:**

- Type-safe Schema-Definition
- Auto-generierte Migrationen
- Populär, grosse Community

**Cons:**

- **Massive Runtime-Dependency** - Prisma Client als Runtime-Dependency im Backend
- **Schema-Lock** - Prisma will das Schema "besitzen" und generiert Code dafür
- **RLS nicht unterstützt** - Prisma kann keine `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` generieren
- **Trigger nicht unterstützt** - `CREATE TRIGGER` ist nicht im Prisma-Schema
- **Partitioning nicht unterstützt** - `PARTITION BY RANGE` ist nicht modellierbar
- **ENUM-Handling** - Prisma hat eigene ENUM-Abstraktion die mit PostgreSQL ENUMs kollidiert
- **Overkill** - Wir brauchen keinen Query Builder, wir haben `pg` + Raw SQL

**Verdict:** REJECTED - Fundamentaler Mismatch mit PostgreSQL-nativem Stack (RLS, Trigger, Partitioning)

### Option C: TypeORM Migrations

**Pros:**

- TypeScript-nativ
- Migration Runner eingebaut
- Kann Raw SQL ausführen

**Cons:**

- **Massive Runtime-Dependency** - TypeORM als ORM im Backend (wir nutzen `pg` direkt)
- **Decorator-basiert** - Anderes Paradigma als unser Service-Layer
- **Migration-Format** - Erwartet TypeORM Connection, nicht `DATABASE_URL`
- **Overkill** - Wir nutzen 1% der Features (nur Migrations), zahlen 100% der Komplexität

**Verdict:** REJECTED - ORM-Overhead für ein Raw-SQL-Projekt

### Option D: node-pg-migrate (EMPFOHLEN)

**Pros:**

- **PostgreSQL-exklusiv** - Kennt PostgreSQL-Features (ENUMs, Extensions, Schemas)
- **Raw SQL via `pgm.sql()`** - Perfekt für RLS, Trigger, Partitioning, GRANTs
- **TypeScript-nativ** - `-j ts` Flag, `tsx` als Runner (bereits installiert)
- **Leichtgewichtig** - Dev-Dependency, keine Runtime-Auswirkung
- **Tracking-Tabelle** - `pgmigrations` automatisch verwaltet
- **UP/DOWN** - Rollback-Fähigkeit eingebaut
- **Dry-Run** - `--dry-run` Flag zeigt was passieren würde
- **`--fake`** - Bestehende DBs als "already migrated" markieren
- **`DATABASE_URL`** - Standard-PostgreSQL Connection String
- **UTC-Timestamps** - Verhindert Nummerierungskollisionen (kein `003-*` Problem mehr)
- **Community** - 2.5K+ GitHub Stars, aktiv maintained von Salsita Software

**Cons:**

- Neue DevDependency (`node-pg-migrate` 8.x)
- Wrapper-Script für Doppler nötig (`scripts/run-migrations.sh`)
- Bestehende Migrationen müssen einmalig mit `--fake` registriert werden

**Verdict:** ACCEPTED - Perfekter Fit für PostgreSQL-nativen Stack

### Option E: Flyway / Liquibase

**Pros:**

- Enterprise-grade, battle-tested
- Flyway hat PostgreSQL-Support

**Cons:**

- **Java-Runtime** - Erfordert JVM im Docker-Container oder separaten Container
- **Nicht TypeScript** - SQL oder XML/YAML Migrationen
- **Docker-Overhead** - Zusätzlicher Container oder JVM im bestehenden Container
- **Overkill** - Enterprise-Features die wir nicht brauchen

**Verdict:** REJECTED - Java-Dependency in einem TypeScript/Node.js Stack

---

## Decision

**`node-pg-migrate` 8.x als Migration-Tool, installiert als Root DevDependency.**

### Architektur

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
│   │  1. Liest Doppler Env-Vars               │                  │
│   │  2. Baut DATABASE_URL                    │                  │
│   │  3. Erkennt Docker (postgres → localhost) │                  │
│   │  4. Ruft node-pg-migrate auf             │                  │
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

### Verzeichnisstruktur

```
database/
├── migrations/                         ← node-pg-migrate (TypeScript)
│   ├── 20260127000000_baseline.ts      ← Komplettes Schema (liest archive/001 per readFileSync)
│   ├── 20260127000001_drop-unused-tables.ts
│   ├── ...                             ← 15 Migrationen total (UTC-Timestamp + Name)
│   ├── template.ts                     ← Referenz-Template (KEIN Migration)
│   └── archive/                        ← Originale SQL-Dateien (historisch)
│       ├── 001_baseline_complete_schema.sql
│       ├── 002_seed_data.sql
│       └── ...
├── seeds/                              ← Getrennt von Schema-Migrationen!
│   └── 001_global-seed-data.sql        ← Idempotent (ON CONFLICT DO NOTHING)
└── backups/                            ← pg_dump Backups

scripts/
├── run-migrations.sh                   ← DATABASE_URL Wrapper für Doppler
└── run-seeds.sh                        ← Seed Runner (psql, assixx_user)
```

### Dateinamenskonvention

**Alt (Problem):**

```
003-drop-unused-tables.sql    ← Kollision!
003-feature-visits.sql        ← Kollision!
003-notification-feature-id.sql  ← Kollision!
```

**Neu (UTC-Timestamp):**

```
20260127000001_drop-unused-tables.ts
20260127000002_feature-visits.ts
20260127000003_notification-feature-id.ts
```

UTC-Timestamps sind einzigartig, selbst wenn mehrere Entwickler gleichzeitig Migrationen erstellen.

### Migration-Pattern

Jede Migration nutzt `pgm.sql()` für Raw SQL:

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

    -- RLS (PFLICHT bei tenant-isolated tables)
    ALTER TABLE example ENABLE ROW LEVEL SECURITY;
    ALTER TABLE example FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON example
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Permissions (PFLICHT)
    GRANT SELECT, INSERT, UPDATE, DELETE ON example TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE example_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS example CASCADE;`);
}
```

**Warum `pgm.sql()` statt `pgm.createTable()`?**

`node-pg-migrate` bietet eine Builder-API (`pgm.createTable()`, `pgm.addColumns()`), aber wir nutzen bewusst `pgm.sql()` weil:

1. **RLS** - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` hat keine Builder-Methode
2. **Policies** - `CREATE POLICY ... USING(...)` mit komplexem NULLIF-Pattern nicht abbildbar
3. **Trigger** - `CREATE TRIGGER ... EXECUTE FUNCTION ...` nur in Raw SQL
4. **Partitioning** - `PARTITION BY RANGE` nicht im Builder
5. **GRANTs** - `GRANT ... TO app_user` nicht im Builder
6. **Konsistenz** - Ein Pattern für alles, nicht Builder + SQL gemischt

### Seeds vs. Migrationen

| Aspekt         | Migrationen                   | Seeds                                |
| -------------- | ----------------------------- | ------------------------------------ |
| **Pfad**       | `database/migrations/*.ts`    | `database/seeds/*.sql`               |
| **Tool**       | `node-pg-migrate`             | `psql` (via `run-seeds.sh`)          |
| **Tracking**   | `pgmigrations` Tabelle        | Kein Tracking (idempotent)           |
| **Idempotenz** | Einmal ausführen              | Beliebig oft ausführbar              |
| **Inhalt**     | DDL (Schema-Änderungen)       | DML (Konfigurationsdaten)            |
| **Beispiel**   | `CREATE TABLE`, `ALTER TABLE` | `INSERT INTO features VALUES(...)`   |
| **Rollback**   | `down()` Funktion             | Nicht nötig (ON CONFLICT DO NOTHING) |

### CLI Commands

```bash
# Migration ausführen (alle pending)
doppler run -- ./scripts/run-migrations.sh up

# Rollback (letzte Migration)
doppler run -- ./scripts/run-migrations.sh down

# Dry-Run
doppler run -- ./scripts/run-migrations.sh up --dry-run

# Neue Migration erstellen
doppler run -- pnpm run db:migrate:create add-employee-skills

# Seeds anwenden
doppler run -- pnpm run db:seed

# Status prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"
```

---

## Consequences

### Positive

- **Tracking-Tabelle** - `pgmigrations` dokumentiert exakt welche Migrationen auf welcher DB laufen
- **Rollback** - `down()` ermöglicht Rücknahme fehlerhafter Migrationen
- **Dry-Run** - Änderungen vor Ausführung prüfen
- **Idempotente Seeds** - `ON CONFLICT DO NOTHING`, sicher mehrfach ausführbar
- **UTC-Timestamps** - Keine Nummerierungskollisionen mehr
- **TypeScript** - Konsistent mit Backend-Stack, IDE-Support, Type Checking
- **Zero Runtime-Impact** - `node-pg-migrate` ist DevDependency, nicht im Production Bundle
- **`--fake`** - Bestehende DBs nahtlos einbinden
- **Customer Fresh-Install** - Gleicher Migrations-Pfad für Dev und Production

### Negative

- **Einmalige Migration** - Bestehende DBs müssen einmalig `--fake` ausführen (Day 1 Procedure)
- **Wrapper-Script** - `scripts/run-migrations.sh` nötig wegen Doppler (kein nativer `DATABASE_URL` Support ohne Env-Vars)
- **Lernkurve** - Team muss `node-pg-migrate` CLI lernen (minimal: `up`, `down`, `create`)

### Neutral

- Archivierte SQL-Dateien bleiben in `database/migrations/archive/` erhalten
- `customer/fresh-install/` bleibt unverändert (wird weiterhin aus pg_dump generiert)
- Backend-Code ist nicht betroffen (nutzt weiterhin `pg` Pool direkt)

---

## Irreversible Migrationen

Nicht alle PostgreSQL-Operationen sind reversibel:

| Operation              | Reversibel? | `down()` Strategie                                      |
| ---------------------- | ----------- | ------------------------------------------------------- |
| `CREATE TABLE`         | Ja          | `DROP TABLE CASCADE`                                    |
| `ADD COLUMN`           | Ja          | `DROP COLUMN`                                           |
| `DROP TABLE`           | Nein        | Error werfen                                            |
| `DROP COLUMN`          | Nein        | Error werfen (Daten verloren)                           |
| `ALTER TYPE ADD VALUE` | Nein        | Error werfen (PostgreSQL Limitation)                    |
| `Data Migration`       | Bedingt     | Error werfen (transformierte Daten nicht zurücksetzbar) |

**Konvention:** Irreversible Migrationen werfen in `down()` einen beschreibenden Error:

```typescript
export function down(): void {
  throw new Error('Cannot remove ENUM values in PostgreSQL. The "restored" value will remain.');
}
```

---

## Day 1 Procedure (Bestehende DB)

Für Datenbanken die bereits alle Migrationen manuell ausgeführt haben:

```bash
# 1. Backup
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 > database/backups/pre-node-pg-migrate.dump

# 2. Alle 15 Migrationen als "bereits ausgeführt" markieren
doppler run -- ./scripts/run-migrations.sh up --fake

# 3. Verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"
# → 15 Einträge

# 4. Seeds
doppler run -- pnpm run db:seed
```

---

## Verification

| Test                               | Status    | Beschreibung                         |
| ---------------------------------- | --------- | ------------------------------------ |
| `node-pg-migrate` installiert      | Bestanden | v8.0.4 als Root DevDependency        |
| 15 TypeScript Migrationen erstellt | Bestanden | UTC-Timestamp Namensformat           |
| SQL-Dateien archiviert             | Bestanden | 14 Dateien in `archive/`             |
| Seeds extrahiert                   | Bestanden | Idempotent mit ON CONFLICT           |
| Tote Scripts entfernt              | Bestanden | `backend/package.json` bereinigt     |
| Template erstellt                  | Bestanden | `database/migrations/template.ts`    |
| Docs aktualisiert                  | Bestanden | DATABASE-MIGRATION-GUIDE.md          |
| Wrapper-Scripts                    | Bestanden | `run-migrations.sh` + `run-seeds.sh` |

---

## Implementation Plan

See: [ADR-014-implementation-plan.md](./ADR-014-implementation-plan.md)

## References

- [DATABASE-MIGRATION-GUIDE.md](../../DATABASE-MIGRATION-GUIDE.md) - Vollständige Anleitung mit CLI Commands, Checklisten, Troubleshooting
- [node-pg-migrate GitHub](https://github.com/salsita/node-pg-migrate) - Offizielle Dokumentation
- [node-pg-migrate Docs](https://salsita.github.io/node-pg-migrate/) - API Reference
- [database/migrations/template.ts](../../../database/migrations/template.ts) - Referenz-Template für neue Migrationen
- [ADR Template](https://adr.github.io/) - ADR Format-Standard

## Related ADRs

- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) - RLS Policy Pattern (NULLIF)
- [ADR-009: Central Audit Logging](./ADR-009-central-audit-logging.md) - Audit Trail Partitioning (Migration 004)

---

_Last Updated: 2026-01-27 (v1 - Initial Decision)_
