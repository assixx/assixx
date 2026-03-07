# FEAT: pg_partman — Automatic Partition Management — Execution Masterplan

> **Created:** 2026-02-24
> **Version:** 0.6.0 (Draft — Validiert: API-Korrekturen + Orphan-Logging)
> **Status:** COMPLETE — Alle 3 Phasen abgeschlossen
> **Branch:** `feat/pg-partman`
> **Context:** Migration Audit Session 2026-02-24 — Zeitbombe in Migration #004/#051 identifiziert
> **Author:** Claude + Entwickler (Senior Engineer)
> **Estimated Sessions:** 3
> **Actual Sessions:** 3 / 3 (alle am 2026-03-06)

---

## Changelog

| Version | Datum      | Änderung                                                                                    |
| ------- | ---------- | ------------------------------------------------------------------------------------------- |
| 0.6.0   | 2026-03-06 | Validierungsreview: `p_jobmon := false` fix, Orphan-Logging im `down()`, DST-Boundary-Check |
| 0.5.0   | 2026-03-06 | Komplett-Rewrite: Eigenes Dockerfile, `create_partition()` API (5.4.3), neues Template      |
| 0.4.0   | 2026-03-06 | Testplan: 7 Tests (T1-T7), max_locks_per_transaction, pgTAP-Klarstellung                    |
| 0.3.0   | 2026-03-06 | Kompatibilitäts-Audit: Migration Guide + Customer Fresh-Install abgeglichen                 |
| 0.2.0   | 2026-03-06 | Validierungsreview: 2 kritische Fehler korrigiert, Partition-Rename hinzugefügt             |
| 0.1.0   | 2026-02-24 | Initial Draft — 3 Phasen geplant                                                            |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Feature vollständig abgeschlossen
> - Patch `x.x.1` = Hotfix/Nacharbeit innerhalb einer Phase

---

## Motivation

### Das Problem

Migration #004 hat Partitionen für `audit_trail` und `root_logs` **manuell** erstellt — hardcoded für 2025-2027. Migration #051 hat das auf 2028-2032 erweitert. Aber das Grundproblem bleibt:

**Jemand muss alle paar Jahre dran denken, eine neue Migration zu schreiben.**

In Production denkt niemand dran. Das ist keine Lösung, das ist ein Pflaster.

### Die Lösung

[pg_partman](https://github.com/pgpartman/pg_partman) v5.4.3 — PostgreSQL-Extension die Partitionen **automatisch** erstellt. Industriestandard, battle-tested, PostgreSQL 14+ kompatibel.

**Ohne pg_partman** = 900 Zeilen SQL heute und Panik 2099.
**Mit pg_partman** = 5 Zeilen Config und es regelt sich selbst. Für immer.

### Technische Eckdaten

| Eigenschaft               | Wert                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| pg_partman Version        | **5.4.3** (released 2026-03-05)                                                               |
| Quelle                    | [github.com/pgpartman/pg_partman](https://github.com/pgpartman/pg_partman) (offizielles Repo) |
| Docker-Strategie          | **Eigenes Dockerfile** (`postgres:17-alpine` + Source-Build)                                  |
| API                       | `create_partition()` (neue 5.4.x API, ersetzt `create_parent()`)                              |
| PostgreSQL-Kompatibilität | 14+ (wir: 17.x)                                                                               |
| Referenz                  | [pgxn.org/dist/pg_partman/5.4.3](https://pgxn.org/dist/pg_partman/5.4.3/)                     |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt
- [ ] Branch `feat/pg-partman` checked out
- [ ] Keine pending Migrations
- [ ] TPM-Feature gemerged (oder bewusste Entscheidung parallel zu arbeiten)

### 0.2 Risk Register

| #   | Risiko                                                 | Impact  | Wahrsch. | Mitigation                                                                | Verifikation                                                                                                                                                                               |
| --- | ------------------------------------------------------ | ------- | -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Source-Build schlägt auf Alpine fehl (LLVM/clang)      | Hoch    | Mittel   | Fallback: `make NO_BGW=1 install` + Cron statt BGW; oder Debian-Base      | `docker build` im CI testen bevor Merge — **EINGETRETEN:** Alpine hat `clang-21`, PostgreSQL erwartet `clang-19`. Fix: Symlinks im Dockerfile (`ln -sf clang-21 clang-19` + LLVM bin dir). |
| R2  | pg_partman erkennt bestehende Partitionen nicht        | Hoch    | Mittel   | Partitionen MÜSSEN auf `_pYYYYMMDD` umbenannt werden VOR Registration     | `SELECT * FROM partman.part_config` + `show_partitions()` nach Setup                                                                                                                       |
| R3  | Image-Wechsel bricht PostgreSQL-Daten                  | Hoch    | Niedrig  | Volume bleibt erhalten; nur Extension wird hinzugefügt                    | `SELECT version()` + Tabellenzählung vor/nach Wechsel                                                                                                                                      |
| R4  | 192 Renames brauchen zu viele Locks                    | Mittel  | Niedrig  | Shared Lock Table fasst 6400 Einträge (64×100); `max_locks=128` empfohlen | Migration mit `--dry-run` vorher testen                                                                                                                                                    |
| R5  | `shared_preload_libraries` erfordert Container-Restart | Niedrig | Hoch     | Geplanter Restart, kein Hot-Reload möglich                                | In docker-compose einplanen                                                                                                                                                                |
| R6  | pg_partman Major-Update bricht Build                   | Mittel  | Niedrig  | Version-Pin via `ARG PG_PARTMAN_VERSION=v5.4.3` im Dockerfile             | Jährlich GitHub-Releases prüfen                                                                                                                                                            |

### 0.3 Ecosystem Integration Points

| Bestehendes System           | Art der Integration                                  | Phase |
| ---------------------------- | ---------------------------------------------------- | ----- |
| docker-compose.yml           | `build:` statt `image:` + `shared_preload_libraries` | 1     |
| audit_trail (96 Partitionen) | Rename → `_pYYYYMMDD` + pg_partman Registration      | 2     |
| root_logs (96 Partitionen)   | Rename → `_pYYYYMMDD` + pg_partman Registration      | 2     |
| Backend (NestJS)             | Keine Änderung — transparent auf DB-Ebene            | —     |
| Frontend (SvelteKit)         | Keine Änderung                                       | —     |
| Grafana/Prometheus           | Keine Änderung (anderer Container)                   | —     |
| customer/fresh-install       | Dockerfile + Extensions + README aktualisieren       | 3     |

---

## Phase 1: Docker Infrastructure

> **Abhängigkeit:** Keine (erste Phase)
> **Dateien:** 1 neue Datei, 1 geänderte Datei

### Step 1.1: Dockerfile.pg-partman erstellen [PENDING]

**Neue Datei:** `docker/Dockerfile.pg-partman`

```dockerfile
# =============================================================================
# PostgreSQL 17 + pg_partman 5.4.3 — Built from Source
# =============================================================================
# Base: Official postgres:17-alpine (maintained by PostgreSQL Docker Team)
# Extension: pg_partman from official pgpartman/pg_partman GitHub repo
# =============================================================================

FROM postgres:17-alpine

ARG PG_PARTMAN_VERSION=v5.4.3

RUN set -eux \
    && apk add --no-cache --virtual .build-deps \
       build-base \
       clang \
       llvm-dev \
       git \
    && git clone --branch ${PG_PARTMAN_VERSION} --depth 1 \
       https://github.com/pgpartman/pg_partman.git /tmp/pg_partman \
    && cd /tmp/pg_partman \
    && make \
    && make install \
    && apk del .build-deps \
    && rm -rf /tmp/pg_partman /var/cache/apk/*
```

**Warum eigenes Dockerfile statt Third-Party-Image:**

- `postgres:17-alpine` = offizielles PostgreSQL Docker Team Image
- `pgpartman/pg_partman` = offizielles pg_partman Repo
- Zero Drittanbieter-Risiko (kein dbsystel, kein Docker Hub Random Image)
- Version-Pin via `ARG` — wir kontrollieren Updates
- Alpine = ~90MB (statt ~400MB Debian)
- `make install` = 1 C-Datei (BGW) + SQL Scripts — trivial

**Fallback bei Build-Problemen:**

Falls `clang`/`llvm-dev` auf Alpine nicht verfügbar oder inkompatibel:

```dockerfile
# Option A: Ohne BGW (Maintenance via Cron/manuell)
RUN make NO_BGW=1 install

# Option B: Debian-Base (größer aber garantiert kompatibel)
FROM postgres:17
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential git postgresql-server-dev-17 \
    && git clone ... && make && make install \
    && apt-get purge -y build-essential git postgresql-server-dev-17 \
    && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
```

### Step 1.2: docker-compose.yml anpassen [PENDING]

**Geänderte Datei:** `docker/docker-compose.yml`

**Änderungen am `postgres` Service:**

```yaml
postgres:
  # ALT: image: postgres:17-alpine
  # NEU: Eigener Build mit pg_partman
  build:
    context: .
    dockerfile: Dockerfile.pg-partman
  image: assixx-postgres:17-partman
  container_name: assixx-postgres
  restart: unless-stopped
  # ... (deploy, environment, ports, volumes, networks, healthcheck bleiben identisch)
  command:
    - 'postgres'
    - '-c'
    - 'shared_preload_libraries=pg_stat_statements,pg_partman_bgw'
    - '-c'
    - 'pg_stat_statements.track=all'
    - '-c'
    - 'pg_stat_statements.max=10000'
    - '-c'
    - 'track_io_timing=on'
    # pg_partman Background Worker
    - '-c'
    - 'pg_partman_bgw.dbname=assixx'
    - '-c'
    - 'pg_partman_bgw.interval=86400'
    - '-c'
    - 'pg_partman_bgw.role=assixx_user'
    - '-c'
    - 'pg_partman_bgw.jobmon=off'
    # pg_partman Empfehlung
    - '-c'
    - 'max_locks_per_transaction=128'
```

**BGW-Konfiguration:**

| Parameter                   | Wert          | Begründung                                       |
| --------------------------- | ------------- | ------------------------------------------------ |
| `pg_partman_bgw.dbname`     | `assixx`      | Unsere einzige Datenbank                         |
| `pg_partman_bgw.interval`   | `86400`       | Täglich (1x pro Tag reicht für monatliche Part.) |
| `pg_partman_bgw.role`       | `assixx_user` | Hat DDL-Rechte (BYPASSRLS)                       |
| `pg_partman_bgw.jobmon`     | `off`         | pg_jobmon nicht installiert                      |
| `max_locks_per_transaction` | `128`         | pg_partman Empfehlung (Default: 64)              |

### Step 1.3: Container neu bauen und verifizieren [PENDING]

```bash
cd /home/scs/projects/Assixx/docker

# 1. Backup erstellen (PFLICHT!)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > ../database/backups/pre_pg_partman_${TIMESTAMP}.dump

# 2. Container stoppen + neu bauen
doppler run -- docker-compose down
doppler run -- docker-compose build postgres
doppler run -- docker-compose up -d

# 3. Warten bis healthy
sleep 15
doppler run -- docker-compose ps
```

**Verifikation:**

```bash
# PostgreSQL Version unverändert
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT version();"

# Alle Tabellen noch da
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';"

# pg_partman Extension verfügbar (noch nicht installiert!)
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT name, default_version FROM pg_available_extensions WHERE name = 'pg_partman';"
# Erwartung: pg_partman | 5.4.3

# shared_preload_libraries korrekt
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SHOW shared_preload_libraries;"
# Erwartung: pg_stat_statements,pg_partman_bgw

# pg_stat_statements funktioniert weiterhin
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT COUNT(*) FROM pg_stat_statements;"

# Backend healthy
curl -s http://localhost:3000/health | jq '.status'
```

### Phase 1 — Definition of Done

- [ ] `docker/Dockerfile.pg-partman` erstellt mit pg_partman v5.4.3 Source-Build
- [ ] `docker/docker-compose.yml` nutzt `build:` statt `image:` für postgres Service
- [ ] `shared_preload_libraries` enthält `pg_stat_statements,pg_partman_bgw`
- [ ] Container startet ohne Errors
- [ ] PostgreSQL Version = 17.x (unverändert)
- [ ] Tabellenanzahl identisch zu vor dem Wechsel
- [ ] `pg_partman` 5.4.3 in `pg_available_extensions` sichtbar
- [ ] `pg_stat_statements` funktioniert weiterhin
- [ ] Backend healthy nach Container-Rebuild

---

## Phase 2: Database Migration

> **Abhängigkeit:** Phase 1 complete
> **Dateien:** 1 neue Migrationsdatei
>
> **KOMPATIBILITÄTSREGELN (aus DATABASE-MIGRATION-GUIDE.md):**
>
> - Kein `IF NOT EXISTS` im `up()` — Migration-Runner garantiert Einmaligkeit
> - FAIL LOUD bei Fehlern — `RAISE EXCEPTION`, nicht stillschweigend ignorieren
> - Lossy Rollback → `WARNING`-Header Pflicht
> - Backup + Dry Run vor Apply

### Step 2.0: Backup + Dry Run (PFLICHT)

```bash
# 1. Backup erstellen
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/pre_pg_partman_migration_${TIMESTAMP}.dump

# 2. Dry Run
doppler run -- ./scripts/run-migrations.sh up --dry-run
```

### Step 2.1: Migration erstellen [PENDING]

**Neue Datei:** `database/migrations/YYYYMMDDNNNNNN_setup-pg-partman.ts`

**Migration-Header (PFLICHT — lossy rollback):**

```typescript
/**
 * Migration: Setup pg_partman for automatic partition management
 *
 * Registers audit_trail and root_logs with pg_partman v5.4.3 for automatic
 * monthly partition creation. Replaces manual partition migrations.
 *
 * WARNING: Lossy rollback. Partitions created by pg_partman after 2032
 * cannot be renamed back to legacy format. Manual cleanup required.
 *
 * Supersedes: Migration 20260224000051 (extend-audit-partitions-2028-2032)
 */
```

**up() — 5 Schritte:**

```sql
-- ================================================================
-- Step 0: Pre-Check — Partitionen verifizieren (FAIL LOUD)
-- ================================================================
DO $$
DECLARE
    at_count INTEGER;
    rl_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO at_count
    FROM pg_inherits WHERE inhparent = 'audit_trail'::regclass;

    SELECT COUNT(*) INTO rl_count
    FROM pg_inherits WHERE inhparent = 'root_logs'::regclass;

    IF at_count <> 96 THEN
        RAISE EXCEPTION 'Expected 96 audit_trail partitions, found %', at_count;
    END IF;

    IF rl_count <> 96 THEN
        RAISE EXCEPTION 'Expected 96 root_logs partitions, found %', rl_count;
    END IF;

    RAISE NOTICE 'Pre-check passed: % audit_trail + % root_logs partitions', at_count, rl_count;
END $$;

-- ================================================================
-- Step 1: Schema + Extension erstellen
-- KEIN IF NOT EXISTS — Migration-Runner garantiert Einmaligkeit.
-- ================================================================
CREATE SCHEMA partman;
CREATE EXTENSION pg_partman SCHEMA partman;

-- ================================================================
-- Step 2: Bestehende Partitionen auf pg_partman-Namensschema umbenennen
-- IST:  audit_trail_2025_01    → SOLL: audit_trail_p20250101
-- IST:  root_logs_2025_01      → SOLL: root_logs_p20250101
-- 192 Renames total (96 pro Tabelle, 2025_01 bis 2032_12)
-- ================================================================
DO $$
DECLARE
    y INTEGER;
    m INTEGER;
    old_at TEXT;
    new_at TEXT;
    old_rl TEXT;
    new_rl TEXT;
BEGIN
    FOR y IN 2025..2032 LOOP
        FOR m IN 1..12 LOOP
            old_at := format('audit_trail_%s_%s', y, lpad(m::TEXT, 2, '0'));
            new_at := format('audit_trail_p%s%s01', y, lpad(m::TEXT, 2, '0'));
            old_rl := format('root_logs_%s_%s', y, lpad(m::TEXT, 2, '0'));
            new_rl := format('root_logs_p%s%s01', y, lpad(m::TEXT, 2, '0'));

            EXECUTE format('ALTER TABLE %I RENAME TO %I', old_at, new_at);
            EXECUTE format('ALTER TABLE %I RENAME TO %I', old_rl, new_rl);
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Renamed 192 partitions to pg_partman naming (_pYYYYMMDD)';
END $$;

-- ================================================================
-- Step 3: Tabellen bei pg_partman registrieren
-- create_partition() = neue 5.4.x API (ersetzt create_parent())
-- pg_partman erkennt die umbenannten Partitionen und übernimmt.
-- ================================================================
SELECT partman.create_partition(
    p_parent_table  := 'public.audit_trail',
    p_control       := 'created_at',
    p_interval      := '1 month',
    p_premake       := 12,
    p_default_table := true,
    p_jobmon        := false
);

SELECT partman.create_partition(
    p_parent_table  := 'public.root_logs',
    p_control       := 'created_at',
    p_interval      := '1 month',
    p_premake       := 12,
    p_default_table := true,
    p_jobmon        := false
);

-- ================================================================
-- Step 4: Privilege-Vererbung aktivieren
-- Neue Partitionen erben GRANTs automatisch vom Parent.
-- ================================================================
UPDATE partman.part_config
SET inherit_privileges = true
WHERE parent_table IN ('public.audit_trail', 'public.root_logs');
```

**Konfigurationswerte:**

| Parameter            | Wert        | Begründung                                               |
| -------------------- | ----------- | -------------------------------------------------------- |
| `p_interval`         | `'1 month'` | Konsistent mit bestehendem Partitionsschema              |
| `p_premake`          | `12`        | Immer 12 Monate voraus = 1 Jahr Puffer                   |
| `p_default_table`    | `true`      | Catch-all Partition — verhindert INSERT-Failures zu 100% |
| `p_jobmon`           | `false`     | pg_jobmon nicht installiert — explizit deaktivieren      |
| `inherit_privileges` | `true`      | Neue Partitionen erben GRANTs automatisch                |

**down() — Sauberes Rollback:**

```sql
-- ================================================================
-- Step 1: pg_partman Config sauber entfernen (5.4.0+ API)
-- config_cleanup() entfernt nur die Config, nicht die Tabellen.
-- ================================================================
SELECT partman.config_cleanup('public.audit_trail');
SELECT partman.config_cleanup('public.root_logs');

-- ================================================================
-- Step 2: DEFAULT Partitionen droppen (FAIL LOUD bei Daten!)
-- ================================================================
DO $$
DECLARE
    at_default_count BIGINT;
    rl_default_count BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_trail_default') THEN
        SELECT COUNT(*) INTO at_default_count FROM audit_trail_default;
        IF at_default_count > 0 THEN
            RAISE EXCEPTION 'Cannot drop audit_trail_default: contains % rows — manual migration required', at_default_count;
        END IF;
        DROP TABLE audit_trail_default;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'root_logs_default') THEN
        SELECT COUNT(*) INTO rl_default_count FROM root_logs_default;
        IF rl_default_count > 0 THEN
            RAISE EXCEPTION 'Cannot drop root_logs_default: contains % rows — manual migration required', rl_default_count;
        END IF;
        DROP TABLE root_logs_default;
    END IF;
END $$;

-- ================================================================
-- Step 3: Extension + Schema droppen
-- ================================================================
DROP EXTENSION pg_partman CASCADE;
DROP SCHEMA partman CASCADE;

-- ================================================================
-- Step 4: Partitionen zurück auf altes Namensschema
-- ================================================================
DO $$
DECLARE
    y INTEGER;
    m INTEGER;
    old_name TEXT;
    new_name TEXT;
BEGIN
    FOR y IN 2025..2032 LOOP
        FOR m IN 1..12 LOOP
            old_name := format('audit_trail_p%s%s01', y, lpad(m::TEXT, 2, '0'));
            new_name := format('audit_trail_%s_%s', y, lpad(m::TEXT, 2, '0'));
            IF EXISTS (SELECT 1 FROM pg_class WHERE relname = old_name) THEN
                EXECUTE format('ALTER TABLE %I RENAME TO %I', old_name, new_name);
            END IF;

            old_name := format('root_logs_p%s%s01', y, lpad(m::TEXT, 2, '0'));
            new_name := format('root_logs_%s_%s', y, lpad(m::TEXT, 2, '0'));
            IF EXISTS (SELECT 1 FROM pg_class WHERE relname = old_name) THEN
                EXECUTE format('ALTER TABLE %I RENAME TO %I', old_name, new_name);
            END IF;
        END LOOP;
    END LOOP;

    -- Partitionen >2032 (von pg_partman erstellt) behalten pg_partman-Namen.
    -- Diese haben kein Legacy-Äquivalent und müssen manuell gehandhabt werden.
    RAISE NOTICE 'Renamed partitions back to legacy naming (_YYYY_MM)';
    RAISE NOTICE 'Orphan audit_trail partitions (manual cleanup): %',
        COALESCE((SELECT string_agg(inhrelid::regclass::text, ', ')
         FROM pg_inherits
         WHERE inhparent = 'audit_trail'::regclass
         AND inhrelid::regclass::text LIKE '%_p%'), 'none');
    RAISE NOTICE 'Orphan root_logs partitions (manual cleanup): %',
        COALESCE((SELECT string_agg(inhrelid::regclass::text, ', ')
         FROM pg_inherits
         WHERE inhparent = 'root_logs'::regclass
         AND inhrelid::regclass::text LIKE '%_p%'), 'none');
END $$;
```

### Step 2.2: Migration #051 als obsolet markieren [PENDING]

Kommentar zu `database/migrations/20260224000051_extend-audit-partitions-2028-2032.ts` hinzufügen:

```typescript
/**
 * NOTE: Superseded by pg_partman setup (Migration NNNNNN).
 * pg_partman now automatically manages all future partitions.
 * This migration remains for historical completeness.
 */
```

**Verifikation nach Migration:**

```bash
# pg_partman Config
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT parent_table, control, partition_interval, premake, inherit_privileges FROM partman.part_config;"

# Umbenannte Partitionen (neues Schema)
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT inhrelid::regclass FROM pg_inherits WHERE inhparent = 'audit_trail'::regclass ORDER BY inhrelid::regclass LIMIT 5;"
# Erwartung: audit_trail_p20250101, audit_trail_p20250201, ...

# DEFAULT Partition existiert
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM partman.check_default(p_exact_count := true);"
# Erwartung: 0 Rows in DEFAULT

# Lücken prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM partman.partition_gap_fill('public.audit_trail');"
```

### Phase 2 — Definition of Done

- [ ] 192 Partitionen umbenannt auf `_pYYYYMMDD` Schema
- [ ] Keine Partitionen mit altem `_YYYY_MM` Schema mehr vorhanden
- [ ] `pg_partman` Extension installiert und aktiv
- [ ] `audit_trail` in `partman.part_config` registriert mit `premake=12`
- [ ] `root_logs` in `partman.part_config` registriert mit `premake=12`
- [ ] DEFAULT Partitionen für beide Tabellen existieren und sind leer
- [ ] `inherit_privileges = true` für beide Tabellen
- [ ] `partition_gap_fill()` meldet keine Lücken
- [ ] Backend kompiliert und läuft fehlerfrei
- [ ] Migration #051 als superseded kommentiert

---

## Phase 3: Verification + Documentation

> **Abhängigkeit:** Phase 2 complete

### Step 3.1: Testplan ausführen (T1-T7) [PENDING]

Siehe [Testplan](#testplan) unten. Alle 7 Tests müssen bestanden sein.

### Step 3.2: Customer Fresh-Install synchronisieren [PENDING]

**KRITISCH:** pg_partman erfordert Änderungen am gesamten Customer-Deployment:

1. **`customer/fresh-install/003_extensions.sql` erweitern:**

```sql
-- Bestehend:
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- NEU:
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;
```

2. **`Dockerfile.pg-partman` in Customer-Deployment dokumentieren** — Customer muss unser Dockerfile verwenden
3. **Customer docker-compose braucht `pg_partman_bgw` in `shared_preload_libraries`**
4. **`customer/README.md` aktualisieren:** Tabellenanzahl (DEFAULT Partitionen + Premake = mehr als 320), Docker-Hinweis

```bash
# Schema-Dump synchronisieren
doppler run -- ./scripts/sync-customer-migrations.sh

# Verifizieren: partman im Dump
grep -c "partman" customer/fresh-install/001_schema.sql
```

### Step 3.3: ADR-029 schreiben [PENDING]

**Neue Datei:** `docs/infrastructure/adr/ADR-029-pg-partman-partition-management.md`

**Inhalt:**

- Entscheidung: pg_partman statt manuelle Migrations
- Entscheidung: Eigenes Dockerfile statt Third-Party-Image
- Konfiguration: `create_partition()` API, premake=12, monthly
- Rollback-Strategie: `config_cleanup()` + Rename
- Alternativen: Manuelle Partitions bis 2100 (verworfen — verschiebt Problem)

### Step 3.4: DATABASE-MIGRATION-GUIDE.md updaten [PENDING]

Neuen Abschnitt hinzufügen:

```markdown
## Partition Management (pg_partman)

Partitionen für `audit_trail` und `root_logs` werden automatisch von pg_partman verwaltet.

**KEINE manuellen Partition-Migrations mehr nötig.**

pg_partman Background Worker läuft täglich und erstellt fehlende Partitionen 12 Monate im Voraus.

### Monitoring

docker exec assixx-postgres psql -U assixx_user -d assixx \
 -c "SELECT parent_table, premake, retention FROM partman.part_config;"

docker exec assixx-postgres psql -U assixx_user -d assixx \
 -c "SELECT \* FROM partman.check_default(p_exact_count := true);"

docker exec assixx-postgres psql -U assixx_user -d assixx \
 -c "CALL partman.run_maintenance_proc();"
```

### Phase 3 — Definition of Done

- [ ] Testplan T1-T7 komplett bestanden
- [ ] Customer `003_extensions.sql` enthält pg_partman Extension
- [ ] Customer Deployment-Anleitung dokumentiert (Dockerfile + BGW-Config)
- [ ] Customer `README.md` Tabellenanzahl aktualisiert
- [ ] ADR-029 geschrieben
- [ ] DATABASE-MIGRATION-GUIDE.md um pg_partman-Sektion erweitert
- [ ] Keine offenen TODOs im Code

---

## Testplan

> **Kontext:** pg_partman hat eigene pgTAP-Tests — die sind für pg_partman-Entwickler.
> Wir brauchen unsere eigenen Tests, die die INTEGRATION verifizieren.

### T1: Datenintegrität nach Rename

```bash
# Vorher: Row-Counts speichern
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT 'audit_trail' AS tbl, COUNT(*) FROM audit_trail
UNION ALL
SELECT 'root_logs', COUNT(*) FROM root_logs;"

# Migration ausführen...

# Nachher: Gleiche Counts
# Erwartung: IDENTISCHE Zahlen
```

### T2: RLS funktioniert auf umbenannten Partitionen

```bash
# Als app_user MIT Tenant Context
docker exec assixx-postgres psql -U app_user -d assixx -c "
SET app.tenant_id = '1';
SELECT COUNT(*) FROM audit_trail;"

# RLS Policies noch vorhanden
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('audit_trail', 'root_logs');"
```

### T3: INSERT landet in korrekter Partition

```bash
# 1. Login erzeugt Audit-Log-Eintrag
curl -s http://localhost:3000/api/v2/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@apitest.de","password":"ApiTest12345!"}' | jq '.success'

# 2. Eintrag in aktueller Monatspartition
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT tableoid::regclass AS partition, id, action, created_at
FROM audit_trail ORDER BY created_at DESC LIMIT 3;"
# Erwartung: audit_trail_p20260301

# 3. DEFAULT Partition MUSS leer sein
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT * FROM partman.check_default(p_exact_count := true);"
# Erwartung: 0
```

### T4: pg_partman Maintenance erstellt Partitionen

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
CALL partman.run_maintenance_proc();"

# Partitionen reichen 12 Monate in die Zukunft
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT inhrelid::regclass FROM pg_inherits JOIN pg_class ON inhrelid = oid
WHERE inhparent = 'audit_trail'::regclass
ORDER BY relname DESC LIMIT 5;"
# Erwartung: audit_trail_p20270301 oder weiter

# Keine Lücken
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT * FROM partman.partition_gap_fill('public.audit_trail');"
```

### T5: Background Worker läuft

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT pid, backend_type, state
FROM pg_stat_activity WHERE backend_type LIKE '%partman%';"
# Erwartung: Mindestens 1 Row
```

### T6: Bestehende Test-Suites (Regression)

```bash
pnpm run test:api:vitest
pnpm run test:unit
docker exec assixx-backend pnpm run type-check
cd /home/scs/projects/Assixx/frontend && pnpm run check
```

### T7: GRANTs auf neue Partitionen

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'audit_trail_default' AND grantee = 'app_user';"
# Erwartung: SELECT, INSERT, UPDATE, DELETE
```

### Testplan — Checkliste

| Test | Phase | Was wird geprüft                         | Bestanden? |
| ---- | ----- | ---------------------------------------- | ---------- |
| T1   | 2     | Row-Counts identisch nach Rename         | [ ]        |
| T2   | 2     | RLS funktioniert auf umbenannten Part.   | [ ]        |
| T3   | 3     | INSERT landet in richtiger Partition     | [ ]        |
| T4   | 3     | Maintenance erstellt Zukunftspartitionen | [ ]        |
| T5   | 3     | Background Worker aktiv                  | [ ]        |
| T6   | 2+3   | Alle Test-Suites grün                    | [ ]        |
| T7   | 3     | GRANTs auf DEFAULT + neue Partitionen    | [ ]        |

---

## Session Tracking

| Session | Phase | Beschreibung                                  | Status | Datum      |
| ------- | ----- | --------------------------------------------- | ------ | ---------- |
| 1       | 1     | Dockerfile + docker-compose + Container-Build | DONE   | 2026-03-06 |
| 2       | 2     | Migration erstellen + apply + Tests T1-T2     | DONE   | 2026-03-06 |
| 3       | 3     | E2E Tests T3-T7 + Customer Sync + ADR + Docs  | DONE   | 2026-03-06 |

---

## Quick Reference: File Paths

### Neue Dateien

| Datei                                                                | Zweck                            |
| -------------------------------------------------------------------- | -------------------------------- |
| `docker/Dockerfile.pg-partman`                                       | PostgreSQL 17 + pg_partman 5.4.3 |
| `database/migrations/YYYYMMDDNNNNNN_setup-pg-partman.ts`             | Rename + Registration Migration  |
| `docs/infrastructure/adr/ADR-029-pg-partman-partition-management.md` | Architekturentscheidung          |

### Geänderte Dateien

| Datei                                            | Änderung                                             |
| ------------------------------------------------ | ---------------------------------------------------- |
| `docker/docker-compose.yml`                      | `build:` statt `image:` + BGW-Config                 |
| `docker/postgres-init/002_create_extensions.sql` | pg_partman Extension Hinweis (optional, Init-Script) |
| `customer/fresh-install/003_extensions.sql`      | pg_partman Extension hinzufügen                      |
| `customer/README.md`                             | Docker Image + Tabellenanzahl aktualisieren          |
| `docs/DATABASE-MIGRATION-GUIDE.md`               | pg_partman Monitoring-Sektion                        |

### Obsolete Dateien (bleiben, werden kommentiert)

| Datei                                                                     | Warum obsolet                          |
| ------------------------------------------------------------------------- | -------------------------------------- |
| `database/migrations/20260224000051_extend-audit-partitions-2028-2032.ts` | pg_partman macht das jetzt automatisch |

---

## Spec Deviations

| #   | Ursprüngliche Empfehlung       | Tatsächliche Entscheidung               | Begründung                                         |
| --- | ------------------------------ | --------------------------------------- | -------------------------------------------------- |
| D1  | NestJS Cron + DEFAULT          | pg_partman BGW                          | DB-Ebene > App-Ebene; kein SPOF; Industriestandard |
| D2  | dbsystel/postgresql-partman    | Eigenes Dockerfile (postgres:17-alpine) | Zero Drittanbieter-Risiko; offizielles Base-Image  |
| D3  | `create_parent()` (5.x compat) | `create_partition()` (5.4.x API)        | Neue empfohlene API ab 5.4.0; cleaner Signature    |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Retention (alte Partitionen löschen)** — Erst aktivieren wenn Archivierungsstrategie definiert (Business-Entscheidung: Wie lange Audit-Logs aufbewahren?). pg_partman kann `retention = '3 years'` + `retention_keep_table = true` konfigurieren.
2. **Subpartitioning** — Nicht nötig. Monatliche Partitionen reichen für unser Datenvolumen.
3. **pg_jobmon Integration** — Optional Monitoring-Extension. Deaktiviert (`pg_partman_bgw.jobmon=off`). Kann später installiert und aktiviert werden.
4. **`create_parent()` Fallback** — Falls `create_partition()` (5.4.x) unerwartete Probleme macht, ist `create_parent()` backward-compatible verfügbar. Dann mit `p_jobmon := false` aufrufen.

---

## Validierungshistorie

### Rewrite-Entscheidung (0.5.0)

| Änderung           | Alt (0.4.0)                                | Neu (0.5.0)                                       | Begründung                                            |
| ------------------ | ------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------- |
| Docker Image       | `ghcr.io/dbsystel/postgresql-partman:17-5` | Eigenes `Dockerfile.pg-partman` (Alpine + Source) | Zero Drittanbieter-Risiko                             |
| pg_partman API     | `create_parent()` (legacy)                 | `create_partition()` (5.4.x)                      | Neue empfohlene API                                   |
| pg_partman Version | Generisch "v5.x"                           | Explizit v5.4.3 (2026-03-05)                      | Version-Pin für Reproduzierbarkeit                    |
| `down()` Cleanup   | `DROP EXTENSION CASCADE`                   | `config_cleanup()` + `DROP EXTENSION`             | Sauberer; trennt Config-Removal von Extension-Removal |
| `check_default()`  | Manuelles `SELECT COUNT(*)`                | `partman.check_default(p_exact_count := true)`    | Offizielle API statt manueller Query                  |
| Gap Detection      | Nicht vorhanden                            | `partman.partition_gap_fill()`                    | Offizielle API für Lücken-Erkennung                   |
| Template           | Freiform                                   | HOW-TO-PLAN-SAMPLE.md konform                     | Konsistenz mit anderen Feature-Plans                  |

### Kompatibilitäts-Audit (0.3.0 → übertragen)

Geprüft gegen `docs/DATABASE-MIGRATION-GUIDE.md` und `customer/README.md`:

| #   | Schwere  | Inkompatibilität                          | Korrektur                                              |
| --- | -------- | ----------------------------------------- | ------------------------------------------------------ |
| C1  | HOCH     | `IF NOT EXISTS` im `up()` verboten        | `CREATE SCHEMA` + `CREATE EXTENSION` ohne Guard        |
| C2  | HOCH     | Lossy Rollback ohne WARNING-Header        | Migration-Header mit `WARNING: Lossy rollback` ergänzt |
| C3  | KRITISCH | `down()` droppt DEFAULT ohne Datenprüfung | FAIL LOUD: `RAISE EXCEPTION` wenn Daten vorhanden      |
| C4  | MITTEL   | Backup + Dry Run nicht erwähnt            | Step 2.0 mit Backup + Dry Run                          |
| C5  | MITTEL   | Hardcoded `2025..2032` ohne Pre-Check     | Pre-Check: 96 Partitionen pro Tabelle verifizieren     |
| C6  | KRITISCH | Customer Docker muss pg_partman haben     | Dockerfile + Extensions + README in Phase 3            |

### Validierungsreview (0.6.0)

| #   | Schwere | Problem                                           | Korrektur                                                        |
| --- | ------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| P1  | MITTEL  | `p_jobmon := false` fehlt in `create_partition()` | Beide Aufrufe um `p_jobmon := false` ergänzt                     |
| P2  | INFO    | DST-Shift in Partition-Boundaries (+01/+02)       | Kein Fix nötig — `timestamptz` wird intern als UTC gespeichert   |
| P3  | NIEDRIG | `down()` loggt keine Orphan-Partitionen >2032     | RAISE NOTICE mit `string_agg()` für Orphan-Erkennung hinzugefügt |

**Verifizierungsmethode:** Direkte DB-Queries gegen laufende PostgreSQL-Instanz + pg_partman v5.4.0/v5.4.3 Release Notes + GitHub API-Docs.

### Verifizierte Fakten (2026-03-06)

- PostgreSQL Version: **17.9**
- Bestehende Partitionen: **96 pro Tabelle** (2025_01 bis 2032_12)
- Namensschema: `audit_trail_2025_01` / `root_logs_2025_01` (ohne `_p` Prefix)
- Partition Key: `RANGE (created_at)` — kompatibel mit pg_partman
- DEFAULT Partitionen: **existieren NICHT** (werden von `create_partition()` erstellt)
- pg_partman 5.4.3: **verfügbar** auf pgxn.org + GitHub (released 2026-03-05)
- pg_partman API: `create_partition()` neue 5.4.x API, `create_parent()` backward-compatible

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- {wird nach Abschluss ausgefüllt}

### Was lief schlecht

- {wird nach Abschluss ausgefüllt}

### Metriken

| Metrik            | Geplant | Tatsächlich |
| ----------------- | ------- | ----------- |
| Sessions          | 3       |             |
| Neue Dateien      | 3       |             |
| Geänderte Dateien | 5       |             |
| Tests (T1-T7)     | 7       |             |
| Spec Deviations   | 3       |             |

---

## Referenzen

| #   | Quelle                                                                                                   | Inhalt                                            |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| R1  | [pgpartman/pg_partman (GitHub)](https://github.com/pgpartman/pg_partman)                                 | Offizielles Repository, README, Source Code       |
| R2  | [pg_partman 5.4.3 (PGXN)](https://pgxn.org/dist/pg_partman/5.4.3/)                                       | Release-Info, Installation, Version               |
| R3  | [pg_partman 5.4.3 CHANGELOG](https://pgxn.org/dist/pg_partman/5.4.3/CHANGELOG.html)                      | Changelog: `create_partition()` ab 5.4.0          |
| R4  | [pg_partman HowTo Guide](https://pgxn.org/dist/pg_partman/5.4.3/doc/pg_partman_howto.html)               | Setup, Migration, Maintenance, API-Beispiele      |
| R5  | [pg_partman Referenz-Docs](https://github.com/pgpartman/pg_partman/blob/master-old/doc/pg_partman.md)    | `create_parent()` Signatur, BGW-Config, Parameter |
| R6  | [PostgreSQL News: pg_partman 5.2.4](https://www.postgresql.org/about/news/pg_partman-524-released-2995/) | Release-Announcement auf postgresql.org           |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
