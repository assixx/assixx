# ADR-031: Centralized Read-Tracking Architecture

| Metadata                | Value                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| **Status**              | Accepted                                                                 |
| **Date**                | 2026-03-07                                                               |
| **Decision Makers**     | SCS Technik                                                              |
| **Affected Components** | backend/src/nest/common/services/, database/migrations/, work-orders     |

---

## Context

### Problem

Multiple features (Blackboard, Document Explorer, Work Orders) need per-user "read status" tracking to show a "Neu" (New) badge on unseen items. Each feature had evolved its own approach:

| Feature           | Pattern               | Problem                                        |
| ----------------- | --------------------- | ---------------------------------------------- |
| Document Explorer | N+1 queries per item  | O(N) lookups — performance degrades with scale  |
| Blackboard        | Inline confirmation   | Tightly coupled to blackboard logic             |
| Work Orders       | (missing)             | No read tracking at all                         |

### Requirements

1. Consistent read-tracking across all entity types
2. O(1) per-item cost via LEFT JOIN (not N+1 per-entity queries)
3. Tenant isolation via RLS
4. Idempotent mark-as-read (UPSERT pattern)
5. Fire-and-forget safe (failures must not break business logic)

---

## Decision

### Shared ReadTrackingService

A generic, config-driven `ReadTrackingService` registered in the `@Global()` `DatabaseModule`. Each feature provides a `ReadTrackingConfig` object — no subclassing or module-specific code needed:

```typescript
export interface ReadTrackingConfig {
  tableName: string;       // e.g. 'work_order_read_status'
  entityColumn: string;    // e.g. 'work_order_id'
  entityTable: string;     // e.g. 'work_orders'
  entityUuidColumn: string; // e.g. 'uuid'
}
```

### Database Pattern

Each entity gets its own `*_read_status` table:

```sql
CREATE TABLE work_order_read_status (
  id            SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  read_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UPSERT support
CREATE UNIQUE INDEX idx_wo_read_status_unique
  ON work_order_read_status (work_order_id, user_id, tenant_id);

-- LEFT JOIN performance
CREATE INDEX idx_wo_read_status_user_tenant
  ON work_order_read_status (user_id, tenant_id);
```

### Query Integration

List queries use a LEFT JOIN with a `CASE` expression:

```sql
CASE WHEN rs.id IS NOT NULL THEN 1 ELSE 0 END AS is_read
...
LEFT JOIN work_order_read_status rs
  ON rs.work_order_id = wo.id AND rs.user_id = $X AND rs.tenant_id = $Y
```

This ensures O(1) cost per item (single join, no N+1 subqueries).

### Mark-as-Read API

Each entity exposes `POST /:uuid/read` — idempotent, fire-and-forget safe:

```typescript
await this.readTracking.markAsReadByUuid(config, uuid, userId, tenantId);
```

The service uses `INSERT ... ON CONFLICT DO UPDATE SET read_at = NOW()` — safe to call multiple times.

---

## Alternatives Considered

| Alternative                     | Rejected Because                                                     |
| ------------------------------- | -------------------------------------------------------------------- |
| N+1 queries per item            | O(N) performance — unacceptable for paginated lists                  |
| Single shared `entity_reads`    | Polymorphic FK — violates referential integrity, complicates indexes |
| Redis-based read tracking       | Not persistent across restarts, no audit trail                       |
| Notification system reuse       | Different semantics: notification-read (sidebar badge) vs entity-read ("Neu" badge) are independent concepts |

---

## Consequences

### Positive

- **Reusable**: Any new entity can add read tracking by creating a migration + config object
- **Performant**: LEFT JOIN in list queries — no additional round trips
- **Consistent**: Same pattern across all features — predictable for developers
- **Safe**: Fire-and-forget with warn-level logging — never breaks business logic

### Negative

- Each entity requires its own `*_read_status` table (one migration per feature)
- Detail queries (`getWorkOrder`) don't include `is_read` — only list views have it

### Migration Path for Existing Features

Document Explorer's N+1 pattern can be migrated to this shared service in a future refactor.

---

## References

- [ADR-019: Multi-Tenant RLS Isolation](./ADR-019-multi-tenant-rls-isolation.md) — RLS policy pattern
- [ADR-009: Central Audit Logging](./ADR-009-central-audit-logging.md) — ActivityLoggerService integration
- [ADR-003: Notification System](./ADR-003-notification-system.md) — Distinction: notification-read vs entity-read
- [ADR-018: Testing Strategy](./ADR-018-testing-strategy.md) — API integration test patterns
