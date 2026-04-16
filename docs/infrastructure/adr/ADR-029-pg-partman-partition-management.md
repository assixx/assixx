# ADR-029: pg_partman Automatic Partition Management

| Metadata                | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                            |
| **Date**                | 2026-03-06                                                                          |
| **Decision Makers**     | SCS Technik                                                                         |
| **Affected Components** | `docker/Dockerfile.pg-partman`, `docker/docker-compose.yml`, `database/migrations/` |

---

## Context

Migration #004 created monthly partitions for `audit_trail` and `root_logs` hardcoded for 2025-2027. Migration #051 extended this to 2028-2032. The fundamental problem: someone must manually write a new migration every few years before partitions run out. In production, nobody remembers. This is a time bomb.

### Tables Affected

| Table         | Partition Key        | Partitions (before)     | Data                   |
| ------------- | -------------------- | ----------------------- | ---------------------- |
| `audit_trail` | `RANGE (created_at)` | 96 (2025-01 to 2032-12) | Audit log entries      |
| `root_logs`   | `RANGE (created_at)` | 96 (2025-01 to 2032-12) | Root-level log entries |

---

## Decision

Use **pg_partman v5.4.3** to automatically manage partition creation. Built from source using a custom Dockerfile based on `postgres:17-alpine`.

### Why pg_partman

| Approach                        | Effort        | Risk                          | Maintenance      |
| ------------------------------- | ------------- | ----------------------------- | ---------------- |
| Manual migrations every 5 years | Low (once)    | High (forgotten = data loss)  | Recurring        |
| NestJS Cron + `CREATE TABLE`    | Medium        | Medium (App-level SPOF)       | App-dependent    |
| **pg_partman (chosen)**         | Medium (once) | Low (DB-level, battle-tested) | Zero (automatic) |

### Why Custom Dockerfile

| Option                             | Pros                                                       | Cons                                  |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| Third-party image (dbsystel, etc.) | Easy setup                                                 | Unknown maintainer, supply chain risk |
| **Custom Dockerfile (chosen)**     | Official base image, version-pinned, zero third-party risk | Build step required                   |
| Debian base                        | Guaranteed build compatibility                             | ~400MB vs ~90MB Alpine                |

> **Note (2026-04-16):** The "Debian rejected due to size" trade-off above
> applies only to this image. The Node runtime containers (backend,
> frontend) were later migrated Alpine → Debian bookworm-slim for an
> unrelated reason — see [ADR-027 Amendment 2026-04-16](./ADR-027-dockerfile-hardening.md#amendment-2026-04-16-node-base-image--alpine--debian-slim-musl-dns-failure-class)
> (musl DNS failure class with Docker's IPv4-only embedded DNS, which
> broke every outbound `fetch()` call in the Node containers). pg_partman
> has no outbound HTTPS exposure, so this failure class does not apply
> here and the Alpine base remains the correct choice for the postgres
> image.

---

## Implementation

### Docker Infrastructure

- **`docker/Dockerfile.pg-partman`**: `postgres:17-alpine` + pg_partman v5.4.3 source build
- **Alpine clang fix**: Symlinks `clang-21` -> `clang-19` (PostgreSQL 17-alpine compiled with clang-19, Alpine ships clang-21)
- **`docker-compose.yml`**: `build:` instead of `image:`, BGW config in `command:`

### pg_partman Configuration

| Parameter                   | Value         | Rationale                                             |
| --------------------------- | ------------- | ----------------------------------------------------- |
| `p_interval`                | `1 month`     | Consistent with existing partition scheme             |
| `p_premake`                 | `12`          | 12 months ahead = 1 year buffer                       |
| `p_default_table`           | `true`        | Catch-all prevents INSERT failures                    |
| `p_jobmon`                  | `false`       | pg_jobmon not installed                               |
| `inherit_privileges`        | `true`        | New partitions inherit GRANTs automatically           |
| `pg_partman_bgw.interval`   | `86400`       | Daily maintenance (sufficient for monthly partitions) |
| `pg_partman_bgw.role`       | `assixx_user` | Has DDL privileges (BYPASSRLS)                        |
| `max_locks_per_transaction` | `128`         | pg_partman recommendation (default: 64)               |

### Migration (20260306000074)

1. Pre-check: verify exactly 96 partitions per table
2. `CREATE SCHEMA partman` + `CREATE EXTENSION pg_partman`
3. Rename 192 partitions (`_YYYY_MM` -> `_pYYYYMMDD`)
4. Register with `partman.create_partition()` (v5.4.x API)
5. Create DEFAULT partitions + GRANTs
6. Enable `inherit_privileges`

### Rollback Strategy

1. `partman.config_cleanup()` removes pg_partman config (keeps partitions)
2. Drop empty DEFAULT partitions (FAIL LOUD if they contain data)
3. Drop extension + schema
4. Rename partitions back to legacy format
5. Partitions created by pg_partman beyond 2032 logged as orphans

**WARNING:** Lossy rollback. Partitions created after 2032 cannot be renamed back.

---

## Consequences

### Positive

- Zero-maintenance partition management (automatic, forever)
- DEFAULT partition prevents INSERT failures for any timestamp
- `inherit_privileges` ensures new partitions get correct GRANTs
- pg_partman is the PostgreSQL industry standard (battle-tested)
- Version-pinned custom Dockerfile eliminates supply chain risk

### Negative

- Custom Docker image requires rebuild on PostgreSQL major upgrades
- Alpine clang version mismatch needs symlink workaround
- pg_partman is an additional dependency to track

### Neutral

- Backend and frontend require zero changes (transparent at DB level)
- Existing data and RLS policies unaffected by partition rename

---

## References

- [pg_partman GitHub](https://github.com/pgpartman/pg_partman)
- [pg_partman v5.4.3 on PGXN](https://pgxn.org/dist/pg_partman/5.4.3/)
- Migration: `database/migrations/20260306000074_setup-pg-partman.ts`
- Masterplan: `docs/FEAT_PG_PARTMAN_MASTERPLAN.md`
