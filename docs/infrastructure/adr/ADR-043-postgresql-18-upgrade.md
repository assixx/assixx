# ADR-043: PostgreSQL 17 → 18 Major Upgrade

| Metadata                | Value                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                 |
| **Date**                | 2026-04-10                                                                                               |
| **Decision Makers**     | SCS Technik                                                                                              |
| **Affected Components** | `docker/Dockerfile.pg-partman`, `docker/docker-compose.yml`, Database (all 337 tables), ADR-027, ADR-029 |

---

## Context

Dependabot opened PR #199 to bump `postgres` from `17.9-alpine` to `18.3-alpine` in `docker/docker-compose.yml`. The PR changed only the image tag — missing critical migration steps. Analysis revealed three blockers that prevented auto-merge:

1. **PGDATA path change** — PG18 Docker images moved the default data directory from `/var/lib/postgresql/data` to `/var/lib/postgresql/18/docker`. A simple image tag bump would start an empty database.
2. **Data checksum default** — PG18 `initdb` enables checksums by default; our PG17 cluster had none. `pg_upgrade` requires matching settings.
3. **Custom Dockerfile rebuild** — `Dockerfile.pg-partman` builds pg_partman from source against the PostgreSQL headers. A major version bump requires recompilation.

PR #199 was closed. This ADR documents the manual upgrade performed on the `feature/inventory` branch.

---

## Decision

Upgrade PostgreSQL from 17.9 to 18.3 via **pg_dump/restore** (not pg_upgrade). Override `PGDATA` environment variable in `docker-compose.yml` to maintain the existing volume mount path.

### Why pg_dump/restore Over pg_upgrade

| Approach    | Pros                                 | Cons                                                    |
| ----------- | ------------------------------------ | ------------------------------------------------------- |
| pg_upgrade  | In-place, faster for large DBs       | PGDATA path mismatch, checksum mismatch, Docker-hostile |
| **pg_dump** | Clean slate, avoids all compat traps | Full dump+restore cycle, brief downtime                 |

For our 2.8 MB database, pg_dump/restore completes in seconds. The complexity of pg_upgrade inside Docker (volume restructuring, checksum flags, two-container setup) is not justified.

### PGDATA Path Strategy

```yaml
# docker-compose.yml — postgres service
environment:
  PGDATA: /var/lib/postgresql/data # Override PG18 default
volumes:
  - postgres_data:/var/lib/postgresql/data # Keep existing mount
```

**Rationale:** Setting `PGDATA` explicitly is the official Docker PostgreSQL approach (documented in Docker Hub). This avoids changing the external volume name/path and keeps the upgrade transparent to all other services.

---

## Breaking Changes in PostgreSQL 18 (Verified)

### Behavioral Changes Affecting Assixx

| Change                                              | Impact                                                                 | Mitigation                                                                   | Verified                  |
| --------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------- |
| **PGDATA default moved**                            | Container starts empty                                                 | `PGDATA` env var override                                                    | Yes — 337 tables restored |
| **Data checksums on by default**                    | pg_upgrade fails on mismatch                                           | pg_dump/restore bypasses entirely                                            | Yes — fresh initdb        |
| **VACUUM/ANALYZE recurses into partition children** | Longer maintenance on `audit_trail`/`root_logs`                        | No action needed — acceptable                                                | Noted                     |
| **AFTER triggers execute as queueing role**         | Could affect RLS+trigger interaction                                   | Tested: `kvp-daily-limit`, `kvp-comments-admin-only` triggers work correctly | Yes — 743 API tests pass  |
| **pg_stat_statements queryid instability**          | Grafana/Prometheus dashboards lose query correlation                   | `pg_stat_statements_reset()` after upgrade                                   | Expected                  |
| **pg_stat_statements version 1.11 → 1.12**          | New columns: `parallel_workers_to_launch`, `parallel_workers_launched` | No action needed — additive                                                  | Confirmed                 |

### Changes NOT Affecting Assixx

| Change                           | Why safe                                                                   |
| -------------------------------- | -------------------------------------------------------------------------- |
| `current_setting()` behavior     | Unchanged — RLS `current_setting('app.tenant_id', true)` works identically |
| Native `uuidv7()` function added | No conflict — we generate UUIDv7 in the application layer (uuid v13)       |
| MD5 password deprecation warning | `app_user` and `sys_user` use SCRAM-SHA-256 (PG17 default)                 |
| FTS collation provider change    | Assixx has no full-text search indexes                                     |

---

## Migration Steps Performed

### 1. Pre-Upgrade Backup

```bash
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
  --format=custom --compress=9 \
  > database/backups/pre_pg18_upgrade_20260410_145446.dump
```

### 2. File Changes

| File                           | Change                                                                 |
| ------------------------------ | ---------------------------------------------------------------------- |
| `docker/Dockerfile.pg-partman` | `FROM postgres:17.9-alpine` → `FROM postgres:18.3-alpine`              |
| `docker/docker-compose.yml`    | Added `PGDATA: /var/lib/postgresql/data` env var                       |
| `docker/docker-compose.yml`    | Image tag: `assixx-postgres:17-partman` → `assixx-postgres:18-partman` |
| `docker/docker-compose.yml`    | Updated doc references and comments from 17 to 18                      |

### 3. Build New Image

```bash
doppler run -- docker-compose build postgres
# pg_partman 5.4.3 compiles successfully against PG18 headers
# clang-21 → clang-19 symlink workaround still required (same as PG17)
```

### 4. Volume Recreation

```bash
docker volume rm assixx_postgres_data
docker volume create assixx_postgres_data
```

### 5. Start PG18 + Restore

```bash
doppler run -- docker-compose up -d
docker cp pre_pg18_upgrade.dump assixx-postgres:/tmp/restore.dump
docker exec assixx-postgres pg_restore -U assixx_user -d assixx \
  --no-owner --no-privileges /tmp/restore.dump
```

### 6. Post-Restore Fixes

```sql
-- GRANTs lost due to --no-privileges (required for app_user RLS access)
-- Restored via: customer/fresh-install/install.sh --grants-only

-- partman schema GRANTs (not included in fresh-install script)
GRANT USAGE ON SCHEMA partman TO app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA partman TO app_user;
GRANT USAGE ON SCHEMA partman TO sys_user;
GRANT SELECT ON ALL TABLES IN SCHEMA partman TO sys_user;
```

### 7. Verification

```
PostgreSQL version:  18.3 (Alpine, gcc 15.2.0)
Tables:              337 (identical)
RLS tables:          126 (identical)
RLS policies:        131 (identical)
Extensions:          pg_partman 5.4.3, pg_stat_statements 1.12, plpgsql 1.0
pg_partman config:   audit_trail + root_logs (premake=12, automatic_maintenance=on)
Partition health:    healthy (12/12 future months covered, defaults empty)
RLS tenant isolation: Verified (app_user WITH context = 416 rows, WITHOUT = 0 rows)
API integration tests: 743/743 passed (42 test files)
```

---

## Consequences

### Positive

- PostgreSQL 18.3 — latest major version, supported until November 2030
- Native `uuidv7()` available for future use (server-side UUID generation)
- pg_stat_statements 1.12 with parallel worker tracking
- Data checksums enabled (fresh initdb default) — detects storage corruption

### Negative

- Historical pg_stat_statements `queryid` values invalidated — dashboard correlation reset
- VACUUM on partitioned tables may take longer (recurses into children by default)
- Custom `Dockerfile.pg-partman` must be maintained for PG18 (same as PG17)

### Neutral

- Alpine clang symlink workaround unchanged (clang-21 → clang-19)
- pg_partman 5.4.3 unchanged — no rebuild of extension version needed
- All 743 API tests pass without code changes — zero application-level impact

---

## Rollback Plan

1. Stop containers: `doppler run -- docker-compose down`
2. Revert `Dockerfile.pg-partman` and `docker-compose.yml` to PG17 versions
3. Recreate volume: `docker volume rm assixx_postgres_data && docker volume create assixx_postgres_data`
4. Rebuild PG17 image: `doppler run -- docker-compose build postgres`
5. Start PG17: `doppler run -- docker-compose up -d`
6. Restore from pre-upgrade backup: `docker exec assixx-postgres pg_restore ...`
7. Re-apply GRANTs: `customer/fresh-install/install.sh --grants-only`

---

## Related ADRs

- **ADR-027** — Dockerfile Hardening (image pinning strategy, Stage 1)
- **ADR-029** — pg_partman Partition Management (custom Dockerfile, extension build)
- **ADR-014** — Database Migration Architecture (node-pg-migrate, backup procedures)
- **ADR-019** — Multi-Tenant RLS Isolation (`current_setting` pattern, verified on PG18)
