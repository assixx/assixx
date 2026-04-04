# RLS Strict Mode — Masterplan

> **Status:** ✅ COMPLETE
> **Branch:** feat/swaprequest (combined with current work)
> **ADR:** ADR-019 (updated)
> **Created:** 2026-04-04

---

## Goal

Remove the RLS bypass clause so PostgreSQL blocks ALL queries without tenant context — even `db.query()` calls. Introduce `sys_user` (BYPASSRLS) for cron/auth/root operations.

---

## Architecture (Before → After)

### Before (current)

```
app_user → db.query() → no set_config → RLS bypass clause: allow all → BROKEN defense-in-depth
```

### After (target)

```
app_user   → db.query()             → strict RLS → BLOCKS (no tenant context)
app_user   → tenantTransaction()    → set_config → strict RLS → filters by tenant ✅
sys_user → systemQuery()         → BYPASSRLS → sees all data ✅
```

---

## Steps

### Phase 1: Infrastructure

- [x] **1.1** ✅ DONE Docker init: `docker/postgres-init/003_create_sys_user.sql`
- [x] **1.2** ✅ DONE Docker-compose: Add `DB_SYSTEM_USER`, `DB_SYSTEM_PASSWORD` env vars
- [x] **1.3** ✅ DONE Customer install: `000_sys_user.sql` + update `install.sh` + `004_grants.sql`
- [x] **1.4** ✅ DONE Doppler secrets: `DB_SYSTEM_USER=sys_user`, `DB_SYSTEM_PASSWORD` set
- [x] **1.5** ✅ DONE sys_user created in running DB + Docker restarted with new env vars
  - `docker exec assixx-postgres psql -U assixx_user -d assixx -f /docker-entrypoint-initdb.d/003_create_sys_user.sql`

### Phase 2: Backend Code

- [x] **2.1** ✅ DONE `database.constants.ts`: Add `SYSTEM_POOL` token
- [x] **2.2** ✅ DONE `database.module.ts`: Create second pool with sys_user credentials (max 5 connections)
- [x] **2.3** ✅ DONE `database.service.ts`: Add `systemQuery()`, `systemQueryOne()`, `systemTransaction()`
- [x] **2.4** ✅ DONE `database.service.test.ts`: 7 tests added (systemQuery, systemQueryOne, systemTransaction, closePool both pools)
- [x] **2.5** ✅ DONE `database.service.ts`: Add `tenantQuery()`, `tenantQueryOne()` + 5 tests (throw without CLS, RLS context, pool isolation, queryOne)
- [x] **2.6** ✅ DONE Migrate 16 cross-tenant services + 12 test files → `systemQuery()` (6223/6223 tests pass):

| #   | Service                          | File                                        | Methods to change                       |
| --- | -------------------------------- | ------------------------------------------- | --------------------------------------- |
| 1   | TpmDueDateCronService            | tpm/tpm-due-date-cron.service.ts            | findDueCardGroups()                     |
| 2   | TpmEscalationService             | tpm/tpm-escalation.service.ts               | findOverdueCandidates()                 |
| 3   | KvpApprovalArchiveCronService    | kvp/kvp-approval-archive-cron.service.ts    | archiveFinalKvps()                      |
| 4   | ScheduledMessageProcessorService | chat/scheduled-message-processor.service.ts | cross-tenant reads                      |
| 5   | BlackboardArchiveService         | blackboard/blackboard-archive.service.ts    | archiveExpiredEntries()                 |
| 6   | WorkOrderDueCronService          | work-orders/work-orders-due-cron.service.ts | processDueSoon()                        |
| 7   | LogRetentionService              | logs/log-retention.service.ts               | PG_POOL → SYSTEM_POOL                   |
| 8   | UnifiedLogsService               | logs/unified-logs.service.ts                | PG_POOL → SYSTEM_POOL                   |
| 9   | AuthService                      | auth/auth.service.ts                        | ALL db queries → systemQuery (pre-auth) |
| 10  | SignupService                    | signup/signup.service.ts                    | ALL db queries → systemQuery (pre-auth) |
| 11  | RootAdminService                 | root/root-admin.service.ts                  | ALL db queries → systemQuery (root)     |
| 12  | RootTenantService                | root/root-tenant.service.ts                 | ALL db queries → systemQuery (root)     |
| 13  | RootService                      | root/root.service.ts                        | ALL db queries → systemQuery (root)     |
| 14  | AddonsService                    | addons/addons.service.ts                    | global addon queries → systemQuery      |

- [x] **2.7** ✅ DONE Migrate ALL tenant-scoped services → `tenantQuery()`/`tenantQueryOne()` (192 calls, 62 service files, 60 test files, 6223/6223 tests pass):
  - Grep ALL `this.db.query(` / `this.db.queryOne(` / `this.databaseService.query(` in backend/src/nest/
  - Exclude: cross-tenant (step 2.6), global table queries, client.query inside transactions
  - Convert remaining to `tenantQuery`/`tenantQueryOne`
  - ~200 call sites in ~50 service files

- [x] **2.8** ✅ DONE Fix TenantDeletion services → systemQuery/systemTransaction (3 services + 3 test files):

| #   | Service                | File                                                | Fix                                                                                     |
| --- | ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | TenantDeletionService  | tenant-deletion/tenant-deletion.service.ts          | `db.transaction(cb)` → `db.transaction(cb, {tenantId})`, `processQueue()` → systemQuery |
| 2   | TenantDeletionAudit    | tenant-deletion/tenant-deletion-audit.service.ts    | `db.transaction(cb)` → `db.transaction(cb, {tenantId})`                                 |
| 3   | TenantDeletionAnalyzer | tenant-deletion/tenant-deletion-analyzer.service.ts | `db.transaction(cb)` → `db.transaction(cb, {tenantId})`                                 |

- [x] **2.9** ✅ DONE Fix WebSocket — `queryAsTenant()` method + 11 queries migrated:

| #   | File                         | Fix                                                                      |
| --- | ---------------------------- | ------------------------------------------------------------------------ |
| 1   | websocket.ts                 | `db.query()` → `db.transaction({tenantId: ws.tenantId})` for user lookup |
| 2   | websocket-message-handler.ts | All `db.query()` → `db.transaction({tenantId})` (~10 queries)            |

### Phase 3: Migration

- [x] **3.1** ✅ DONE Generate migration: `20260404213545268_rls-strict-mode.ts`
- [x] **3.2** ✅ DONE Implement up(): sys_user GRANTs + 124 strict policies + documents RESTRICTIVE
- [x] **3.3** ✅ DONE Implement down(): full rollback with bypass clause restoration
- [x] **3.4** ✅ DONE Backup + Dry Run + Execute + Verify (0 rows without context, 288 with context, 296 via sys_user)

### Phase 4: Verification

- [x] **4.1** ✅ DONE Type-check (0 errors) + Lint (0 errors)
- [x] **4.2** ✅ DONE Unit tests: 6223/6223 pass, 243/243 files
- [x] **4.3** ✅ DONE RLS verification: app_user=0 rows, app_user+context=288, sys_user=296
- [x] **4.4** ✅ DONE Cron jobs: no errors in logs (use sys_user pool)
- [x] **4.5** ✅ DONE Login works: token + /users/me returns user data
- [x] **4.6** ✅ DONE Fixed JwtAuthGuard → queryAsTenant, AuditLogging → queryAsTenant, ActivityLogger → queryAsTenant, ReadTracking → queryAsTenant
- [x] **4.7** ✅ DONE ADR-019 updated: Query API table (9 methods), decision tree for new code

---

## Critical Notes (from double-check)

### `documents` table — Policy bypass risk

The `documents` table has 2 PERMISSIVE policies (ORed). After strict mode, `chat_participant_isolation` would allow ALL non-chat documents without tenant context. Fix: change to RESTRICTIVE (ANDed).

### `chat_conversations` — 4 PERMISSIVE policies

Safe: `insert` has no bypass (WITH CHECK true), `select`/`update`/`delete` each have their own tenant_isolation check. After strict mode, all 3 will block without context. INSERT allows creating without context — acceptable (application logic controls this).

### WebSocket — uses shared app_user pool

All queries use `db.query()` without RLS context. Must wrap in `db.transaction({tenantId})` since WebSocket is authenticated and has `ws.tenantId`. Using system pool would be LESS secure — RLS should protect chat data.

### Deletion Worker — separate process, own pool

Uses same `DatabaseModule` (app_user). Must pass `tenantId` to transaction for RLS context. `processQueue()` needs systemQuery for cross-tenant read.

---

## Definition of Done

- [ ] `app_user` queries WITHOUT `set_config` return 0 rows on tenant tables
- [ ] `sys_user` queries see all data (BYPASSRLS)
- [ ] All cron jobs, auth, signup, root operations work via system pool
- [ ] All authenticated endpoints work via regular pool + tenantTransaction
- [ ] WebSocket chat works with tenant transactions
- [ ] Tenant deletion works with explicit tenantId in transactions
- [ ] `documents` chat_participant_isolation is RESTRICTIVE
- [ ] Zero ESLint/TypeScript errors
- [ ] All unit tests pass
- [ ] ADR-019 updated
