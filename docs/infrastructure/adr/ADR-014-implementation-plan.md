# ADR-014 Implementation Plan: node-pg-migrate Integration

> **ADR:** [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md)
> **Status:** Completed (2026-01-27)
> **Reference:** [DATABASE-MIGRATION-GUIDE.md](../../DATABASE-MIGRATION-GUIDE.md)

---

## Ziel

Automatisiertes Migration-Tooling mit `node-pg-migrate` einfuehren. Tracking-Tabelle, UP/DOWN Rollbacks, TypeScript-Migrationen.

---

## Architektur-Entscheidungen

| Entscheidung             | Wahl                               | Warum                                                                                     |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Install-Ort              | Root `package.json`                | `pg` wird als peerDep aufgeloest ueber workspace; Migrations sind DevOps, nicht App-Logik |
| Migration-Verzeichnis    | `database/migrations/` (bestehend) | Team kennt den Pfad, kein unnoetiger Umzug                                                |
| Sprache                  | TypeScript (`-j ts`)               | Konsistent mit Projekt, `tsx` bereits installiert                                         |
| DB-User fuer Migrationen | `assixx_user` (Owner)              | `app_user` hat keine DDL-Rechte (nur SELECT/INSERT/UPDATE/DELETE)                         |
| Tracking-Tabelle         | `pgmigrations` (Default)           | Kein Konflikt, weniger Config                                                             |
| Dateiformat              | UTC-Timestamps                     | Verhindert das 003-Duplikat-Problem                                                       |
| Seeds                    | Separater `database/seeds/` Ordner | Saubere Trennung Schema vs. Daten                                                         |
| Ausfuehrung              | Vom Host (`localhost:5432`)        | DB-Port exposed, `assixx_user` Credentials verfuegbar                                     |

---

## Schritt-fuer-Schritt Implementierung

### Schritt 1: `node-pg-migrate` installieren

**Status:** Completed
**Datei:** `package.json` (Root)

```bash
pnpm add -wD node-pg-migrate
```

Scripts hinzugefuegt:

```json
"db:migrate": "node-pg-migrate -m database/migrations",
"db:migrate:up": "node-pg-migrate up -m database/migrations",
"db:migrate:down": "node-pg-migrate down -m database/migrations",
"db:migrate:create": "node-pg-migrate create -j ts -m database/migrations",
"db:migrate:redo": "node-pg-migrate redo -m database/migrations",
"db:migrate:dry": "node-pg-migrate up --dry-run -m database/migrations",
"db:seed": "./scripts/run-seeds.sh"
```

**Hinweis:** `pnpm add -wD` (mit `-w` Flag) ist noetig weil Root in einem pnpm Workspace liegt.

### Schritt 2: Config-Datei erstellen

**Status:** Completed
**Neue Datei:** `.node-pg-migraterc.json`

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

### Schritt 3: Wrapper-Script fuer DATABASE_URL

**Status:** Completed
**Neue Datei:** `scripts/run-migrations.sh`

Konstruiert `DATABASE_URL` aus Doppler-Env-Vars (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).
Nutzt `assixx_user` (nicht `app_user`). Erkennt ob Host oder Docker (DB_HOST=postgres → localhost).

### Schritt 4: Bestehende SQL-Migrationen archivieren

**Status:** Completed

```
database/migrations/archive/              ← NEUER Ordner
  001_baseline_complete_schema.sql        ← verschoben
  002_seed_data.sql                       ← verschoben
  003-drop-unused-tables.sql              ← verschoben
  003-feature-visits.sql                  ← verschoben
  003-notification-feature-id.sql         ← verschoben
  004-audit-log-partitioning.sql          ← verschoben
  005-blackboard-status-to-is_active.sql  ← verschoben
  006-chat-per-user-soft-delete.sql       ← verschoben
  007-audit-trail-request-id.sql          ← verschoben
  008-kvp-comments-admin-only-trigger.sql ← verschoben
  009-kvp-daily-limit-trigger.sql         ← verschoben
  010-kvp-confirmations.sql               ← verschoben
  011-blackboard-confirmations-first-seen.sql ← verschoben
  012-kvp-confirmations-first-seen.sql    ← verschoben
  013-kvp-status-restored.sql             ← verschoben
  014-remove-deprecated-availability-columns.sql ← verschoben
```

`backup_old/` und `backups/` bleiben wo sie sind.

### Schritt 5: TypeScript-Migrationen erstellen (15 Dateien)

**Status:** Completed

Jede bestehende SQL-Migration wurde als `.ts`-Datei mit `pgm.sql()` gewrappt:

| Neue Datei                                                 | Originale SQL                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `20260127000000_baseline.ts`                               | Liest `archive/001_baseline_complete_schema.sql` via `readFileSync` |
| `20260127000001_drop-unused-tables.ts`                     | `003-drop-unused-tables.sql`                                        |
| `20260127000002_feature-visits.ts`                         | `003-feature-visits.sql`                                            |
| `20260127000003_notification-feature-id.ts`                | `003-notification-feature-id.sql`                                   |
| `20260127000004_audit-log-partitioning.ts`                 | Liest `archive/004-audit-log-partitioning.sql` via `readFileSync`   |
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

**Pattern fuer jede Datei:**

```typescript
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Original SQL aus archivierter Datei
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Rollback SQL (wo moeglich)
  `);
}
```

**Baseline-Migration** (000) und **Audit-Log-Partitioning** (004) lesen grosse SQL-Dateien per `readFileSync` statt sie inline zu kopieren.

### Schritt 6: Seeds auslagern

**Status:** Completed

**Neue Datei:** `database/seeds/001_global-seed-data.sql`

Inhalt aus `002_seed_data.sql` mit Aenderungen:

- `\restrict` / `\unrestrict` entfernt (psql-spezifisch, funktioniert nicht mit `pg` library)
- Alle INSERTs mit `ON CONFLICT (id) DO NOTHING` ergaenzt → idempotent
- Sequences werden am Ende mit `GREATEST(MAX(id), seed_count)` synchronisiert

**Neue Datei:** `scripts/run-seeds.sh`

Fuehrt alle `.sql` Dateien in `database/seeds/` via `psql` aus (alphabetisch sortiert).

### Schritt 7: Tote Scripts aufraeumen

**Status:** Completed
**Datei:** `backend/package.json`

Entfernt:

```
"db:migrate": "node scripts/run-migration.js"     ← Datei existierte nicht
"db:seed": "node scripts/seed-database.js"         ← Datei existierte nicht
"setup:dev": "npm run build && npm run db:migrate && npm run db:seed"  ← broken
```

### Schritt 8: Migration-Template erstellen

**Status:** Completed
**Neue Datei:** `database/migrations/template.ts`

Referenz-Template (KEIN echte Migration) mit Assixx-spezifischen Patterns:

- RLS: `NULLIF(current_setting('app.tenant_id', true), '')` Pattern
- `GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO app_user`
- `GRANT USAGE, SELECT ON SEQUENCE ... TO app_user`
- `is_active` INTEGER Convention (0/1/3/4)

### Schritt 9: Docs aktualisieren

**Status:** Completed
**Datei:** `docs/DATABASE-MIGRATION-GUIDE.md`

Komplett ueberarbeitet mit:

- Neue Architektur-Uebersicht (node-pg-migrate statt docker cp + psql)
- CLI Commands Referenz
- Day 1 Procedure fuer bestehende DBs
- Migration-Checkliste (VOR/NACH)
- Seeds-Sektion
- Neues Problem 5: "Migration fehlgeschlagen (partial apply)"

---

## Bestehende DB migrieren (Day 1)

**Status:** Pending (muss auf jeder bestehenden DB-Instanz ausgefuehrt werden)

```bash
# 1. Backup erstellen
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/pre-node-pg-migrate.dump

# 2. Alle 15 Migrationen als "bereits ausgefuehrt" markieren
doppler run -- ./scripts/run-migrations.sh up --fake

# 3. Verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM pgmigrations ORDER BY run_on;"
```

---

## Neuer Workflow (ab jetzt)

```bash
# Neue Migration erstellen
doppler run -- pnpm run db:migrate:create add-employee-skills

# Migration editieren (database/migrations/20260128HHMMSS_add-employee-skills.ts)

# Dry-Run
doppler run -- ./scripts/run-migrations.sh up --dry-run

# Ausfuehren
doppler run -- ./scripts/run-migrations.sh up

# Rollback (letzte Migration)
doppler run -- ./scripts/run-migrations.sh down

# Seeds anwenden
doppler run -- pnpm run db:seed
```

---

## Dateien-Uebersicht

| Datei                                     | Aktion                              | Status    |
| ----------------------------------------- | ----------------------------------- | --------- |
| `package.json` (Root)                     | EDIT - devDep + Scripts             | Completed |
| `.node-pg-migraterc.json`                 | NEU - Config                        | Completed |
| `scripts/run-migrations.sh`               | NEU - DATABASE_URL Wrapper          | Completed |
| `scripts/run-seeds.sh`                    | NEU - Seed Runner                   | Completed |
| `database/migrations/*.sql` (14 Dateien)  | MOVE → `archive/`                   | Completed |
| `database/migrations/*.ts` (15 Dateien)   | NEU - TypeScript Migrationen        | Completed |
| `database/migrations/template.ts`         | NEU - Referenz-Template             | Completed |
| `database/seeds/001_global-seed-data.sql` | NEU - Idempotente Seeds             | Completed |
| `backend/package.json`                    | EDIT - Tote Scripts entfernen       | Completed |
| `docs/DATABASE-MIGRATION-GUIDE.md`        | EDIT - Neuen Workflow dokumentieren | Completed |

---

## Risiken & Mitigations

| Risiko                                    | Mitigation                                                                      | Status          |
| ----------------------------------------- | ------------------------------------------------------------------------------- | --------------- |
| ESM-Kompatibilitaet                       | `tsx` bereits installiert; `-j ts` Flag nutzt tsx                               | Kein Problem    |
| 676KB Baseline in Transaction             | `pgm.noTransaction()` falls noetig                                              | Nicht benoetigt |
| psql Meta-Commands (`\restrict`) in Seeds | Entfernt beim Umzug nach `seeds/`                                               | Erledigt        |
| `--fake` falsche Reihenfolge              | Alle 15 .ts Dateien VOR dem fake-Run erstellt                                   | Erledigt        |
| `pg` als peerDep                          | Bereits in backend installiert, workspace hoisting loest das auf                | Kein Problem    |
| Linter Import-Reihenfolge                 | Einige Migrationen hatten auto-fixed Import Order (node:fs vor node-pg-migrate) | Erledigt        |

---

## Verifizierung

| Test                                                 | Status    |
| ---------------------------------------------------- | --------- |
| `node-pg-migrate` v8.0.4 installiert                 | Completed |
| 15 TypeScript Migrationen erstellt                   | Completed |
| 14 SQL-Dateien archiviert                            | Completed |
| Seeds extrahiert + idempotent                        | Completed |
| Tote Scripts entfernt                                | Completed |
| Template erstellt                                    | Completed |
| Docs aktualisiert                                    | Completed |
| Wrapper-Scripts erstellt + chmod +x                  | Completed |
| `--fake` auf Dev-DB ausgefuehrt                      | Pending   |
| `pnpm run db:migrate:create test-check` funktioniert | Pending   |
| Backend startet normal                               | Pending   |
| `customer/fresh-install/install.sh` funktioniert     | Pending   |

---

## References

- [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md) - Die Architektur-Entscheidung
- [DATABASE-MIGRATION-GUIDE.md](../../DATABASE-MIGRATION-GUIDE.md) - Vollstaendige Anleitung
- [node-pg-migrate GitHub](https://github.com/salsita/node-pg-migrate)
- [database/migrations/template.ts](../../../database/migrations/template.ts) - Referenz-Template

---

_Last Updated: 2026-01-27 (v1 - All implementation steps completed, Day 1 pending)_
