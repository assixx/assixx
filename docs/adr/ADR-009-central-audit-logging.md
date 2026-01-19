# ADR-009: Central Audit Logging Architecture

| Status   | Accepted                           |
| -------- | ---------------------------------- |
| Date     | 2026-01-15                         |
| Decision | Keep PostgreSQL + Enhance Existing |
| Author   | Claude Code                        |

## Context

Assixx needs a central audit logging system that:

1. **Stores all audit logs with timestamps** per tenant
2. **Allows download as .txt/CSV** for compliance
3. **Isolates logs by `tenant_id`** (multi-tenant SaaS)
4. **Integrates with existing stack** (Pino, Loki, Grafana, Prometheus)
5. **Is open-source, free, Docker-compatible**

### Current State

We already have:

| Component               | Purpose                           | Location                            | Status                            |
| ----------------------- | --------------------------------- | ----------------------------------- | --------------------------------- |
| `audit_trail` table     | Structured audit events (CRUD)    | PostgreSQL                          | ⚠️ EMPTY - no writer!             |
| `root_logs` table       | Activity logs (login, CRUD, etc.) | PostgreSQL                          | ✅ Active (ActivityLoggerService) |
| `AuditTrailService`     | Audit queries, export, stats      | `backend/src/nest/audit-trail/`     | ✅ Read-only                      |
| `ActivityLoggerService` | Fire-and-forget activity logging  | `backend/src/nest/common/services/` | ✅ Writes to root_logs            |
| Pino + pino-loki        | Application logs to Loki          | `backend/src/nest/common/logger/`   | ✅ Active                         |
| Grafana Loki 3.6.3      | Log aggregation (7-day retention) | `docker/docker-compose.yml`         | ✅ Active                         |
| Grafana                 | Visualization                     | Docker (observability profile)      | ✅ Active                         |

### ⚠️ CRITICAL: audit_trail vs root_logs

| Table         | Purpose                               | What is logged                           | Who sees it                     |
| ------------- | ------------------------------------- | ---------------------------------------- | ------------------------------- |
| `audit_trail` | **Compliance/Audit** - Log EVERYTHING | Every request, every action, page visits | TXT/CSV export for compliance   |
| `root_logs`   | **Dashboard** - Critical CRUD only    | login, logout, create, update, delete    | Root-Dashboard directly visible |

**Problem discovered 2026-01-19:** `audit_trail` table exists but has 0 entries! No service writes to it.

### What's Missing

1. **⚠️ CRITICAL: audit_trail writer** - Global interceptor to log ALL requests to audit_trail
2. **Unified export** - Two separate tables, no combined download (✅ DONE 2026-01-19)
3. **Frontend UI** - No log viewer/download page for admins
4. **Retention configuration** - Hardcoded, not per-tenant
5. **TXT/CSV download** - Only JSON export exists (✅ DONE 2026-01-19)

## Decision Drivers

- **KISS Principle** - Don't add complexity without clear benefit
- **Operational simplicity** - Fewer moving parts = fewer failure modes
- **Cost efficiency** - Open-source, low resource usage
- **Compliance** - GDPR, audit trail requirements

## Options Considered

### Option A: Elasticsearch/OpenSearch

**Pros:**

- Full-text search
- Mature audit features (RBAC)
- Scales to TB/day

**Cons:**

- **Resource hungry**: 4-8GB RAM minimum, 3x storage expansion
- **Operational complexity**: Cluster management, shard tuning
- **Overkill**: Our audit volume is ~1-10GB/month, not TB/day
- **Additional Docker container**: More failure points

**Verdict:** REJECTED - Overkill for our scale

### Option B: Loki Multi-Tenancy

**Pros:**

- Already running
- Low resource usage
- Label-based queries

**Cons:**

- **Not designed for structured audit logs** - Labels have cardinality limits
- **No ACID guarantees** - Eventually consistent
- **Query limitations** - Label-based, not relational
- **Retention conflicts** - Application logs vs audit logs have different retention needs

**Verdict:** REJECTED - Wrong tool for structured audit data

### Option C: Keep PostgreSQL + Enhance Export (RECOMMENDED)

**Pros:**

- **Already implemented** - Zero new infrastructure
- **ACID guarantees** - Perfect for audit logs
- **Tenant isolation** - `tenant_id` column + RLS
- **Relational queries** - JOINs, aggregations, filters
- **Backup/restore** - Standard PostgreSQL tooling
- **Export exists** - Just needs enhancement

**Cons:**

- Not designed for high-volume streaming logs
- Manual retention management

**Verdict:** ACCEPTED - Right tool, minimal effort

## Decision

**Keep PostgreSQL for audit logs. Enhance the existing system:**

1. **Unify export endpoint** - Combine `audit_trail` + `root_logs`
2. **Add TXT/CSV download** - Controller endpoint with stream response
3. **Add frontend UI** - Logs page with filter/download
4. **Add retention config** - Per-tenant setting in `tenant_settings`

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUDIT LOGGING FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User Action                                                   │
│      │                                                          │
│      ▼                                                          │
│   ┌──────────────────┐                                         │
│   │  NestJS Service  │                                         │
│   │  (CRUD operation)│                                         │
│   └────────┬─────────┘                                         │
│            │                                                    │
│     ┌──────┴──────┐                                            │
│     ▼             ▼                                             │
│  ┌──────────┐  ┌─────────────────┐                             │
│  │ Pino     │  │ ActivityLogger  │                             │
│  │ Logger   │  │ Service         │                             │
│  └────┬─────┘  └────────┬────────┘                             │
│       │                 │                                       │
│       ▼                 ▼                                       │
│  ┌──────────┐  ┌─────────────────┐                             │
│  │ Loki     │  │ PostgreSQL      │                             │
│  │ (app     │  │ audit_trail /   │                             │
│  │  logs)   │  │ root_logs       │                             │
│  └────┬─────┘  └────────┬────────┘                             │
│       │                 │                                       │
│       ▼                 ▼                                       │
│  ┌──────────┐  ┌─────────────────┐                             │
│  │ Grafana  │  │ Audit Export    │  ← NEW: Unified endpoint    │
│  │ (debug)  │  │ API + Frontend  │                             │
│  └──────────┘  └─────────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Responsibility Split

| Log Type          | Storage    | Retention | Purpose              |
| ----------------- | ---------- | --------- | -------------------- |
| Application logs  | Loki       | 7 days    | Debugging, errors    |
| Audit logs (CRUD) | PostgreSQL | 1-7 years | Compliance, tracking |
| Activity logs     | PostgreSQL | 1-7 years | User actions, login  |

## Scalability Strategy

PostgreSQL handles audit logs well with proper optimization. Key measures:

### Table Partitioning (MANDATORY)

Partition tables by month for efficient date-range queries:

```sql
CREATE TABLE audit_trail (...) PARTITION BY RANGE (created_at);
CREATE TABLE audit_trail_2026_01 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**Impact:** 10-100x faster queries on date ranges.

### Cursor-Based Streaming (MANDATORY)

Never load all logs into memory. Use PostgreSQL cursors:

```typescript
async *streamLogs(tenantId: number): AsyncGenerator<LogEntry> {
  const client = await pool.connect();
  // CRITICAL: Set RLS context before ANY query!
  await client.query(`SELECT set_config('app.tenant_id', $1::text, false)`, [tenantId]);

  const cursor = new Cursor('SELECT * FROM audit_trail WHERE tenant_id = $1');
  let batch;
  while ((batch = await cursor.read(1000)).length > 0) {
    for (const row of batch) yield row;
  }
  client.release();
}
```

**Impact:** Constant ~50MB RAM regardless of export size.

### RLS (Row-Level Security) Integration

Audit tables use RLS with `FORCE ROW LEVEL SECURITY`. The policy:

```sql
USING (
  (NULLIF(current_setting('app.tenant_id', true), '') IS NULL)
  OR (tenant_id = current_setting('app.tenant_id')::integer)
)
```

**CRITICAL:** `set_config('app.tenant_id', ...)` MUST be called before streaming queries.
Without it, RLS policy returns ALL rows (security breach). See implementation plan 1.2.1.

### Performance Benchmarks

With partitioning + streaming:

| Log Count | Export Time | RAM Usage | Status |
| --------- | ----------- | --------- | ------ |
| 100K      | <2s         | ~50MB     | ✅     |
| 1M        | ~15s        | ~50MB     | ✅     |
| 10M       | ~2min       | ~50MB     | ✅     |
| 100M      | ~10min      | ~50MB     | ✅     |

### Future Scaling (100M+ Logs)

When PostgreSQL reaches limits:

| Signal                      | Solution                           |
| --------------------------- | ---------------------------------- |
| Queries >10s with indexes   | Archive old data, add read replica |
| Disk I/O constantly at 100% | TimescaleDB extension              |
| Full-text search needed     | Add Elasticsearch for search only  |
| >500M active rows           | ClickHouse for analytics           |

## Consequences

### Positive

- **Zero new infrastructure** - Uses existing PostgreSQL
- **Immediate implementation** - Days, not weeks
- **Proven technology** - PostgreSQL is battle-tested
- **Cost: $0** - No new licenses or resources
- **Compliance-ready** - ACID, backup, audit trail
- **Scales to 100M+ logs** - With partitioning and streaming

### Negative

- Requires partitioning setup (one-time effort)
- Manual partition creation (automate with pg_partman or cron)

### Neutral

- Loki remains for application logs (unchanged)
- Grafana dashboard available for app log visualization

## Implementation Plan

See: `docs/adr/ADR-009-implementation-plan.md`

## Resource Comparison

| Solution                 | RAM   | Storage (50GB/day) | Complexity | Cost |
| ------------------------ | ----- | ------------------ | ---------- | ---- |
| PostgreSQL (current)     | 512MB | ~50GB/day          | Low        | $0   |
| Elasticsearch/OpenSearch | 4-8GB | ~150GB/day (3x)    | High       | $0   |
| Loki (current, app logs) | 512MB | ~5GB/day (10x)     | Low        | $0   |

## Extending the Audit Logging System

This section describes how to extend the audit logging for future requirements.

### Adding New Columns to `audit_trail`

1. **Create migration file** in `database/migrations/`:

```sql
-- Example: Add request_id column for correlation
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS request_id UUID;
CREATE INDEX CONCURRENTLY idx_audit_trail_request_id ON audit_trail (request_id);
```

2. **Update the interceptor** in `backend/src/nest/common/interceptors/audit-trail.interceptor.ts`:
   - Add new field to `AuditLogParams` interface
   - Add field extraction logic in `extractRequestMetadata()`
   - Add field to INSERT query in `logToAuditTrail()`

3. **Update export DTO** in `backend/src/nest/logs/dto/export-logs.dto.ts`:
   - Add field to `UnifiedLogEntry` interface

4. **Update unified logs service** in `backend/src/nest/logs/unified-logs.service.ts`:
   - Add field to SELECT query in `streamFromAuditTrail()`
   - Add field mapping in `mapAuditTrailRow()`

5. **Update formatters** in `backend/src/nest/logs/log-formatters.service.ts`:
   - Add field to CSV header
   - Add field to TXT format

### Adding New Log Sources (Tables)

To add a completely new log table (e.g., `security_logs`):

1. **Create table** with partitioning:

```sql
CREATE TABLE security_logs (
    id SERIAL,
    tenant_id INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Enable RLS
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON security_logs
    USING (
        (NULLIF(current_setting('app.tenant_id', true), '') IS NULL)
        OR (tenant_id = current_setting('app.tenant_id')::integer)
    );
```

2. **Create NestJS service** for writing:

```typescript
@Injectable()
export class SecurityLogsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async logSecurityEvent(params: SecurityLogParams): Promise<void> {
    // Fire-and-forget pattern - never throw
    try {
      await this.pool.query(
        `INSERT INTO security_logs (...) VALUES (...)`,
        [...]
      );
    } catch (error) {
      this.logger.warn('Failed to log security event', error);
    }
  }
}
```

3. **Add to unified export** in `unified-logs.service.ts`:
   - Add `LogSourceSchema` enum value: `'security_logs'`
   - Add `streamFromSecurityLogs()` method
   - Add to `streamLogs()` switch statement

4. **Update frontend** filter options in `frontend/src/routes/(app)/logs/_lib/constants.ts`

### Using the `changes` JSONB Field

The `changes` column stores flexible metadata. Current structure:

```typescript
interface AuditChangesMetadata {
  endpoint: string; // Full API path: /api/v2/users/123
  http_method: string; // GET, POST, PUT, DELETE
  http_status?: number; // 200, 404, 500, etc.
  duration_ms: number; // Request duration
}
```

**To add new metadata:**

1. Extend the interface in `audit-trail.interceptor.ts`
2. Add extraction logic
3. The JSONB column auto-stores any valid JSON - no migration needed!

### Excluding Endpoints from Logging

Edit constants in `audit-trail.interceptor.ts`:

```typescript
// Completely exclude (never log)
const EXCLUDED_PATHS: readonly string[] = [
  '/health',
  '/api/v2/health',
  // Add new paths here
];

// Skip for GET requests (reduce noise)
const SKIPPED_GET_SUFFIXES: readonly string[] = [
  '/stats',
  '/count',
  // Add new suffixes here
];

// Throttled endpoints (log once per interval)
const CURRENT_USER_ENDPOINTS: readonly string[] = [
  '/users/me',
  // Add new endpoints here
];
```

### Adding New Action Types

Edit `AuditAction` type in `audit-trail.interceptor.ts`:

```typescript
type AuditAction =
  | 'login'
  | 'logout' // Auth
  | 'create'
  | 'update'
  | 'delete' // Mutations
  | 'view'
  | 'list' // Reads
  | 'export'
  | 'import' // NEW: Bulk operations
  | 'approve'
  | 'reject'; // NEW: Workflow actions
```

Then update `determineAction()` method with logic for new actions.

## References

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Loki vs Elasticsearch Comparison](https://signoz.io/blog/loki-vs-elasticsearch/)
- [Loki Multi-Tenancy](https://grafana.com/docs/loki/latest/operations/multi-tenancy/)
- [PostgreSQL Audit Logging Best Practices](https://www.postgresql.org/docs/current/runtime-config-logging.html)
- [ADR Template](https://adr.github.io/)

## Related ADRs

- ADR-002: Alerting & Monitoring (Loki setup)
- ADR-006: Multi-Tenant Context Isolation

---

_Last Updated: 2026-01-19 (v4 - Added Extension Guidelines)_
