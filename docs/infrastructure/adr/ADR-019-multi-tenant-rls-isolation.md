# ADR-019: Multi-Tenant Data Isolation via PostgreSQL Row Level Security

| Metadata                | Value                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                     |
| **Date**                | 2026-02-07                                                                   |
| **Decision Makers**     | SCS-Technik Team                                                             |
| **Affected Components** | PostgreSQL, Backend (DatabaseService, JwtAuthGuard, ClsModule)               |
| **Supersedes**          | —                                                                            |
| **Related ADRs**        | ADR-005 (Auth), ADR-006 (CLS Context), ADR-009 (Audit), ADR-014 (Migrations) |

---

## Context

Assixx is a **Multi-Tenant SaaS** platform where each tenant (company) stores data in the **same PostgreSQL database**. Tenant isolation is the #1 security requirement: an employee of Tenant A must never see, modify, or even know about data from Tenant B.

### The Problem

Application-level tenant filtering (`WHERE tenant_id = $1`) is fragile:

1. **A single forgotten `WHERE tenant_id = ?` in any query leaks data cross-tenant**
2. Every developer must remember to add tenant filtering to every query
3. Bugs in application code bypass isolation entirely — no safety net
4. Code reviews cannot catch every missing filter (human error)
5. ORMs and query builders can silently omit tenant conditions

### Requirements

- Tenant isolation must be **impossible to bypass** from application code
- Root users (system admins) must access all tenants for management
- User-level isolation needed for sensitive data (private messages, chat documents)
- Zero performance overhead on the hot path
- Must work with the `pg` library (raw SQL, no ORM)

---

## Decision

**PostgreSQL Row Level Security (RLS)** enforces tenant isolation at the database engine level. Every tenant-scoped table has:

1. `ENABLE ROW LEVEL SECURITY` — activates RLS filtering
2. `FORCE ROW LEVEL SECURITY` — applies policies even to table owners
3. A `tenant_isolation` policy that checks `current_setting('app.tenant_id')` against the row's `tenant_id`

The application sets `app.tenant_id` via `set_config()` per transaction. PostgreSQL then **automatically filters** every SELECT, INSERT, UPDATE, and DELETE — no application code can bypass it.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  HTTP Request                                                    │
│      │                                                           │
│      ▼                                                           │
│  JwtAuthGuard (ADR-005)                                         │
│  ├─ Verify JWT signature                                        │
│  ├─ Lookup user in DB (fresh, every request)                    │
│  ├─ Validate is_active = 1                                      │
│  └─ Set CLS context: tenantId, userId, userRole                 │
│      │                                                           │
│      ▼                                                           │
│  ClsService (ADR-006) — Request-scoped, isolated                │
│  ├─ tenantId = 123                                              │
│  ├─ userId = 456                                                │
│  └─ userRole = 'employee'                                       │
│      │                                                           │
│      ▼                                                           │
│  Service calls DatabaseService.tenantTransaction()              │
│      │                                                           │
│      ▼                                                           │
│  DatabaseService.transaction()                                  │
│  ├─ BEGIN                                                       │
│  ├─ set_config('app.tenant_id', '123', true)  ← GUC variable   │
│  ├─ set_config('app.user_id', '456', true)    ← GUC variable   │
│  ├─ Execute callback (user SQL queries)                         │
│  │   ↓                                                          │
│  │   PostgreSQL RLS policies filter automatically:              │
│  │   SELECT * FROM users                                        │
│  │   → becomes SELECT * FROM users WHERE tenant_id = 123        │
│  │                                                              │
│  ├─ COMMIT (GUC variables auto-cleared)                         │
│  └─ Release client to pool (clean state)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Database Users (Dual-User Model)

| User          | Purpose             | RLS Applied?       | DDL Rights |
| ------------- | ------------------- | ------------------ | ---------- |
| `app_user`    | Backend connections | **Yes**            | No         |
| `assixx_user` | Migrations, admin   | **No** (BYPASSRLS) | Yes        |

The backend connects **exclusively** as `app_user`. This user cannot bypass RLS — even if the application has a bug, PostgreSQL enforces isolation.

`assixx_user` (BYPASSRLS) is used only for:

- Database migrations (`node-pg-migrate`)
- Admin scripts via `psql`
- Seed data operations

### 2. Standard RLS Policy (77 of 79 tables)

```sql
CREATE POLICY tenant_isolation ON table_name
    FOR ALL
    USING (
        -- Clause 1: No tenant context set → allow all (Root/Admin access)
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        -- Clause 2: Tenant context matches row → allow
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );
```

**Why `NULLIF(current_setting(...), '')`?**

PostgreSQL `set_config()` with `is_local=true` resets to empty string `''` (not `NULL`) after `COMMIT`. Without `NULLIF`:

- `''::integer` would throw a cast error
- `'' IS NULL` would be `FALSE`, blocking all queries

`NULLIF('', '')` converts `''` → `NULL`, making `IS NULL` → `TRUE`, allowing unrestricted access when no tenant context is set.

**`current_setting('app.tenant_id', true)`** — the `true` parameter means "return NULL if setting doesn't exist" (prevents errors on first use).

### 3. Self-Referencing Policy (tenants table)

```sql
CREATE POLICY tenant_self_isolation ON tenants
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );
```

Uses `id` instead of `tenant_id` because the `tenants` table references itself.

### 4. User-Level Isolation (messages, documents)

For sensitive data where tenant isolation is not enough (e.g., private messages), additional **RESTRICTIVE** policies check `app.user_id`:

```sql
-- Messages: Only visible to conversation participants
CREATE POLICY participant_isolation ON chat_messages AS RESTRICTIVE
    USING (
        NULLIF(current_setting('app.user_id', true), '') IS NULL
        OR EXISTS (
            SELECT 1 FROM chat_conversation_participants cp
            WHERE cp.conversation_id = chat_messages.conversation_id
              AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
              AND cp.tenant_id = chat_messages.tenant_id
        )
    );
```

```sql
-- Documents: Chat-scoped documents only visible to participants
CREATE POLICY chat_participant_isolation ON documents
    USING (
        access_scope <> 'chat'
        OR (
            NULLIF(current_setting('app.user_id', true), '') IS NULL
            OR (conversation_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM chat_conversation_participants cp
                WHERE cp.conversation_id = documents.conversation_id
                  AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
                  AND cp.tenant_id = documents.tenant_id
            ))
        )
    );
```

**`AS RESTRICTIVE`** means the policy is ANDed with the standard `tenant_isolation` policy. A row must pass **both** policies to be visible.

### 5. Per-Command Policies (conversations table)

```sql
-- INSERT: No USING clause (any tenant can create conversations)
CREATE POLICY conversations_insert ON conversations FOR INSERT WITH CHECK (true);
-- SELECT/UPDATE/DELETE: Standard tenant isolation
CREATE POLICY conversations_select ON conversations FOR SELECT USING (...tenant_isolation...);
CREATE POLICY conversations_update ON conversations FOR UPDATE USING (...tenant_isolation...);
CREATE POLICY conversations_delete ON conversations FOR DELETE USING (...tenant_isolation...);
```

### 6. Backend Integration (set_config)

**DatabaseService** (`backend/src/nest/database/database.service.ts`):

```typescript
async setTenantContext(client: PoolClient, tenantId: number): Promise<void> {
  await client.query(
    `SELECT set_config('app.tenant_id', $1::text, true)`,
    [String(tenantId)]
  );
}

async setUserContext(client: PoolClient, userId: number): Promise<void> {
  await client.query(
    `SELECT set_config('app.user_id', $1::text, true)`,
    [String(userId)]
  );
}

async tenantTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const tenantId = this.cls.get<number | undefined>('tenantId');
  const userId = this.cls.get<number | undefined>('userId');
  return await this.transaction(callback, { tenantId, userId });
}
```

**Key design decisions:**

- `set_config(..., true)` → `is_local=true` = transaction-scoped (auto-cleared on COMMIT/ROLLBACK)
- Uses `SELECT set_config()` instead of `SET` because `SET` doesn't support parameterized queries (SQL injection risk)
- `tenantId` and `userId` read from CLS (ADR-006), not from request parameters (prevents tampering)

### 7. Global Tables (No RLS)

18 tables contain system-wide configuration data shared across all tenants:

| Table                   | Reason                                      |
| ----------------------- | ------------------------------------------- |
| `plans`                 | Subscription plans (Basic, Pro, Enterprise) |
| `features`              | Available features                          |
| `plan_features`         | Plan-to-feature mapping                     |
| `kvp_categories`        | Default KVP categories (seeds)              |
| `machine_categories`    | Default machine categories (seeds)          |
| `system_settings`       | Global system configuration                 |
| `password_reset_tokens` | Stateless, short-lived tokens               |
| `user_sessions`         | JWT sessions (validated by signature)       |
| `pgmigrations`          | Migration tracking (node-pg-migrate)        |

These tables have **no `tenant_id` column** and **no RLS**. They are read-only for `app_user` (GRANTs: SELECT only on critical tables like `plans`).

### 8. Partitioned Tables

`audit_trail` and `root_logs` use monthly partitioning (ADR-009). The **parent table** has RLS enabled. Partitions (`audit_trail_2026_01`, etc.) inherit the parent's RLS policies automatically — they do not need their own.

**72 partition tables** show `rowsecurity = false` in `pg_tables` but are protected via their parent's policy.

---

## Table Coverage Summary

| Category                         | Count   | RLS              | Notes                  |
| -------------------------------- | ------- | ---------------- | ---------------------- |
| Tenant-scoped tables             | 79      | Enabled + Forced | 84 policies total      |
| Global tables (no tenant_id)     | 18      | Not needed       | System config, seeds   |
| Partitions (inherit from parent) | 72      | Inherited        | audit_trail, root_logs |
| Tables with RLS but no policy    | **0**   | —                | Clean!                 |
| **Total**                        | **170** | —                | —                      |

---

## Alternatives Considered

### 1. Application-Level Filtering Only

```typescript
// Every query must manually include tenant_id
const users = await db.query('SELECT * FROM users WHERE tenant_id = $1', [tenantId]);
```

**Rejected:**

- Single forgotten `WHERE tenant_id = ?` = data leak
- No defense in depth — application bugs bypass isolation completely
- Cannot enforce at code review scale (hundreds of queries)

### 2. Separate Database per Tenant

Each tenant gets its own PostgreSQL database (`tenant_123_db`).

**Rejected:**

- Connection pool per tenant (100+ tenants = 100+ pools = memory exhaustion)
- Cross-tenant queries impossible (Root dashboard needs global view)
- Migration complexity (run migrations on 100+ databases)
- Backup/restore complexity
- Horizontal scaling of DB connections doesn't work

### 3. Separate Schema per Tenant

Each tenant gets a PostgreSQL schema (`SET search_path = tenant_123`).

**Rejected:**

- Same migration complexity as separate databases
- Schema drift risk (one tenant's migration fails = inconsistent state)
- Connection pooling complications (search_path must be set per query)
- PostgreSQL `pg_dump` doesn't handle 100+ schemas well

### 4. ORM-Level Tenant Filtering (e.g., Prisma, TypeORM)

Use ORM middleware/scopes to automatically add `WHERE tenant_id = ?`.

**Rejected:**

- Still application-level — ORM bugs or raw queries bypass it
- No database-level enforcement
- Adds ORM dependency (Assixx uses raw `pg` by design)
- False sense of security — developers assume ORM handles it

---

## Consequences

### Positive

1. **Impossible to bypass from application code** — even if a service forgets `WHERE tenant_id = ?`, RLS filters automatically
2. **Defense in depth** — 3 independent layers (CLS, set_config, RLS policies)
3. **Zero code changes needed** for tenant filtering — `SELECT * FROM users` automatically filtered
4. **Root users work seamlessly** — when `app.tenant_id` is not set, policies allow all rows
5. **Consistent pattern** — same `tenant_isolation` policy on all 79 tables
6. **FORCE ROW LEVEL SECURITY** — even table owners can't bypass (prevents privilege escalation)
7. **Transaction-scoped context** — `is_local=true` auto-clears on COMMIT, preventing context leakage between requests
8. **Partition inheritance** — RLS on parent tables protects all partitions automatically
9. **Audit-friendly** — policies are visible in `pg_policies` system catalog

### Negative

1. **Performance overhead** — each query checks `current_setting()`, but PostgreSQL optimizes this to near-zero cost (GUC lookup is O(1))
2. **Debugging complexity** — when data "disappears", must check if RLS context is set correctly
3. **Migration discipline** — every new tenant-scoped table MUST include RLS setup (checklist in ADR-014)
4. **EXISTS subqueries** — participant isolation policies use EXISTS, adding minor overhead on chat tables
5. **Dual-user management** — must maintain GRANTs for both `app_user` and `assixx_user`

### Risks & Mitigations

| Risk                               | Mitigation                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| New table without RLS              | Migration checklist (ADR-014) enforces RLS for all tenant-scoped tables                   |
| Context leakage between requests   | `is_local=true` + connection pool release + CLS request isolation                         |
| Root user accidental data exposure | Root user has no `app.tenant_id` set → sees all data by design (this is correct behavior) |
| Performance degradation            | `pg_stat_statements` monitoring (ADR-009), index on `tenant_id` column                    |

---

## Verification

### How to verify RLS is working

```bash
# 1. As app_user WITH tenant context — sees only tenant 1 data
docker exec assixx-postgres psql -U app_user -d assixx -c "
  SET app.tenant_id = '1';
  SELECT COUNT(*) AS tenant_1_users FROM users;
"

# 2. As app_user WITHOUT tenant context — sees all data (Root mode)
docker exec assixx-postgres psql -U app_user -d assixx -c "
  SELECT COUNT(*) AS all_users FROM users;
"

# 3. Cross-tenant test — tenant 1 user cannot see tenant 2 data
docker exec assixx-postgres psql -U app_user -d assixx -c "
  SET app.tenant_id = '1';
  SELECT COUNT(*) FROM users WHERE tenant_id = 2;
  -- Result: 0 rows (even though tenant 2 has users)
"

# 4. Policy inventory
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
  SELECT tablename, policyname, cmd FROM pg_policies
  WHERE schemaname = 'public' ORDER BY tablename;
"
```

### How to add RLS to a new table

```sql
-- MANDATORY for every new tenant-scoped table (see ADR-014)
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE new_table FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON new_table
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

-- GRANTs for app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON new_table TO app_user;
GRANT USAGE, SELECT ON SEQUENCE new_table_id_seq TO app_user;
```

---

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — JWT Guard, DB lookup per request
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) — ClsService for request-scoped context
- [ADR-009: Central Audit Logging](./ADR-009-user-role-assignment-permissions.md) — Audit trail with partitioning
- [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md) — Migration checklist includes RLS
- [DATABASE-MIGRATION-GUIDE.md](../../DATABASE-MIGRATION-GUIDE.md) — RLS policy template, NULLIF pattern
- [set_config() Documentation](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-SET) — GUC variable management
