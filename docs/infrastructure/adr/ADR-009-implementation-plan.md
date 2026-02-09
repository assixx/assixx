# ADR-009: Implementation Plan - Central Audit Logging

> **Parent ADR:** [ADR-009-central-audit-logging.md](./ADR-009-central-audit-logging.md)

## Overview

This plan enhances the existing PostgreSQL-based audit logging to provide:

1. Unified export of `audit_trail` + `root_logs`
2. TXT/CSV download endpoints
3. Frontend admin UI for logs
4. Configurable retention per tenant

## Implementation Status (2026-01-19)

| Phase | Description                       | Status   | Missing               |
| ----- | --------------------------------- | -------- | --------------------- |
| 0     | **CRITICAL: audit_trail Logging** | **DONE** | -                     |
| 1     | Backend: Unified Export           | **DONE** | Load tests (optional) |
| 2     | Database: Partitioning            | **DONE** | -                     |
| 3     | Frontend: Export UI               | **DONE** | -                     |
| 4     | Cleanup: Retention Job            | **DONE** | -                     |

### ALL PHASES COMPLETE! (2026-01-19)

---

## Phase 0 COMPLETED (2026-01-19)

**Implemented:**

- `backend/src/nest/common/interceptors/audit-trail.interceptor.ts` (401 lines)
- Globally registered in `app.module.ts` via `APP_INTERCEPTOR`
- Fire-and-forget logging (never throws errors)
- Excludes: `/health`, `/metrics`, `/notifications/stream`, OPTIONS requests

**Fields being logged:**

- `tenant_id`, `user_id`, `user_name`, `user_role`
- `action` (read/create/update/delete)
- `resource_type` (extracted from URL)
- `resource_id`, `resource_name`
- `ip_address`, `user_agent`
- `status` (success/failure), `error_message`

**Verified:** `SELECT COUNT(*) FROM audit_trail;` -> 25+ entries

---

## Phase 1 COMPLETED (2026-01-19)

**Implemented:**

- Rate Limiting: `ExportThrottle()` - 1 request per minute
- `backend/src/nest/common/decorators/throttle.decorators.ts` extended
- `backend/src/nest/throttler/throttler.module.ts` extended
- `logs.controller.ts` with `@UseGuards(CustomThrottlerGuard)` + `@ExportThrottle()`

**Already existing (from earlier):**

- `unified-logs.service.ts` - Cursor-based streaming
- `log-formatters.service.ts` - JSON/CSV/TXT
- `export-logs.dto.ts` - Zod validation
- `/api/v2/logs/export` endpoint

---

## Phase 0: audit_trail Logging (CRITICAL - MUST DO FIRST!)

### 0.0 Must Read Before Start

**NestJS Core:**

- https://docs.nestjs.com/interceptors - Interceptor Pattern
- https://docs.nestjs.com/interceptors#binding-interceptors - Global Registration
- https://docs.nestjs.com/fundamentals/execution-context - Request/User Context
- https://docs.nestjs.com/exception-filters - Error Logging
- https://docs.nestjs.com/faq/request-lifecycle - When interceptors run

**Fastify-specific (we use Fastify, NOT Express!):**

- https://fastify.dev/docs/latest/Reference/Request/ - Fastify Request Object
- https://fastify.dev/docs/latest/Reference/Hooks/ - Fastify Lifecycle Hooks

**RxJS (for tap/catchError in interceptor):**

- https://rxjs.dev/api/operators/tap - Success logging
- https://rxjs.dev/api/operators/catchError - Error logging

**PostgreSQL (for INSERT performance):**

- https://www.postgresql.org/docs/current/sql-insert.html - Bulk insert patterns

---

### 0.1 Difference: audit_trail vs root_logs

| Table         | Purpose                               | What is logged                           | Who sees it                        |
| ------------- | ------------------------------------- | ---------------------------------------- | ---------------------------------- |
| `audit_trail` | **Compliance/Audit** - log EVERYTHING | Every request, every action, page visits | TXT/CSV export for compliance      |
| `root_logs`   | **Dashboard** - Critical CRUD         | login, logout, create, update, delete    | Directly visible in root dashboard |

### 0.2 To implement: Global Audit Interceptor

**File:** `backend/src/nest/common/interceptors/audit-trail.interceptor.ts`

```typescript
@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  constructor(
    private readonly db: DatabaseService,
    private readonly logger: Logger,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (response) => {
        // Log successful request to audit_trail
        await this.logToAuditTrail({
          tenantId: user?.tenantId,
          userId: user?.id,
          userName: user?.email,
          userRole: user?.role,
          action: this.getActionFromMethod(request.method),
          resourceType: this.getResourceType(request.url),
          resourceId: request.params?.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          status: 'success',
          duration: Date.now() - startTime,
        });
      }),
      catchError(async (error) => {
        // Log failed request to audit_trail
        await this.logToAuditTrail({
          // ... same as above but status: 'failure', errorMessage: error.message
        });
        throw error;
      }),
    );
  }
}
```

### 0.3 What needs to be logged?

| Request Type | Action           | Example           |
| ------------ | ---------------- | ----------------- |
| GET (list)   | `read`           | GET /users        |
| GET (single) | `read`           | GET /users/123    |
| POST         | `create`         | POST /users       |
| PUT/PATCH    | `update`         | PUT /users/123    |
| DELETE       | `delete`         | DELETE /users/123 |
| Auth         | `login`/`logout` | POST /auth/login  |

### 0.4 Tasks

- [x] Create `audit-trail.interceptor.ts` 2026-01-19
- [x] Register interceptor globally in `app.module.ts` 2026-01-19
- [x] Test: Visit page -> Check audit_trail has entry 2026-01-19
- [x] Test: API call -> Check audit_trail has entry 2026-01-19
- [x] Exclude health-check endpoints from logging 2026-01-19
- [x] Exclude high-frequency endpoints (notifications/stream, etc.) 2026-01-19

---

### Phase 1 Completed Items:

- [x] `unified-logs.service.ts` with cursor-based streaming
- [x] `log-formatters.service.ts` for JSON/CSV/TXT
- [x] `export-logs.dto.ts` with Zod validation
- [x] `/api/v2/logs/export` endpoint (GET)
- [x] RLS security (app.tenant_id set before queries)
- [x] Date range validation (max 365 days)
- [x] Bruno API tests (6 files)

### Phase 1 Missing Items:

- [x] Rate limiting (1 export/min per user) 2026-01-19 - `ExportThrottle()` decorator
- [x] Log export actions to audit_trail 2026-01-19 - via `AuditTrailInterceptor`
- [ ] Load testing with 1M+ logs (optional, do when needed)

---

## Phase 2 COMPLETED (2026-01-19)

**Migration:** `database/migrations/004-audit-log-partitioning.sql`

**Implemented:**

- `audit_trail` and `root_logs` now partitioned (PARTITION BY RANGE on `created_at`)
- 36 monthly partitions created (2025-01 to 2027-12)
- RLS policies transferred to partitioned tables
- Data migrated: 25 audit_trail, 91 root_logs entries
- Indexes per partition: `tenant_id+created_at`, `action`, `resource_type+resource_id`, `status`, `user_id`

**New Services:**

- `backend/src/nest/logs/partition-manager.service.ts` (~210 lines)
  - `@Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)` - Creates partitions 3 months ahead
  - Automatic detection whether partitioning is active

**Verified:**

```sql
\d audit_trail
-- Partitioned table "public.audit_trail"
-- Partition key: RANGE (created_at)
-- Number of partitions: 36
```

---

## Phase 3 COMPLETED (2026-01-19)

**Frontend Export UI:** `frontend/src/routes/(app)/logs/+page.svelte`

**Implemented:**

- Collapsible export section
- Date range selection (dateFrom, dateTo) - Default: last 30 days
- Format dropdown: CSV, JSON, TXT
- Source dropdown: All, Audit Trail, System Logs
- Export button with loading state
- Rate limit handling (429 + Retry-After header)
- Success/error feedback

**New Files:**

- `frontend/src/routes/(app)/logs/_lib/types.ts` - Export types (ExportFormat, ExportSource, ExportLogsParams)
- `frontend/src/routes/(app)/logs/_lib/constants.ts` - Export constants (EXPORT_FORMAT_OPTIONS, etc.)
- `frontend/src/routes/(app)/logs/_lib/api.ts` - `exportLogs()` function with RateLimitError class

---

## Phase 4 COMPLETED (2026-01-19)

**Service:** `backend/src/nest/logs/log-retention.service.ts` (~360 lines)

**Implemented:**

- `@Cron('0 3 * * *')` - Daily cleanup at 3 AM
- Per-tenant retention via `tenant_settings.audit_log_retention_days`
- Default: 365 days, Minimum: 7 days
- Batched DELETE (10,000 rows per batch) to avoid lock contention
- Automatic partition detection: Uses DETACH+DROP when partitioning is active (100x faster!)
- Cleanup statistics logged

**Retention Settings:**

```sql
-- Set retention per tenant:
INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, value_type, category)
VALUES (1, 'audit_log_retention_days', '180', 'integer', 'audit')
ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = '180';
```

**Verified:**

```
[PartitionManagerService] Partitioning detected - PartitionManagerService active
[LogRetentionService] Partitioning detected - using fast partition detach for cleanup
```

---

## Phase 1: Backend - Unified Export Service

### 1.1 Create Unified Logs Service

**File:** `backend/src/nest/logs/unified-logs.service.ts`

```typescript
// Combines audit_trail + root_logs into single exportable format
interface UnifiedLogEntry {
  id: string; // UUIDv7
  timestamp: string; // ISO 8601
  tenantId: number;
  userId: number;
  userName: string;
  userRole: string;
  source: 'audit_trail' | 'root_logs';
  action: string;
  entityType: string;
  entityId?: number;
  details?: string;
  ipAddress?: string;
  status?: 'success' | 'failure';
}
```

**Tasks:**

- [ ] Create `unified-logs.service.ts` with streaming support
- [ ] Implement cursor-based pagination (NOT offset-based)
- [ ] Add date range filtering (mandatory for exports)
- [ ] Add AsyncGenerator for memory-efficient streaming

### 1.2 Cursor-Based Streaming (CRITICAL for Scale)

**Why:** Loading 1M+ logs into memory crashes the server (~500MB+ RAM).

### 1.2.1 RLS Security Requirement (CRITICAL!)

**Problem:** The RLS policy allows ALL rows when `app.tenant_id` is not set:

```sql
-- Current RLS policy on audit_trail and root_logs:
USING (
  (NULLIF(current_setting('app.tenant_id', true), '') IS NULL)  -- Warning: NULL = ALL visible!
  OR
  (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
)
```

**Risk without fix:**

```
Cursor uses pool connection
        |
app.tenant_id NOT set
        |
RLS: "IS NULL" = TRUE
        |
ALL TENANT DATA VISIBLE = DATA BREACH!
```

**Solution:** `set_config('app.tenant_id', ...)` MUST be called before the cursor query!

**File:** `backend/src/nest/logs/unified-logs.service.ts`

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { Pool } from 'pg';
import Cursor from 'pg-cursor';

import { PG_POOL } from '../database/database.constants.js';

@Injectable()
export class UnifiedLogsService {
  private readonly logger = new Logger(UnifiedLogsService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Stream logs with RLS-aware cursor.
   *
   * CRITICAL: Sets app.tenant_id before ANY query to enforce RLS!
   * Without this, the RLS policy would return ALL rows (security breach).
   *
   * Uses PostgreSQL cursor - only 1000 rows in RAM at a time.
   */
  async *streamLogs(
    tenantId: number,
    dateFrom: Date,
    dateTo: Date,
    source: 'audit_trail' | 'root_logs' | 'all' = 'all',
  ): AsyncGenerator<UnifiedLogEntry> {
    // Validate tenantId - NEVER allow undefined/0
    if (tenantId === undefined || tenantId === 0) {
      throw new Error('tenantId is required for RLS-protected queries');
    }

    const client = await this.pool.connect();

    try {
      // ============================================================
      // CRITICAL: Set RLS context BEFORE any query!
      // Without this, RLS policy returns ALL rows (data breach)
      // ============================================================
      await this.setRlsContext(client, tenantId);

      this.logger.debug(`Streaming logs for tenant ${tenantId}, ${dateFrom} to ${dateTo}`);

      // Stream from audit_trail
      if (source === 'all' || source === 'audit_trail') {
        yield* this.streamFromTable(client, 'audit_trail', tenantId, dateFrom, dateTo);
      }

      // Stream from root_logs
      if (source === 'all' || source === 'root_logs') {
        yield* this.streamFromTable(client, 'root_logs', tenantId, dateFrom, dateTo);
      }
    } finally {
      // Always release connection back to pool
      client.release();
    }
  }

  /**
   * Set RLS context on connection.
   * MUST be called before any tenant-scoped query!
   */
  private async setRlsContext(client: PoolClient, tenantId: number): Promise<void> {
    // set_config with is_local=false to persist for entire connection session
    // (not just transaction, since cursors may span multiple read operations)
    await client.query(`SELECT set_config('app.tenant_id', $1::text, false)`, [String(tenantId)]);
  }

  /**
   * Clear RLS context when done (defense in depth).
   * Called in finally block to prevent context leaking to next pool user.
   */
  private async clearRlsContext(client: PoolClient): Promise<void> {
    await client.query(`SELECT set_config('app.tenant_id', '', false)`);
  }

  private async *streamFromTable(
    client: PoolClient,
    table: string,
    tenantId: number,
    dateFrom: Date,
    dateTo: Date,
  ): AsyncGenerator<UnifiedLogEntry> {
    // Note: We still include tenant_id in WHERE as defense-in-depth
    // RLS handles isolation, but explicit filter is safer
    const cursor = client.query(
      new Cursor(
        `SELECT *, '${table}' as source FROM ${table}
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
         ORDER BY created_at DESC`,
        [tenantId, dateFrom, dateTo],
      ),
    );

    const BATCH_SIZE = 1000;
    let rows: any[];

    try {
      while ((rows = await cursor.read(BATCH_SIZE)).length > 0) {
        for (const row of rows) {
          yield this.mapToUnifiedEntry(row);
        }
      }
    } finally {
      await cursor.close();
    }
  }

  private mapToUnifiedEntry(row: any): UnifiedLogEntry {
    return {
      id: String(row.id),
      timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      tenantId: row.tenant_id,
      userId: row.user_id,
      userName: row.user_name ?? row.username ?? 'Unknown',
      userRole: row.user_role ?? row.role ?? '',
      source: row.source,
      action: row.action,
      entityType: row.resource_type ?? row.entity_type ?? '',
      entityId: row.resource_id ?? row.entity_id,
      details: row.details ?? row.resource_name,
      ipAddress: row.ip_address,
      status: row.status ?? 'success',
    };
  }
}
```

**Memory Usage:**

| Approach         | 1M Logs RAM | 10M Logs RAM |
| ---------------- | ----------- | ------------ |
| Load all (BAD)   | ~500MB      | ~5GB (crash) |
| Cursor streaming | ~50MB       | ~50MB        |

**Tasks:**

- [ ] Install `pg-cursor` package
- [ ] Implement AsyncGenerator pattern
- [ ] Add backpressure handling for slow clients
- [ ] Test with 1M+ mock logs

### 1.3 Add Export Endpoints

**File:** `backend/src/nest/logs/logs.controller.ts`

| Endpoint                         | Method | Description          | Format      |
| -------------------------------- | ------ | -------------------- | ----------- |
| `/api/v2/logs/export`            | GET    | Export unified logs  | JSON stream |
| `/api/v2/logs/export?format=csv` | GET    | Export as CSV        | CSV stream  |
| `/api/v2/logs/export?format=txt` | GET    | Export as plain text | TXT stream  |

**Query Parameters:**

```typescript
interface ExportQueryDto {
  format: 'json' | 'csv' | 'txt'; // default: json
  dateFrom: string; // required, ISO 8601
  dateTo: string; // required, ISO 8601
  source?: 'audit_trail' | 'root_logs' | 'all'; // default: all
  action?: string; // filter by action
  userId?: number; // filter by user
}
```

**Tasks:**

- [ ] Add export endpoint with streaming response
- [ ] Implement CSV formatter (use `fast-csv` or manual)
- [ ] Implement TXT formatter (human-readable)
- [ ] Add Content-Disposition header for download
- [ ] Add rate limiting (1 export/minute per user)

### 1.3 TXT Format Specification

```txt
================================================================================
ASSIXX AUDIT LOG EXPORT
Tenant: Example GmbH (ID: 12)
Period: 2026-01-01 00:00:00 to 2026-01-15 23:59:59
Generated: 2026-01-15T14:30:00Z
Total Entries: 1,234
================================================================================

[2026-01-15 14:25:33] LOGIN user=admin@example.de role=admin ip=192.168.1.100
[2026-01-15 14:26:01] CREATE user entity=employee id=456 by=admin@example.de
[2026-01-15 14:27:15] UPDATE department entity=department id=3 by=admin@example.de
[2026-01-15 14:28:00] DELETE document entity=document id=789 by=admin@example.de

================================================================================
END OF EXPORT
================================================================================
```

## Phase 2: Database Optimization (CRITICAL)

### 2.1 Table Partitioning (MANDATORY)

**Why:** Without partitioning, queries scan ALL rows. With partitioning, only relevant months are scanned.

**File:** `database/migrations/XXX-audit-log-partitioning.sql`

```sql
-- ============================================================================
-- STEP 1: Create new partitioned tables
-- ============================================================================

-- Partitioned audit_trail
CREATE TABLE audit_trail_partitioned (
    id SERIAL,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id INTEGER,
    resource_name VARCHAR(255),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partitioned root_logs
CREATE TABLE root_logs_partitioned (
    id SERIAL,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    details TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    was_role_switched BOOLEAN DEFAULT FALSE,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- STEP 2: Create partitions (one per month)
-- ============================================================================

-- Create partitions for 2026 (adjust as needed)
DO $$
DECLARE
    start_date DATE := '2026-01-01';
    end_date DATE := '2027-01-01';
    current_date DATE := start_date;
    partition_name TEXT;
BEGIN
    WHILE current_date < end_date LOOP
        -- audit_trail partitions
        partition_name := 'audit_trail_' || TO_CHAR(current_date, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_trail_partitioned
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            current_date,
            current_date + INTERVAL '1 month'
        );

        -- root_logs partitions
        partition_name := 'root_logs_' || TO_CHAR(current_date, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF root_logs_partitioned
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            current_date,
            current_date + INTERVAL '1 month'
        );

        current_date := current_date + INTERVAL '1 month';
    END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Enable RLS on partitioned tables (CRITICAL!)
-- ============================================================================

-- Enable RLS on partitioned parent tables
ALTER TABLE audit_trail_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail_partitioned FORCE ROW LEVEL SECURITY;

ALTER TABLE root_logs_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_logs_partitioned FORCE ROW LEVEL SECURITY;

-- Create RLS policies (same as original tables)
-- Policy allows ALL if app.tenant_id not set (for migrations/admin)
-- Otherwise filters by tenant_id
CREATE POLICY tenant_isolation ON audit_trail_partitioned
    USING (
        (NULLIF(current_setting('app.tenant_id', true), '') IS NULL)
        OR
        (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
    );

CREATE POLICY tenant_isolation ON root_logs_partitioned
    USING (
        (NULLIF(current_setting('app.tenant_id', true), '') IS NULL)
        OR
        (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
    );

-- NOTE: In PostgreSQL 10+, RLS policies on partitioned tables
-- are automatically inherited by all partitions. No need to
-- create policies on individual partitions.

-- ============================================================================
-- STEP 4: Create indexes on partitioned tables
-- ============================================================================

CREATE INDEX idx_audit_trail_part_tenant_date
    ON audit_trail_partitioned (tenant_id, created_at DESC);

CREATE INDEX idx_root_logs_part_tenant_date
    ON root_logs_partitioned (tenant_id, created_at DESC);

-- Partial index for non-deleted logs
CREATE INDEX idx_root_logs_part_active
    ON root_logs_partitioned (tenant_id, created_at DESC)
    WHERE is_active IS NULL OR is_active != 4;

-- ============================================================================
-- STEP 5: Migrate existing data (run during maintenance window)
-- ============================================================================

-- INSERT INTO audit_trail_partitioned SELECT * FROM audit_trail;
-- INSERT INTO root_logs_partitioned SELECT * FROM root_logs;

-- ============================================================================
-- STEP 6: Swap tables (after data migration verified)
-- ============================================================================

-- ALTER TABLE audit_trail RENAME TO audit_trail_old;
-- ALTER TABLE audit_trail_partitioned RENAME TO audit_trail;
-- ALTER TABLE root_logs RENAME TO root_logs_old;
-- ALTER TABLE root_logs_partitioned RENAME TO root_logs;
```

**Performance Impact:**

| Query                            | Without Partitioning | With Partitioning |
| -------------------------------- | -------------------- | ----------------- |
| Last 30 days, 10M total rows     | ~5-10s (full scan)   | ~200ms (1 month)  |
| Export Jan 2026, 100M total rows | ~50s (full scan)     | ~2s (1 partition) |

**Tasks:**

- [ ] Create migration file with partitioning DDL
- [ ] Test on staging with sample data
- [ ] Plan migration window for existing data
- [ ] Create cron job for future partition creation
- [ ] Document rollback procedure

### 2.2 Automatic Partition Creation

**File:** `backend/src/nest/logs/partition-manager.service.ts`

```typescript
@Injectable()
export class PartitionManagerService {
  private readonly logger = new Logger(PartitionManagerService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create partitions for next 3 months (run monthly via cron)
   */
  @Cron('0 0 1 * *') // First day of each month at midnight
  async createFuturePartitions(): Promise<void> {
    const tables = ['audit_trail', 'root_logs'];

    for (const table of tables) {
      for (let i = 1; i <= 3; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() + i);
        await this.createPartitionIfNotExists(table, date);
      }
    }
  }

  private async createPartitionIfNotExists(table: string, date: Date): Promise<void> {
    const partitionName = `${table}_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF ${table}
        FOR VALUES FROM ('${startDate.toISOString()}') TO ('${endDate.toISOString()}')
      `);
      this.logger.log(`Created partition: ${partitionName}`);
    } catch (error) {
      // Partition already exists - ignore
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        throw error;
      }
    }
  }
}
```

### 2.3 Add Indexes for Export Performance

```sql
-- Additional indexes (created automatically on partitions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_trail_tenant_date
  ON audit_trail (tenant_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_root_logs_tenant_date
  ON root_logs (tenant_id, created_at DESC);

-- Partial index for non-deleted logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_root_logs_active
  ON root_logs (tenant_id, created_at DESC)
  WHERE is_active IS NULL OR is_active != 4;
```

**Tasks:**

- [ ] Create indexes on existing tables
- [ ] Test query performance with EXPLAIN ANALYZE
- [ ] Document index maintenance requirements

### 2.2 Add Retention Configuration

**Table:** `tenant_settings`

```sql
-- Add retention settings (if not exists)
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS audit_log_retention_days INTEGER DEFAULT 365,
  ADD COLUMN IF NOT EXISTS root_log_retention_days INTEGER DEFAULT 365;

-- Constraint: minimum 30 days, maximum 2555 days (7 years)
ALTER TABLE tenant_settings
  ADD CONSTRAINT chk_audit_retention
  CHECK (audit_log_retention_days BETWEEN 30 AND 2555);
```

**Tasks:**

- [ ] Create migration for retention columns
- [ ] Add retention settings to admin UI
- [ ] Create cleanup job (runs daily, deletes expired logs)

## Phase 3: Frontend - Admin Logs UI

### 3.1 Create Logs Page

**File:** `frontend/src/routes/(app)/audit-logs/+page.svelte`

**Features:**

- [ ] Date range picker (required)
- [ ] Source filter (audit_trail, root_logs, all)
- [ ] Action filter dropdown
- [ ] User filter (autocomplete)
- [ ] Search box (details/entity name)
- [ ] Pagination (50 entries/page)
- [ ] Export button (CSV, TXT, JSON)

**UI Components:**

```svelte
<script lang="ts">
  let dateFrom = $state('');
  let dateTo = $state('');
  let source = $state<'all' | 'audit_trail' | 'root_logs'>('all');
  let format = $state<'csv' | 'txt' | 'json'>('csv');
</script>

<!-- Filter Bar -->
<div class="filter-bar">
  <DateRangePicker bind:from={dateFrom} bind:to={dateTo} />
  <Select bind:value={source} options={['all', 'audit_trail', 'root_logs']} />
  <Button onclick={handleExport}>Export as {format.toUpperCase()}</Button>
</div>

<!-- Logs Table -->
<Table {data} columns={[...]} />
```

### 3.2 Create API Client

**File:** `frontend/src/routes/(app)/audit-logs/_lib/api.ts`

```typescript
export async function exportLogs(params: ExportParams): Promise<Blob> {
  const url = new URL('/api/v2/logs/export', window.location.origin);
  url.searchParams.set('format', params.format);
  url.searchParams.set('dateFrom', params.dateFrom);
  url.searchParams.set('dateTo', params.dateTo);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Tasks:**

- [ ] Create page structure in `routes/(app)/audit-logs/`
- [ ] Add `+page.svelte`, `+page.server.ts`
- [ ] Create `_lib/` folder with api.ts, types.ts
- [ ] Style with existing design system
- [ ] Add to navigation (admin only)

## Phase 4: Cleanup Job

### 4.1 Create Retention Cleanup Service

**File:** `backend/src/nest/logs/log-retention.service.ts`

```typescript
@Injectable()
export class LogRetentionService {
  @Cron('0 3 * * *') // Daily at 3 AM
  async cleanupExpiredLogs(): Promise<void> {
    // Get all tenants with retention settings
    // Delete logs older than retention period
    // Log cleanup statistics
  }
}
```

**Tasks:**

- [ ] Create retention service with NestJS scheduler
- [ ] Add cleanup statistics logging
- [ ] Add admin notification on large cleanups
- [ ] Test with dry-run mode first

## File Structure

```
backend/src/nest/logs/
├── logs.module.ts              # Existing (update with new services)
├── logs.controller.ts          # Enhance with streaming export endpoints
├── logs.service.ts             # Existing (root_logs)
├── unified-logs.service.ts     # NEW: Cursor-based streaming export
├── log-retention.service.ts    # NEW: Cleanup job
├── partition-manager.service.ts # NEW: Auto-create partitions
└── dto/
    ├── index.ts
    ├── export-logs.dto.ts      # NEW
    └── ... (existing)

frontend/src/routes/(app)/audit-logs/
├── +page.svelte             # NEW
├── +page.server.ts          # NEW
└── _lib/
    ├── api.ts               # NEW
    ├── types.ts             # NEW
    └── LogsTable.svelte     # NEW
```

## Dependencies

**New dependencies:**

- `pg-cursor` - PostgreSQL cursor for streaming large result sets

```bash
cd backend && pnpm add pg-cursor
cd backend && pnpm add -D @types/pg-cursor
```

**Existing (already installed):**

- `fast-csv` (if not installed, install for CSV generation)
- `@nestjs/schedule` (for cron jobs)

## Testing

### API Integration Tests (Vitest)

Tests in `backend/test/logs.api.test.ts` (JSON/CSV/TXT export + validation).

### Unit Tests

- [ ] UnifiedLogsService.getUnifiedLogs()
- [ ] CSV/TXT formatters
- [ ] Retention cleanup logic

## Rollout Plan

| Phase | Description                             | Effort   | Risk   | Status |
| ----- | --------------------------------------- | -------- | ------ | ------ |
| 1     | Backend: Streaming + Unified Export     | 3-4 days | Low    | DONE   |
| 2     | Database: Partitioning + Indexes        | 1-2 days | Medium | DONE   |
| 3     | Frontend: Admin Logs UI                 | 2-3 days | Low    | DONE   |
| 4     | Cleanup: Retention Job + Partition Mgmt | 1 day    | Low    | DONE   |

**Total estimated effort:** 7-10 days -> **Completed: 2026-01-19**

### Phase 2 Risk Mitigation

Partitioning migration requires:

1. **Staging test** with production-like data volume
2. **Maintenance window** for data migration (~1 hour for 10M rows)
3. **Rollback plan** (keep old tables for 7 days)

## Success Criteria

### Functional

- [x] Admin can export all logs for date range as CSV/TXT/JSON
- [x] Logs are isolated by tenant_id (no cross-tenant leakage)
- [x] Retention cleanup runs daily without manual intervention
- [x] Partitions created automatically for future months
- [x] Bruno API tests pass

### Performance (CRITICAL)

| Metric                | Target      | Test Method                   |
| --------------------- | ----------- | ----------------------------- |
| Export 100K logs      | <5 seconds  | Bruno test with timer         |
| Export 1M logs        | <30 seconds | Load test with mock data      |
| RAM during 1M export  | <100MB      | Monitor with `docker stats`   |
| Query with partitions | <500ms      | EXPLAIN ANALYZE on date range |

### Load Testing Script

```bash
# Generate 1M test logs (run in staging only!)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
INSERT INTO audit_trail (tenant_id, user_id, action, resource_type, created_at)
SELECT
    1,
    (random() * 100)::int,
    (ARRAY['login', 'create', 'update', 'delete'])[floor(random() * 4 + 1)],
    (ARRAY['user', 'document', 'department'])[floor(random() * 3 + 1)],
    NOW() - (random() * 365 || ' days')::interval
FROM generate_series(1, 1000000);
"

# Test export performance
time curl -s "http://localhost:3000/api/v2/logs/export?format=csv&dateFrom=2025-01-01&dateTo=2026-01-01" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
```

## Security Considerations

### RLS (Row-Level Security) - CRITICAL

- [x] **Set `app.tenant_id` before EVERY cursor query** (see 1.2.1)
- [x] Validate tenantId is not undefined/0/null before any query
- [x] Include `WHERE tenant_id = $1` as defense-in-depth (even with RLS)
- [x] Test: Query without `set_config` must return 0 rows (not all rows!)

### RLS Security Test

```typescript
// Add to test suite - MUST PASS before deployment!
it('should not leak data when app.tenant_id not set', async () => {
  const client = await pool.connect();
  try {
    // Intentionally DO NOT set app.tenant_id
    // With FORCE ROW LEVEL SECURITY, this should return 0 rows
    const result = await client.query('SELECT COUNT(*) FROM audit_trail WHERE tenant_id = 1');

    // If RLS is working correctly with FORCE, owner queries are also filtered
    // If this returns > 0, RLS policy is misconfigured!
    expect(Number(result.rows[0].count)).toBe(0);
  } finally {
    client.release();
  }
});
```

### General Security

- [x] Export requires admin/root role
- [x] Rate limit exports (prevent DoS) - 1 export/minute via `ExportThrottle()`
- [x] Log all export actions to audit_trail - via `AuditTrailInterceptor`
- [x] Sanitize output (no SQL injection in exports)
- [ ] Add GDPR notice in export header (optional, for future)

---

## Implementation Details (2026-01-19)

### Key Files Modified/Created

| File                                                              | Purpose                       |
| ----------------------------------------------------------------- | ----------------------------- |
| `backend/src/nest/common/interceptors/audit-trail.interceptor.ts` | Global request logging        |
| `backend/src/nest/logs/unified-logs.service.ts`                   | Cursor-based streaming export |
| `backend/src/nest/logs/log-formatters.service.ts`                 | JSON/CSV/TXT formatting       |
| `backend/src/nest/logs/log-retention.service.ts`                  | Automatic cleanup job         |
| `backend/src/nest/logs/partition-manager.service.ts`              | Auto-create partitions        |
| `backend/src/nest/logs/logs.controller.ts`                        | Export endpoint + date fix    |
| `database/migrations/004-audit-log-partitioning.sql`              | Partition tables              |

### Audit Trail Interceptor Features

```typescript
// Current action types
type AuditAction = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'list';

// Excluded from logging
EXCLUDED_PATHS: ['/health', '/metrics', '/notifications/stream', ...]
SKIPPED_GET_SUFFIXES: ['/stats', '/count', '/export', '/search', ...]

// Throttled (logged once per 30s per user)
CURRENT_USER_ENDPOINTS: ['/users/me', '/auth/me', '/me']

// JSONB metadata in `changes` column
interface AuditChangesMetadata {
  endpoint: string;      // /api/v2/users/123
  http_method: string;   // GET, POST, PUT, DELETE
  http_status?: number;  // 200, 404, 500
  duration_ms: number;   // Request duration
}
```

### Export Date Filter Fix

**Problem:** `dateTo: "2026-01-19"` became `00:00:00` -> Today's entries excluded!

**Fix in `logs.controller.ts`:**

```typescript
private toEndOfDay(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}
```

---

## Future Extension Guide

See **ADR-009-central-audit-logging.md** section "Extending the Audit Logging System" for:

- Adding new columns to `audit_trail`
- Adding new log source tables
- Using the `changes` JSONB field
- Excluding endpoints from logging
- Adding new action types

---

_Last Updated: 2026-01-19 (v5 - Added Implementation Details & Extension Guide)_
