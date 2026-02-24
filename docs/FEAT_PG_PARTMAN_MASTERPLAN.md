# FEAT: pg_partman — Automatic Partition Management — Execution Masterplan

> **Created:** 2026-02-24
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `feat/pg-partman`
> **Context:** Migration Audit Session 2026-02-24 — Zeitbombe in Migration #004 identifiziert
> **Author:** Claude + Entwickler (Senior Engineer)
> **Estimated Sessions:** 4
> **Actual Sessions:** 0 / 4

---

## Changelog

| Version | Datum      | Änderung                         |
| ------- | ---------- | -------------------------------- |
| 0.1.0   | 2026-02-24 | Initial Draft — 3 Phasen geplant |

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

[pg_partman](https://github.com/pgpartman/pg_partman) v5.x — PostgreSQL-Extension die Partitionen **automatisch** erstellt und alte aufräumt. Industriestandard, battle-tested, PostgreSQL 14+ kompatibel.

### Was pg_partman macht

```
OHNE pg_partman:                       MIT pg_partman:

Migration #004: 2025-2027 ✓            pg_partman Background Worker:
Migration #051: 2028-2032 ✓            - Prüft täglich (konfigurierbar)
Migration #0??: 2033-2037 ???          - Erstellt automatisch 12 Monate voraus
Migration #0??: 2038-2042 ???          - Optional: Alte Partitionen aufräumen
... jemand vergisst es → CRASH 💥      - Für immer. Ohne manuelles Eingreifen.
```

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt
- [ ] Branch `feat/pg-partman` erstellt (von `main` oder `feature/TPM` nach Merge)
- [ ] Keine pending Migrations
- [ ] TPM-Feature gemerged (oder bewusste Entscheidung parallel zu arbeiten)
- [ ] Docker Image `ghcr.io/dbsystel/postgresql-partman:17-5` lokal gepullt und getestet

### 0.2 Risk Register

| #   | Risiko                                                         | Impact  | Wahrscheinlichkeit | Mitigation                                                                  | Verifikation                                                    |
| --- | -------------------------------------------------------------- | ------- | ------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| R1  | Docker Image-Wechsel bricht PostgreSQL-Daten                   | Hoch    | Niedrig            | Volume bleibt erhalten; Image fügt nur Extensions hinzu, ändert keine Daten | `SELECT version()` + `\dt` Zählung vor/nach Image-Wechsel       |
| R2  | pg_partman erkennt bestehende Partitionen nicht                | Hoch    | Niedrig            | pg_partman v5 adoptiert bestehende deklarative Partitionen nativ            | `SELECT * FROM partman.part_config` nach Registration           |
| R3  | Background Worker erstellt doppelte Partitionen                | Mittel  | Niedrig            | pg_partman prüft Existenz bevor es erstellt                                 | `SELECT partman.show_partitions('public.audit_trail')`          |
| R4  | Third-Party Docker Image wird nicht mehr gepflegt              | Mittel  | Niedrig            | dbsystel (Deutsche Bahn) pflegt aktiv; Fallback: eigenes Dockerfile         | Jährlich GitHub-Repo prüfen; Dockerfile als Backup bereithalten |
| R5  | shared_preload_libraries Änderung erfordert Container-Neustart | Niedrig | Hoch               | Geplanter Neustart, kein Hot-Reload möglich                                 | Container-Restart in docker-compose einplanen                   |
| R6  | CI Pipeline bricht wegen neuem Image                           | Mittel  | Mittel             | docker-compose.ci.yml ebenfalls updaten                                     | CI-Pipeline lokal testen bevor Push                             |

### 0.3 Ecosystem Integration Points

| Bestehendes System     | Art der Integration                               | Phase | Verifiziert am |
| ---------------------- | ------------------------------------------------- | ----- | -------------- |
| docker-compose.yml     | Image-Wechsel + shared_preload_libraries          | 1     |                |
| docker-compose.dev.yml | Gleicher Image-Wechsel (falls postgres definiert) | 1     |                |
| docker-compose.ci.yml  | Gleicher Image-Wechsel                            | 1     |                |
| audit_trail (96 Part.) | pg_partman Registration                           | 2     |                |
| root_logs (96 Part.)   | pg_partman Registration                           | 2     |                |
| Grafana/Prometheus     | Keine Änderung (anderer Container)                | —     |                |
| Backend (NestJS)       | Keine Änderung (DB-Ebene, transparent)            | —     |                |
| customer/fresh-install | Schema-Dump enthält pg_partman Config             | 3     |                |

---

## Phase 1: Docker Infrastructure

> **Abhängigkeit:** Keine (erste Phase)
> **Dateien:** docker-compose.yml, docker-compose.ci.yml, ggf. docker-compose.dev.yml

### Step 1.1: Docker Image tauschen [PENDING]

**Geänderte Dateien:**

- `docker/docker-compose.yml`
- `docker/docker-compose.ci.yml`
- `docker/docker-compose.dev.yml` (falls postgres Service definiert)

**Was passiert:**

1. Image von `postgres:17-alpine` auf `ghcr.io/dbsystel/postgresql-partman:17-5` ändern
2. `shared_preload_libraries` erweitern: `pg_stat_statements,pg_partman_bgw`
3. Background Worker konfigurieren:

```yaml
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
  - '-c'
  - 'pg_partman_bgw.dbname=assixx'
  - '-c'
  - 'pg_partman_bgw.interval=86400'
  - '-c'
  - 'pg_partman_bgw.role=assixx_user'
```

**Konfigurationswerte:**

| Parameter                 | Wert          | Begründung                                       |
| ------------------------- | ------------- | ------------------------------------------------ |
| `pg_partman_bgw.dbname`   | `assixx`      | Unsere einzige Datenbank                         |
| `pg_partman_bgw.interval` | `86400`       | Täglich (1x pro Tag reicht für monatliche Part.) |
| `pg_partman_bgw.role`     | `assixx_user` | Hat DDL-Rechte (BYPASSRLS)                       |

### Step 1.2: Container neu bauen und starten [PENDING]

```bash
cd /home/scs/projects/Assixx/docker

# 1. Backup erstellen (PFLICHT!)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > ../database/backups/pre_pg_partman_${TIMESTAMP}.dump

# 2. Container stoppen
doppler run -- docker-compose down

# 3. Neues Image pullen
docker pull ghcr.io/dbsystel/postgresql-partman:17-5

# 4. Container starten (Volume bleibt erhalten!)
doppler run -- docker-compose up -d

# 5. Warten bis healthy
sleep 10
doppler run -- docker-compose ps
```

**Verifikation:**

```bash
# PostgreSQL Version unverändert
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT version();"

# Alle Tabellen noch da
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';"

# pg_partman Extension verfügbar
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM pg_available_extensions WHERE name = 'pg_partman';"

# pg_stat_statements noch aktiv
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SHOW shared_preload_libraries;"
# Erwartung: pg_stat_statements,pg_partman_bgw

# Backend healthy
curl -s http://localhost:3000/health | jq '.status'
```

### Phase 1 — Definition of Done

- [ ] Docker Image getauscht auf `ghcr.io/dbsystel/postgresql-partman:17-5`
- [ ] `shared_preload_libraries` enthält `pg_stat_statements,pg_partman_bgw`
- [ ] Container startet ohne Errors
- [ ] PostgreSQL Version = 17.x (unverändert)
- [ ] Tabellenanzahl identisch zu vor dem Wechsel
- [ ] `pg_partman` in `pg_available_extensions` sichtbar
- [ ] `pg_stat_statements` funktioniert weiterhin
- [ ] Backend healthy nach Container-Restart
- [ ] CI docker-compose.ci.yml ebenfalls angepasst

---

## Phase 2: pg_partman Migration

> **Abhängigkeit:** Phase 1 complete
> **Dateien:** 1 neue Migrationsdatei

### Step 2.1: Migration erstellen — pg_partman für bestehende Tabellen registrieren [PENDING]

**Neue Datei:** `database/migrations/YYYYMMDDNNNNNN_setup-pg-partman.ts`

**Was passiert:**

```sql
-- 1. Schema + Extension erstellen
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

-- 2. audit_trail bei pg_partman registrieren
-- pg_partman adoptiert die bestehenden 96 Partitionen automatisch
SELECT partman.create_partition(
    p_parent_table   := 'public.audit_trail',
    p_control        := 'created_at',
    p_interval       := '1 month',
    p_premake        := 12,
    p_default_table  := true,
    p_automatic_maintenance := 'on'
);

-- 3. root_logs bei pg_partman registrieren
SELECT partman.create_partition(
    p_parent_table   := 'public.root_logs',
    p_control        := 'created_at',
    p_interval       := '1 month',
    p_premake        := 12,
    p_default_table  := true,
    p_automatic_maintenance := 'on'
);

-- 4. Privilege-Vererbung aktivieren (GRANTs propagieren zu neuen Partitionen)
UPDATE partman.part_config
SET inherit_privileges = true
WHERE parent_table IN ('public.audit_trail', 'public.root_logs');

-- 5. Optional: Retention (alte Partitionen nach 3 Jahren detachen)
-- UPDATE partman.part_config
-- SET retention = '3 years', retention_keep_table = true
-- WHERE parent_table IN ('public.audit_trail', 'public.root_logs');
-- ACHTUNG: Retention erst aktivieren wenn Archivierungsstrategie steht!
```

**Konfigurationswerte:**

| Parameter            | Wert        | Begründung                                                |
| -------------------- | ----------- | --------------------------------------------------------- |
| `p_interval`         | `'1 month'` | Konsistent mit bestehendem Partitionsschema               |
| `p_premake`          | `12`        | Immer 12 Monate voraus = 1 Jahr Puffer                    |
| `p_default_table`    | `true`      | Catch-all Partition → verhindert INSERT-Failures zu 100%  |
| `inherit_privileges` | `true`      | Neue Partitionen erben GRANTs von Parent automatisch      |
| Retention            | Deaktiviert | Erst aktivieren wenn Archivierungsstrategie definiert ist |

**down() Strategie:**

```sql
-- Extension und Schema droppen
-- Bestehende Partitionen bleiben erhalten (pg_partman DROP entfernt nur die Verwaltung)
DROP EXTENSION IF EXISTS pg_partman CASCADE;
DROP SCHEMA IF EXISTS partman CASCADE;
```

**Verifikation:**

```bash
# pg_partman Config prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT parent_table, control, partition_interval, premake, automatic_maintenance, inherit_privileges FROM partman.part_config;"

# Bestehende Partitionen werden erkannt
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM partman.show_partitions('public.audit_trail') LIMIT 5;"

# DEFAULT Partition existiert
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT inhrelid::regclass FROM pg_inherits JOIN pg_class ON inhrelid = oid WHERE inhparent = 'audit_trail'::regclass AND relname LIKE '%default%';"

# Maintenance manuell triggern zum Test
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "CALL partman.run_maintenance_proc();"

# Prüfen ob neue Partitionen erstellt wurden (12 Monate voraus)
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT inhrelid::regclass FROM pg_inherits JOIN pg_class ON inhrelid = oid WHERE inhparent = 'audit_trail'::regclass ORDER BY relname DESC LIMIT 5;"
```

### Step 2.2: Migration #051 nachträglich als obsolet markieren [PENDING]

Migration #051 (`extend-audit-partitions-2028-2032`) war der manuelle Fix. Nach pg_partman-Setup ist sie funktional obsolet — pg_partman verwaltet jetzt alles. Die Migration bleibt in der History (node-pg-migrate), aber ein Kommentar wird hinzugefügt:

```typescript
/**
 * Migration: Extend Audit Log Partitions (2028-2032)
 *
 * NOTE: Superseded by pg_partman setup (Migration NNNNNN).
 * pg_partman now automatically manages all future partitions.
 * This migration remains for historical completeness.
 * ...
 */
```

### Phase 2 — Definition of Done

- [ ] `pg_partman` Extension installiert und aktiv
- [ ] `audit_trail` in `partman.part_config` registriert mit `premake=12`
- [ ] `root_logs` in `partman.part_config` registriert mit `premake=12`
- [ ] DEFAULT Partitionen für beide Tabellen existieren
- [ ] `inherit_privileges = true` für beide Tabellen
- [ ] `CALL partman.run_maintenance_proc()` erstellt fehlende Partitionen
- [ ] Partitionen reichen mindestens 12 Monate in die Zukunft
- [ ] Backend kompiliert und läuft fehlerfrei
- [ ] Bestehende Tests laufen weiterhin durch
- [ ] Migration #051 als superseded kommentiert

---

## Phase 3: Verifikation + Dokumentation

> **Abhängigkeit:** Phase 2 complete

### Step 3.1: End-to-End Test [PENDING]

```bash
# 1. Manuell einen Audit-Log-Eintrag erzeugen (z.B. Login)
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}'

# 2. Prüfen ob Eintrag in der richtigen Partition gelandet ist
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT tableoid::regclass AS partition, id, action, created_at FROM audit_trail ORDER BY created_at DESC LIMIT 3;"

# 3. Prüfen dass DEFAULT Partition leer ist (alles in benannten Partitionen)
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT COUNT(*) AS rows_in_default FROM audit_trail_default;"
# Erwartung: 0

# 4. Background Worker Status prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM pg_stat_activity WHERE backend_type = 'pg_partman_bgw';"
```

### Step 3.2: Customer-Fresh-Install synchronisieren [PENDING]

```bash
doppler run -- ./scripts/sync-customer-migrations.sh
```

### Step 3.3: ADR schreiben [PENDING]

**Neue Datei:** `docs/infrastructure/adr/ADR-027-pg-partman-partition-management.md`

**Inhalt:** Entscheidung pg_partman statt manuelle Migrations, Begründung, Docker-Image-Wahl, Konfiguration, Rollback-Strategie.

### Step 3.4: DATABASE-MIGRATION-GUIDE.md updaten [PENDING]

Neuen Abschnitt hinzufügen:

```markdown
## Partition Management (pg_partman)

Partitionen für `audit_trail` und `root_logs` werden automatisch von pg_partman verwaltet.

**KEINE manuellen Partition-Migrations mehr nötig.**

pg_partman Background Worker läuft täglich und erstellt fehlende Partitionen 12 Monate im Voraus.

### Monitoring

\`\`\`bash

# pg_partman Config

docker exec assixx-postgres psql -U assixx_user -d assixx \
 -c "SELECT parent_table, premake, retention FROM partman.part_config;"

# DEFAULT Partition prüfen (sollte immer 0 Rows haben)

docker exec assixx-postgres psql -U assixx_user -d assixx \
 -c "SELECT COUNT(\*) FROM audit_trail_default;"

# Manuell Maintenance triggern

docker exec assixx-postgres psql -U assixx_user -d assixx \
 -c "CALL partman.run_maintenance_proc();"
\`\`\`
```

### Phase 3 — Definition of Done

- [ ] Audit-Log-Eintrag landet in korrekter Partition
- [ ] DEFAULT Partition ist leer (0 Rows)
- [ ] Background Worker läuft
- [ ] Customer-Fresh-Install synchronisiert
- [ ] ADR-027 geschrieben
- [ ] DATABASE-MIGRATION-GUIDE.md um pg_partman-Sektion erweitert
- [ ] Keine offenen TODOs im Code

---

## Session Tracking

| Session | Phase | Beschreibung                              | Status  | Datum |
| ------- | ----- | ----------------------------------------- | ------- | ----- |
| 1       | 1     | Docker Image tauschen + Container rebuild | PENDING |       |
| 2       | 2     | pg_partman Migration erstellen + apply    | PENDING |       |
| 3       | 3     | E2E Test + Customer Sync + ADR            | PENDING |       |
| 4       | 3     | Guide Update + Final Verification         | PENDING |       |

---

## Quick Reference: File Paths

### Geänderte Dateien

| Datei                              | Änderung                               |
| ---------------------------------- | -------------------------------------- |
| `docker/docker-compose.yml`        | Image + shared_preload_libraries + BGW |
| `docker/docker-compose.ci.yml`     | Image + shared_preload_libraries       |
| `docs/DATABASE-MIGRATION-GUIDE.md` | pg_partman Monitoring-Sektion          |

### Neue Dateien

| Datei                                                                | Zweck                   |
| -------------------------------------------------------------------- | ----------------------- |
| `database/migrations/YYYYMMDDNNNNNN_setup-pg-partman.ts`             | pg_partman Registration |
| `docs/infrastructure/adr/ADR-027-pg-partman-partition-management.md` | ADR                     |

### Obsolete Dateien (bleiben, werden kommentiert)

| Datei                                                                     | Warum obsolet                          |
| ------------------------------------------------------------------------- | -------------------------------------- |
| `database/migrations/20260224000051_extend-audit-partitions-2028-2032.ts` | pg_partman macht das jetzt automatisch |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Retention (alte Partitionen löschen)** — Erst aktivieren wenn Archivierungsstrategie definiert. pg_partman kann Partitionen automatisch detachen/droppen nach X Jahren, aber das braucht eine bewusste Business-Entscheidung (wie lange müssen Audit-Logs aufbewahrt werden?).
2. **Subpartitioning** — Nicht nötig. Monatliche Partitionen reichen für unser Datenvolumen.
3. **pg_jobmon Integration** — Optional Monitoring-Extension. Nicht in V1, kann später hinzugefügt werden.
4. **Custom Dockerfile** — Wir nutzen `ghcr.io/dbsystel/postgresql-partman:17-5`. Fallback-Dockerfile nur erstellen wenn dbsystel-Image nicht mehr gepflegt wird.

---

## Spec Deviations

| #   | Ursprüngliche Empfehlung | Tatsächliche Entscheidung | Begründung                                         |
| --- | ------------------------ | ------------------------- | -------------------------------------------------- |
| D1  | NestJS Cron + DEFAULT    | pg_partman                | DB-Ebene > App-Ebene; kein SPOF; Industriestandard |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
