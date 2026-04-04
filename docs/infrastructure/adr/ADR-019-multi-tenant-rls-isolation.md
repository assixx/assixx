# ADR-019: Multi-Tenant Data Isolation via PostgreSQL Row Level Security

| Metadata                | Value                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                     |
| **Date**                | 2026-02-07 (updated: 2026-04-04)                                             |
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

### 1. Database Users (Triple-User Model)

| User          | Purpose                          | RLS Applied?       | DDL Rights |
| ------------- | -------------------------------- | ------------------ | ---------- |
| `app_user`    | Authenticated request queries    | **Yes** (strict)   | No         |
| `sys_user`    | Cron, auth, signup, root, delete | **No** (BYPASSRLS) | No         |
| `assixx_user` | Migrations, admin scripts        | **No** (BYPASSRLS) | Yes        |

**`app_user`** — Used for all authenticated tenant-scoped operations via `tenantTransaction()`. RLS is strict: queries without `set_config('app.tenant_id')` return **0 rows**.

**`sys_user`** (BYPASSRLS, no DDL) — Used exclusively for cross-tenant operations:

- Cron jobs (cross-tenant aggregation queries)
- Auth service (login: user lookup before tenant context exists)
- Signup service (tenant creation)
- Root admin (cross-tenant management)
- Tenant deletion (cleanup across all tables)

**`assixx_user`** (BYPASSRLS + DDL) — Used only for:

- Database migrations (`node-pg-migrate`)
- Admin scripts via `psql`
- Seed data operations

### 2. Standard RLS Policy — Strict Mode (110 of 117 tables)

```sql
CREATE POLICY tenant_isolation ON table_name
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );
```

**Strict mode behavior:**

- When `app.tenant_id` is set → filters rows by tenant ✅
- When `app.tenant_id` is NOT set → `NULLIF` returns NULL → `tenant_id = NULL` is never true → **0 rows returned** ✅
- Cross-tenant operations use `sys_user` (BYPASSRLS) which ignores all policies

**Why `NULLIF(current_setting(...), '')`?**

PostgreSQL `set_config()` with `is_local=true` resets to empty string `''` (not `NULL`) after `COMMIT`. `NULLIF('', '')` converts `''` → `NULL`, ensuring the comparison correctly blocks access.

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

  if (tenantId === undefined) {
    throw new Error('tenantTransaction called without tenantId in CLS context');
  }

  return await this.transaction(callback, { tenantId, userId });
}
```

**Key design decisions:**

- `set_config(..., true)` → `is_local=true` = transaction-scoped (auto-cleared on COMMIT/ROLLBACK)
- Uses `SELECT set_config()` instead of `SET` because `SET` doesn't support parameterized queries (SQL injection risk)
- `tenantId` and `userId` read from CLS (ADR-006), not from request parameters (prevents tampering)

### 6b. DatabaseService Query API

Every DB call MUST use the correct method. Using the wrong method is a security bug.

| Method                                 | Pool     | RLS             | CLS needed? | Use case                                                              |
| -------------------------------------- | -------- | --------------- | ----------- | --------------------------------------------------------------------- |
| `query()`                              | app_user | Strict (blocks) | No          | **Global tables only** (addons, system_settings, pg catalog)          |
| `tenantQuery()`                        | app_user | Yes (via CLS)   | **Yes**     | Authenticated tenant-scoped reads/writes                              |
| `tenantQueryOne()`                     | app_user | Yes (via CLS)   | **Yes**     | Same, returns first row or null                                       |
| `queryAsTenant(sql, params, tenantId)` | app_user | Yes (explicit)  | No          | WebSocket, JwtAuthGuard, logging services (explicit tenantId, no CLS) |
| `tenantTransaction()`                  | app_user | Yes (via CLS)   | **Yes**     | Multi-statement tenant operations                                     |
| `transaction(cb, {tenantId})`          | app_user | Yes (explicit)  | No          | Multi-statement with explicit tenantId                                |
| `systemQuery()`                        | sys_user | **Bypass**      | No          | Cron jobs, auth login, signup, root admin, tenant deletion            |
| `systemQueryOne()`                     | sys_user | **Bypass**      | No          | Same, returns first row or null                                       |
| `systemTransaction()`                  | sys_user | **Bypass**      | No          | Cross-tenant transactions                                             |

**Decision tree for new code:**

```
Is it a global table (addons, system_settings, pg catalog)?
  → query()

Is it a cron job, auth login, signup, root admin, or tenant deletion?
  → systemQuery() / systemTransaction()

Is it inside an HTTP request handler (CLS has tenantId)?
  → tenantQuery() / tenantTransaction()

Is it WebSocket, a guard, or a service with explicit tenantId param but no CLS?
  → queryAsTenant(sql, params, tenantId)

Is it inside a transaction callback (client.query)?
  → client.query() directly (RLS context already set by parent transaction)
```

### 7. Global Tables (No RLS)

17 tables contain system-wide configuration data shared across all tenants:

| Table                            | Reason                                            |
| -------------------------------- | ------------------------------------------------- |
| `addons`                         | Addon catalog (system-defined, seeds)             |
| `archived_tenant_invoices`       | Billing archive (cross-tenant by design)          |
| `asset_categories`               | Default asset categories (seeds)                  |
| `blackboard_entry_organizations` | Junction table (FK-based isolation via parent)    |
| `calendar_events_organizations`  | Junction table (FK-based isolation via parent)    |
| `deletion_alerts`                | System-level deletion monitoring                  |
| `deletion_partial_options`       | System-level deletion configuration               |
| `document_shares`                | Share links (validated via parent document's RLS) |
| `failed_file_deletions`          | System-level cleanup queue                        |
| `kvp_attachments`                | Junction table (FK-based isolation via parent)    |
| `kvp_categories`                 | Default KVP categories (seeds)                    |
| `kvp_ratings`                    | Junction table (FK-based isolation via parent)    |
| `kvp_status_history`             | Junction table (FK-based isolation via parent)    |
| `password_reset_tokens`          | Stateless, short-lived tokens                     |
| `pgmigrations`                   | Migration tracking (node-pg-migrate)              |
| `system_settings`                | Global system configuration                       |
| `user_sessions`                  | JWT sessions (validated by signature)             |

These tables have **no `tenant_id` column** and **no RLS**.

### 8. GRANT Exceptions

| Table                | GRANTs for `app_user` | Reason                                                             |
| -------------------- | --------------------- | ------------------------------------------------------------------ |
| `tpm_plan_revisions` | SELECT, INSERT only   | Append-only revision history — UPDATE/DELETE intentionally revoked |

All other tables have the full `SELECT, INSERT, UPDATE, DELETE` grant set.

### 9. Partitioned Tables

`audit_trail` and `root_logs` use monthly partitioning (ADR-009). The **parent table** has RLS enabled. Partitions (`audit_trail_2026_01`, etc.) inherit the parent's RLS policies automatically — they do not need their own.

**192 partition tables** show `rowsecurity = false` in `pg_tables` but are protected via their parent's policy.

---

## Table Coverage Summary

| Category                         | Count   | RLS              | Notes                                  |
| -------------------------------- | ------- | ---------------- | -------------------------------------- |
| Tenant-scoped tables             | 117     | Enabled + Forced | 124 policies total                     |
| Global tables (no tenant_id)     | 17      | Not needed       | System config, seeds, junction tables  |
| Partitions (inherit from parent) | 192     | Inherited        | audit_trail, root_logs (monthly)       |
| Partition defaults               | 2       | Inherited        | audit_trail_default, root_logs_default |
| Tables with RLS but no policy    | **0**   | —                | Clean!                                 |
| **Total**                        | **330** | —                | 138 base + 192 partitions              |

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

1. **Impossible to bypass from application code** — even if a service forgets `WHERE tenant_id = ?`, RLS blocks access without tenant context (strict mode)
2. **Defense in depth** — 3 independent layers (CLS, set_config, RLS policies)
3. **Zero code changes needed** for tenant filtering — `SELECT * FROM users` automatically filtered within `tenantTransaction()`
4. **Strict isolation by default** — queries without `set_config` return 0 rows (no silent bypass)
5. **Triple-user model** — `app_user` (strict RLS), `sys_user` (BYPASSRLS, no DDL), `assixx_user` (DDL + BYPASSRLS)
6. **Consistent pattern** — same `tenant_isolation` policy on all 117 tables
7. **FORCE ROW LEVEL SECURITY** — even table owners can't bypass (prevents privilege escalation)
8. **Transaction-scoped context** — `is_local=true` auto-clears on COMMIT, preventing context leakage between requests
9. **Partition inheritance** — RLS on parent tables protects all partitions automatically
10. **Audit-friendly** — policies are visible in `pg_policies` system catalog

### Negative

1. **Performance overhead** — each query checks `current_setting()`, but PostgreSQL optimizes this to near-zero cost (GUC lookup is O(1))
2. **Debugging complexity** — when data "disappears", must check if RLS context is set correctly
3. **Migration discipline** — every new tenant-scoped table MUST include RLS setup (checklist in ADR-014)
4. **EXISTS subqueries** — participant isolation policies use EXISTS, adding minor overhead on chat tables
5. **Triple-user management** — must maintain GRANTs for `app_user`, `sys_user`, and `assixx_user`
6. **System pool awareness** — developers must choose the correct pool (regular vs system) for new services

### Risks & Mitigations

| Risk                               | Mitigation                                                                |
| ---------------------------------- | ------------------------------------------------------------------------- |
| New table without RLS              | Migration checklist (ADR-014) enforces RLS for all tenant-scoped tables   |
| Context leakage between requests   | `is_local=true` + connection pool release + CLS request isolation         |
| Forgotten `set_config` blocks data | Strict RLS returns 0 rows → visible bug, not silent data leak (fail-safe) |
| `sys_user` misuse                  | `systemQuery()` clearly named, code review catches inappropriate use      |
| Performance degradation            | `pg_stat_statements` monitoring (ADR-009), index on `tenant_id` column    |

---

## Verification

### How to verify RLS is working

```bash
# 1. As app_user WITH tenant context — sees only tenant 1 data
docker exec assixx-postgres psql -U app_user -d assixx -c "
  SET app.tenant_id = '1';
  SELECT COUNT(*) AS tenant_1_users FROM users;
"

# 2. As app_user WITHOUT tenant context — STRICT: returns 0 rows
docker exec assixx-postgres psql -U app_user -d assixx -c "
  SELECT COUNT(*) AS blocked_users FROM users;
  -- Result: 0 (strict mode blocks all rows without tenant context)
"

# 3. As sys_user WITHOUT tenant context — BYPASSRLS: sees all data
docker exec assixx-postgres psql -U sys_user -d assixx -c "
  SELECT COUNT(*) AS all_users FROM users;
  -- Result: all users across all tenants
"

# 4. Cross-tenant test — tenant 1 user cannot see tenant 2 data
docker exec assixx-postgres psql -U app_user -d assixx -c "
  SET app.tenant_id = '1';
  SELECT COUNT(*) FROM users WHERE tenant_id = 2;
  -- Result: 0 rows (even though tenant 2 has users)
"

# 5. Policy inventory
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
