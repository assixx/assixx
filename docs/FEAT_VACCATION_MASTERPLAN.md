# FEAT: Vacation Request System — Execution Masterplan

> **Created:** 2026-02-12
> **Status:** ACTIVE — Phase 1 COMPLETE, Phase 2 COMPLETE, Phase 3 COMPLETE, Phase 4 COMPLETE, Phase 5 COMPLETE (Session 19 done)
> **Branch:** `feat/vaccation-request`
> **Spec:** [prompt_vacation.md](./prompt_vacation.md)
> **Context:** [brainstorming_vacation.md](./brainstorming_vacation.md)
> **Author:** Claude (Senior Engineer)

---

## 0. Prerequisites & Risk Assessment

### Must Be True Before Starting

- [x] Docker stack running (`assixx-postgres`, `assixx-backend` healthy)
- [x] DB backup taken before any migration (full_backup_20260212_123139.dump, 1.9MB)
- [x] Branch `feat/vaccation-request` checked out (confirmed)
- [x] No pending migrations in queue (`pgmigrations` table current at migration 26)

### Risk Register

| #   | Risk                                                               | Impact                                      | Mitigation                                                           |
| --- | ------------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------- |
| R1  | `user_teams` has users in multiple teams — UNIQUE constraint fails | Migration 27 blocked                        | Pre-check query in migration, RAISE EXCEPTION with message           |
| R2  | `employee_availability` rename breaks running backend              | 500 errors on all availability endpoints    | Deploy Migration 30 + backend code changes atomically (same session) |
| R3  | `absences` table has data — DROP loses it                          | Data loss                                   | Migration 31 checks for data, RAISE NOTICE, manual review required   |
| R4  | Cross-year day splitting edge cases                                | Wrong balance calculation                   | Comprehensive unit tests (>= 5 cross-year scenarios)                 |
| R5  | Self-approval loop (team_lead is approver of themselves)           | Infinite loop or unauthorized self-approval | Explicit check: `team_lead_id === userId` → escalate to area_lead    |
| R6  | Race condition on concurrent approve/deny                          | Double-approve or inconsistent state        | `FOR UPDATE` lock on `vacation_requests` row before status change    |

### Ecosystem Integration Points

| System                                                               | Integration                                                 | Phase                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------- |
| `user_availability` (renamed from `employee_availability`)           | Approved vacation → INSERT availability record              | Phase 2 (Backend)     |
| `audit_trail` (partitioned)                                          | Every status change → audit entry                           | Phase 2 (Backend)     |
| EventBus (`backend/src/utils/eventBus.ts`)                           | 4 new typed emit methods                                    | Phase 2 (Backend)     |
| SSE Handlers (`notifications.controller.ts` `registerSSEHandlers()`) | 4 new event handlers in `canAccess('vacation')` block       | Phase 2 (Backend)     |
| Permission Registry (ADR-020, `PermissionRegistryService`)           | `VacationPermissionRegistrar` via `OnModuleInit`            | Phase 2 (Backend)     |
| Feature Check (`FeatureCheckService.checkTenantAccess()`)            | Every controller method checks `'vacation'` feature         | Phase 2 (Backend)     |
| Calendar (frontend merge)                                            | Approved vacations shown in calendar view                   | Phase 5 (Integration) |
| Shift Planning                                                       | Warning notification when approved vacation overlaps shifts | Phase 5 (Integration) |

---

## Phase 1: Database Migrations

> **Dependency:** None (first phase)
> **Files affected:** 6 new migration files + 12 backend/frontend files (SQL + comments + tests + DTOs)
> **Last migration:** `20260211000026_e2e-key-escrow.ts` → next is `000027`

### Step 1.1: Feature Flag + Teams Extension [DONE - Session 1, 2026-02-12]

**New files:**

- `database/migrations/20260212000027_vacation-feature-flag.ts` [CREATED + APPLIED]
- `database/migrations/20260212000028_teams-deputy-lead.ts` [CREATED + APPLIED]

**What happens:**

1. INSERT `vacation` feature into `features` table (category=`basic`, price=0.00, sort_order=50)
2. ADD COLUMN `deputy_lead_id INTEGER REFERENCES users(id)` on `teams`
3. CREATE UNIQUE INDEX `idx_ut_one_team_per_user ON user_teams(user_id)` — enforces Business Rule A1 (1 team per employee)
4. Pre-check: DO $$ block verifies no user is in multiple teams, RAISE EXCEPTION if violated

**Reference patterns:**

- Migration format: `database/migrations/20260211000026_e2e-key-escrow.ts`
- node-pg-migrate: `export function up(pgm: MigrationBuilder): void { pgm.sql(\`...\`); }`
- Every migration needs `up()` AND `down()` (ADR-014)

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT code, name FROM addons WHERE code = 'vacation';"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d teams" | grep deputy_lead
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d user_teams" | grep idx_ut_one_team
```

### Step 1.2: Core Vacation Tables (7 tables) [DONE - Session 2, 2026-02-12]

**New file:**

- `database/migrations/20260212000029_vacation-core-tables.ts` [CREATED + APPLIED]

**Creates:**

1. 3 ENUM types: `vacation_request_status`, `vacation_type`, `vacation_half_day`
2. `vacation_holidays` — tenant holidays (UUID PK, RLS, UNIQUE tenant_id+holiday_date)
3. `vacation_entitlements` — per-user per-year entitlement (UUID PK, RLS, UNIQUE tenant_id+user_id+year)
4. `vacation_requests` — the core requests table (UUID PK, RLS, 5 constraints)
5. `vacation_request_status_log` — audit per request (UUID PK, RLS)
6. `vacation_blackouts` — blackout periods (UUID PK, RLS, `is_global` + junction table `vacation_blackout_scopes`)
7. `vacation_staffing_rules` — min staffing per asset (UUID PK, RLS, UNIQUE tenant_id+asset_id)
8. `vacation_settings` — tenant-wide config (UUID PK, RLS, UNIQUE tenant_id)

**For EVERY table (mandatory checklist):**

- [x] `id UUID PRIMARY KEY` (application-generated UUIDv7)
- [x] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [x] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [x] RLS policy with `NULLIF(current_setting('app.tenant_id', true), '') IS NULL` pattern
- [x] `GRANT SELECT, INSERT, UPDATE, DELETE ON table TO app_user`
  - **EXCEPTION:** `vacation_request_status_log` → `GRANT SELECT, INSERT` only (append-only audit table, no UPDATE/DELETE) [VERIFIED]
- [x] NO sequence GRANTs needed (UUID PK, not SERIAL)
- [x] Appropriate indexes with `WHERE is_active = 1` partial indexes
- [x] `is_active INTEGER NOT NULL DEFAULT 1` (except `vacation_request_status_log` which has no `is_active`)

**ENUM down() warning:** Migration 29 creates 3 ENUMs. PostgreSQL cannot remove individual ENUM values. The `down()` migration MUST `DROP TABLE ... CASCADE` for ALL 7 tables FIRST, then `DROP TYPE` for all 3 ENUMs. Order matters.

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt vacation_*"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'vacation_%';"
```

### Step 1.3: Availability Rebuild [DONE - Session 3, 2026-02-12]

**New file:**

- `database/migrations/20260212000030_availability-rebuild.ts` [CREATED + APPLIED]

**CRITICAL — Atomic deployment with backend changes:** (completed successfully)

**DB changes (up):**

1. `ALTER TYPE employee_availability_status RENAME TO user_availability_status`
2. `ALTER TABLE employee_availability RENAME TO user_availability`
3. `ALTER SEQUENCE employee_availability_id_seq RENAME TO user_availability_id_seq`
4. `ALTER TABLE user_availability RENAME COLUMN employee_id TO user_id`
5. DROP old indexes (`idx_19227_*`), CREATE new indexes (`idx_ua_*`)
6. DROP + recreate RLS policy on `user_availability`
7. RENAME FK constraints (`fk_availability_*` → `fk_ua_*`)
8. Recreate trigger function with new name
9. GRANT permissions to `app_user`

**Backend files to modify (SAME SESSION):**

- `backend/src/nest/users/user-availability.service.ts` — 12 SQL occurrences of `employee_availability` → `user_availability`, 8 SQL occurrences of `employee_id` → `user_id`
- `backend/src/nest/teams/teams.service.ts` — 2 occurrences: `LEFT JOIN employee_availability ea ON u.id = ea.employee_id` → `LEFT JOIN user_availability ea ON u.id = ea.user_id`
- `backend/src/nest/users/users.service.ts` — 3 comment references to `employee_availability` → `user_availability`
- `backend/src/nest/users/users.helpers.ts` — 2 comment references
- `backend/src/nest/users/users.types.ts` — 1 comment reference
- `backend/src/nest/users/dto/update-availability.dto.ts` — 1 comment reference
- `backend/src/nest/users/user-availability.service.test.ts` — **CRITICAL:** test data uses `employee_id` field names and assertions check for `employee_id` in SQL strings → must update to `user_id` / `user_availability`
- `backend/src/nest/users/dto/availability-history-query.dto.ts` — **FOUND DURING IMPL:** `AvailabilityHistoryEntry` interface had `employeeId` → `userId`
- `frontend/src/routes/(app)/(admin)/manage-employees/availability/[uuid]/+page.server.ts` — **FOUND DURING IMPL:** `AvailabilityEntry` interface `employeeId` → `userId`
- `frontend/src/routes/(app)/(admin)/manage-employees/availability/[uuid]/+page.svelte` — **FOUND DURING IMPL:** same
- `frontend/src/routes/(app)/(admin)/manage-employees/availability/_lib/EditAvailabilityModal.svelte` — **FOUND DURING IMPL:** same
- `frontend/src/routes/(app)/(admin)/manage-employees/availability/_lib/DeleteConfirmationModal.svelte` — **FOUND DURING IMPL:** same

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt user_availability"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt employee_availability"  # Should not exist
```

### Step 1.4: Legacy Cleanup [DONE - Session 4, 2026-02-12]

**New file:**

- `database/migrations/20260212000031_vacation-legacy-cleanup.ts` [CREATED + APPLIED]

**What happens:**

1. Check if `absences` table has data → RAISE NOTICE if yes (manual review needed)
2. `DROP TABLE IF EXISTS absences CASCADE`
3. `DROP TYPE IF EXISTS absences_type CASCADE`
4. `DROP TYPE IF EXISTS absences_status CASCADE`

### Step 1.5: Blackout Multi-Scope Migration [DONE - Session 21, 2026-02-13]

**New file:**

- `database/migrations/20260213000032_blackout-multi-scope.ts` [CREATED + APPLIED]

**What happens:**

1. CREATE ENUM `vacation_blackout_org_type` ('department', 'team', 'area')
2. ADD COLUMN `is_global BOOLEAN NOT NULL DEFAULT false` to `vacation_blackouts`
3. CREATE TABLE `vacation_blackout_scopes` (junction table with RLS + GRANTs)
4. Migrate existing data: `scope_type='global'` → `is_global=true`, team/dept → junction rows
5. DROP old columns `scope_type`, `scope_id` + CHECK constraint `valid_scope`
6. Replace `idx_vb_scope` with `idx_vb_global`

**Why:** The blackouts service code (Session 8) was written for multi-scope model (is_global + junction table), but migration 29 only created the simple scope_type/scope_id columns. This migration bridges that gap.

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d vacation_blackouts" | grep is_global
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d vacation_blackout_scopes"
```

### Phase 1 Definition of Done [ALL COMPLETE - 2026-02-13]

- [x] 6 migration files created with `up()` AND `down()`
- [x] All migrations pass dry-run: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [x] All migrations applied successfully
- [x] 7 new `vacation_*` tables exist with RLS policies (7/7 verified)
- [x] `teams.deputy_lead_id` column exists
- [x] `user_teams` has UNIQUE(user_id) constraint (`idx_ut_one_team_per_user`)
- [x] `user_availability` table exists (NOT `employee_availability`)
- [x] `absences` table dropped
- [x] Backend compiles with zero errors after availability rename (`tsc --noEmit` clean)
- [x] Existing availability tests pass after rename: 24/24 passed + 164 users + 48 teams
- [x] All 6 migration files applied (pgmigrations IDs 32-39, gap from rollback cycle)
- [x] Backup taken before (full_backup_20260212_123139.dump, 1.9MB)

---

## Phase 2: Backend Module

> **Dependency:** Phase 1 complete
> **Reference module:** `backend/src/nest/shifts/` (file structure, permission registrar, controller patterns)

### Step 2.1: Module Skeleton + Types + DTOs [DONE - Session 5, 2026-02-12]

**New directory:** `backend/src/nest/vacation/` [CREATED]

**New files (all created + ESLint 0 errors + type-check 0 errors):**

```
backend/src/nest/vacation/
    vacation.module.ts                    # NestJS module (skeleton with registrar)       [CREATED]
    vacation.types.ts                     # 26 interfaces + DB row types                  [CREATED]
    vacation.permissions.ts               # VACATION_PERMISSIONS with 5 modules (ADR-020) [CREATED]
    vacation-permission.registrar.ts      # OnModuleInit registrar                        [CREATED]
    dto/
        common.dto.ts                     # 11 reusable Zod schemas                      [CREATED]
        index.ts                          # Barrel export                                [CREATED]
        create-vacation-request.dto.ts    # With date range + half-day refinements        [CREATED]
        update-vacation-request.dto.ts    # Partial update with date validation           [CREATED]
        respond-vacation-request.dto.ts   # Approve/deny + mandatory reason on deny       [CREATED]
        create-blackout.dto.ts            # With scope validation refinement              [CREATED]
        update-blackout.dto.ts            # Partial update                               [CREATED]
        create-staffing-rule.dto.ts       # Machine + min staff                          [CREATED]
        update-staffing-rule.dto.ts       # Min staff update                             [CREATED]
        create-holiday.dto.ts             # Date + name + recurring                      [CREATED]
        update-holiday.dto.ts             # Partial update                               [CREATED]
        create-entitlement.dto.ts         # User + year + days                           [CREATED]
        update-entitlement.dto.ts         # Days update                                  [CREATED]
        vacation-query.dto.ts             # Pagination + filters (page, limit, year, status) [CREATED]
        capacity-query.dto.ts             # startDate, endDate, requesterId?             [CREATED]
        update-settings.dto.ts            # Tenant settings                              [CREATED]
```

**Registration in app.module.ts:** [DONE]

- [x] `VacationModule` added to imports array (alphabetically after `UsersModule`)
- [x] Import from `./vacation/vacation.module.js`

**Permission definition pattern** (from `shifts.permissions.ts`):

> **SPEC DEVIATION:** The spec (`prompt_vacation.md` Section 2.12) uses `addonCode` and `{ code, name }` for modules. This is WRONG — the actual `PermissionCategoryDef` interface (at `backend/src/nest/common/permission-registry/permission.types.ts`) uses `code`, `label`, `icon`, and `modules[]` with `allowedPermissions`. The correct import is `from '../common/permission-registry/permission.types.js'` (NOT `from '../admin-permissions/permission-registry.service'` as the spec says). The registrar imports from `'../common/permission-registry/permission-registry.service.js'`.

```typescript
// vacation.permissions.ts
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const VACATION_PERMISSIONS: PermissionCategoryDef = {
  code: 'vacation',
  label: 'Urlaubsverwaltung',
  icon: 'fa-umbrella-beach',
  modules: [
    {
      code: 'vacation-requests',
      label: 'UrlaubsAnträge',
      icon: 'fa-file-alt',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'vacation-rules',
      label: 'Regeln & Sperren',
      icon: 'fa-ban',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'vacation-entitlements',
      label: 'Urlaubsansprüche',
      icon: 'fa-calculator',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'vacation-holidays',
      label: 'Feiertage',
      icon: 'fa-calendar-day',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'vacation-overview',
      label: 'Übersicht & Kalender',
      icon: 'fa-chart-bar',
      allowedPermissions: ['canRead'],
    },
  ],
};
```

### Step 2.2: Holidays Service

**File:** `backend/src/nest/vacation/vacation-holidays.service.ts`

**Why first:** `countWorkdays()` is the foundation — every other service depends on it.

**Methods:**

- `getHolidays(tenantId, year)` — `db.tenantTransaction()`, filter recurring by MONTH+DAY
- `createHoliday(tenantId, userId, dto)` — UUIDv7 PK, handle UNIQUE violation → `ConflictException`
- `updateHoliday(tenantId, id, dto)` — find + update
- `deleteHoliday(tenantId, id)` — soft-delete `is_active = 4`
- `isHoliday(tenantId, date)` — check recurring (MONTH+DAY match) + non-recurring (exact date)
- `countWorkdays(tenantId, startDate, endDate, halfDayStart, halfDayEnd)` — THE core algorithm:
  1. Load all holidays for date range (single query)
  2. Iterate each day start→end
  3. Skip weekends (Sat/Sun)
  4. Skip holidays
  5. First day + halfDayStart != 'none' → +0.5
  6. Last day + halfDayEnd != 'none' → +0.5
  7. Single day: only one half-day modifier allowed (DB constraint enforces)

**Critical patterns:**

- ALL queries via `db.tenantTransaction()` (ADR-019)
- Return raw data, NO `{ success, data }` wrapping (ADR-007)
- `$1, $2, $3` placeholders (PostgreSQL)
- `?? null` not `|| null` for defaults

### Step 2.3: Settings Service

**File:** `backend/src/nest/vacation/vacation-settings.service.ts`

**Why second:** Other services need settings (advance_notice_days, max_carry_over, etc.).

**Methods:**

- `getSettings(tenantId)` — SELECT + auto-create defaults if missing (`ensureDefaults`)
- `updateSettings(tenantId, userId, dto)` — UPSERT + audit_trail entry
- `ensureDefaults(tenantId)` — INSERT ON CONFLICT DO NOTHING (30 days, 10 carry-over, deadline 31.03)

### Step 2.4: Entitlements Service

**File:** `backend/src/nest/vacation/vacation-entitlements.service.ts`

**Why third:** `getBalance()` is needed by vacation service for validation.

**Methods:**

- `getEntitlement(tenantId, userId, year)`
- `getBalance(tenantId, userId, year?)` — THE critical calculation:
  - `available = total_days + effectiveCarriedOver + additional_days`
  - `effectiveCarriedOver = carried_over_days IF !expired ELSE 0`
  - `usedDays = SUM of approved requests (with cross-year splitting!)`
  - `pendingDays = SUM of pending requests`
  - `remaining = available - usedDays`
  - **Cross-year algorithm:** For each request spanning years, calculate workdays per year using `countWorkdays()` with clamped date ranges
- `createOrUpdateEntitlement(tenantId, dto)` — INSERT ON CONFLICT UPDATE
- `addDays(tenantId, userId, year, days, reason)` — UPDATE additional_days + audit_trail
- `carryOverRemainingDays(tenantId, userId, fromYear)` — calculate remaining, apply max_carry_over from settings

### Step 2.5: Blackouts Service

**File:** `backend/src/nest/vacation/vacation-blackouts.service.ts`

**Methods:**

- `getBlackouts(tenantId, year?)` — filter active, optionally by year
- `createBlackout(tenantId, userId, dto)` — validate scope (global→no scope_id, team→valid team, dept→valid dept)
- `updateBlackout(tenantId, id, dto)`
- `deleteBlackout(tenantId, id)` — soft-delete `is_active = 4`
- `getConflicts(tenantId, startDate, endDate, userTeamId?, userDeptId?)` — date overlap + scope filter

### Step 2.6: Staffing Rules Service

**File:** `backend/src/nest/vacation/vacation-staffing-rules.service.ts`

**Methods:**

- `getStaffingRules(tenantId)` — JOIN machines.name
- `createStaffingRule(tenantId, userId, dto)` — UNIQUE violation → ConflictException
- `updateStaffingRule(tenantId, id, dto)`
- `deleteStaffingRule(tenantId, id)` — soft-delete `is_active = 4`
- `getForMachines(tenantId, machineIds[])` — bulk query, returns `Map<asset_Id, minStaffCount>`

### Step 2.7: Capacity Service (Heart of the system)

**File:** `backend/src/nest/vacation/vacation-capacity.service.ts`

**Single method:** `analyzeCapacity(tenantId, startDate, endDate, requesterId)`

**Algorithm:**

1. Find requester's team via `user_teams`
2. Find all machines for that team via `machine_teams`
3. For EVERY workday in range:
   a. Count total team members
   b. Count absent members (approved vacations + user_availability != 'available')
   c. For each asset: check `min_staff_count` from staffing rules
   d. `availableAfterApproval = available - 1` (requester leaves)
   e. Determine status: ok / warning / critical
4. Return worst-case day per asset
5. Check blackout conflicts
6. Check entitlement balance
7. Return `VacationCapacityAnalysis` with `overallStatus`

**Dependencies:** holidays service (for workday iteration), entitlements service (balance check), blackouts service (conflict check), staffing rules service (min staff)

### Step 2.8: Vacation Service (Core business logic) [DONE - Session 10, 2026-02-12]

**Architecture: 4-file split** (ESLint max-lines: 800 per file with skipBlankLines+skipComments)

| File                             | Lines                    | Purpose                                                                                                                  |
| -------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `vacation.service.ts`            | 820 raw (~738 countable) | Mutations: create, approve/deny, withdraw, cancel, edit                                                                  |
| `vacation-approver.service.ts`   | ~175                     | Approver determination: role-based chain with self-approval prevention (R5)                                              |
| `vacation-validation.service.ts` | 366                      | Business-rule validation: advance notice, max consecutive, overlap, balance, blackouts, workday computation, merge logic |
| `vacation-queries.service.ts`    | 374                      | Read-only queries: getRequestById, getMyRequests, getIncomingRequests, getStatusLog, getTeamCalendar                     |

**VacationService methods (mutations):**

- `createRequest(userId, tenantId, dto)` — full validation chain → INSERT + status_log + auto-approve flow
- `respondToRequest(responderId, tenantId, requestId, dto)` — FOR UPDATE lock (R6) + approve/deny
- `withdrawRequest(requesterId, tenantId, requestId)` — pending or future-approved only
- `cancelRequest(adminId, tenantId, requestId, reason)` — admin/root cancels approved
- `editRequest(requesterId, tenantId, requestId, dto)` — only pending + own

**VacationQueriesService methods (reads):**

- `getRequestById(tenantId, requestId)` — single request with resolved names
- `getMyRequests(userId, tenantId, query)` — paginated own requests
- `getIncomingRequests(approverId, tenantId, query)` — paginated incoming
- `getStatusLog(tenantId, requestId)` — audit trail
- `getTeamCalendar(tenantId, teamId, month, year)` — approved vacations for team

**VacationValidationService methods:**

- `validateNewRequest(client, tenantId, userId, dto)` — advance notice + max consecutive + overlap
- `validateBalanceAndBlackouts(tenantId, userId, dto, computedDays, teamId, deptId?)` — balance + blackout conflicts
- `computeWorkdays(tenantId, startDate, endDate, halfDayStart, halfDayEnd)` — with zero-check
- `countWorkdays(...)` — without zero-check (for edit recomputation)
- `reCheckBalanceForApproval(tenantId, request, computedDays)` — approval-time re-check
- `guardFutureStartDate(startDate)` — withdrawal guard
- `mergeWithExisting(dto, existing)` — merge edit DTO with existing row
- `validateEditedRequest(client, tenantId, requesterId, requestId, merged, teamId, deptId?)` — full edit validation

**VacationApproverService** (extracted Session 22 — exceeded 800-line ESLint limit):

```
employee → team_lead_id (or deputy_lead_id if lead absent, or escalate to area_lead if lead IS the user)
admin → area_lead_id (or auto-approve if no area_lead)
root → auto-approve (no approver needed)
area_lead (user is area_lead_id in areas table) → auto-approve
```

**Verification:** ESLint 0 errors, type-check 0 errors (all 4 files + module)

### Step 2.9: Notification Service + EventBus [DONE - Session 11, 2026-02-12]

**Files modified:**

- `backend/src/utils/eventBus.ts` — added `VacationRequestEvent` export interface + 4 typed emit methods [DONE]
- `backend/src/nest/notifications/notifications.controller.ts` — added `canAccess('vacation')` block in `registerSSEHandlers()` [DONE]

**New file:**

- `backend/src/nest/vacation/vacation-notification.service.ts` — calls eventBus emit methods + email stub [CREATED]

**EventBus additions (4 methods):** [ALL IMPLEMENTED]

- `emitVacationRequestCreated(tenantId, request)`
- `emitVacationRequestResponded(tenantId, request)`
- `emitVacationRequestWithdrawn(tenantId, request)`
- `emitVacationRequestCancelled(tenantId, request)`

**SSE_EVENTS constant** (`notifications.controller.ts` line ~118) — 4 new entries added: [DONE]

```typescript
VACATION_REQUEST_CREATED: 'vacation.request.created',
VACATION_REQUEST_RESPONDED: 'vacation.request.responded',
VACATION_REQUEST_WITHDRAWN: 'vacation.request.withdrawn',
VACATION_REQUEST_CANCELLED: 'vacation.request.cancelled',
```

**Additional changes implemented:**

- `NotificationEventData` interface extended with `request` field for vacation payload [DONE]
- `registerVacationHandlers()` helper function extracted to keep `registerSSEHandlers()` under 60-line ESLint limit [DONE]
- 4 listener count entries added in stream stats endpoint [DONE]
- `VacationNotificationService` registered in `vacation.module.ts` (providers + exports) [DONE]
- `exactOptionalPropertyTypes` compliance: `requesterName?` and `approverName?` use `string | undefined` in event types [DONE]

**VacationNotificationService methods:**

- `notifyCreated(tenantId, request)` — emits SSE event + persistent DB notification (→ approver) + email stub
- `notifyResponded(tenantId, request)` — emits SSE event + persistent DB notification (→ requester) + email stub
- `notifyWithdrawn(tenantId, requestId, requesterId, approverId, requesterName)` — emits SSE event + persistent DB notification (→ approver)
- `notifyCancelled(tenantId, requestId, requesterId, adminId, reason)` — emits SSE event + persistent DB notification (→ requester)
- `toEventPayload(request)` — private mapper from `VacationRequest` to event payload
- `createPersistentNotification(...)` — private: INSERT INTO notifications with type='vacation', recipient_type='user', metadata={requestId} (ADR-004 pattern)
- `sendEmailStub(action, tenantId, request)` — private email placeholder

**Persistent notification integration (Session 23, 2026-02-14):**

- `vacation.service.ts` — Injected VacationNotificationService, notify calls after create/respond/withdraw/cancel
- `vacation-queries.service.ts` — New method `getUnreadNotificationRequestIds()` for "Neu" badges
- `vacation.controller.ts` — New endpoint `GET /vacation/notifications/unread-ids`
- `notification-addon.service.ts` — Extended type union to include 'vacation'
- `notifications.service.ts` — Extended facade type union to include 'vacation'
- `notifications.controller.ts` — Extended mark-read endpoint to accept 'vacation'
- `dashboard.service.ts` — Added `fetchVacationCount()` + vacation in parallel fetch
- `dashboard-counts.dto.ts` — Added `vacation: CountItemSchema` to Zod schema
- Frontend: notification-sse.ts (4 vacation SSE types), notification.store.svelte.ts (vacation counts + SSE handler + mark-read), navigation-config.ts (badgeType: 'vacation'), RequestCard + IncomingRequestCard ("Neu" badge), +page.server.ts (parallel unread-ids fetch), +page.svelte (onMount markTypeAsRead)

**Verification:** ESLint 0 errors, type-check 0 errors (all 4 files)

### Step 2.10: Controller

**File:** `backend/src/nest/vacation/vacation.controller.ts`

**Pattern** (from `shifts.controller.ts`):

```typescript
@Controller('vacation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VacationController {
  // Every method: FeatureCheckService.checkTenantAccess(tenantId, 'vacation')
  // @RequirePermission('vacation', 'vacation-requests', 'canRead') etc.
  // Return raw data — ResponseInterceptor wraps (ADR-007)
}
```

**26 endpoints** as defined in spec Section 2.11.

### Phase 2 Definition of Done

- [x] `VacationModule` registered in `app.module.ts` (Session 5)
- [x] All 12 services implemented and injected (Sessions 6-11: holidays, settings, entitlements, blackouts, staffing-rules, capacity, validation, service, queries, notification + permission registrar; Session 22: approver extracted from vacation.service.ts)
- [x] Controller with all 29 endpoints (Session 12 — 8 requests + 1 capacity + 4 entitlements + 4 blackouts + 4 staffing + 4 holidays + 2 settings + 2 overview)
- [x] `VacationPermissionRegistrar` registers on module init (Session 5)
- [x] Feature check on every controller method (Session 12 — `ensureFeatureEnabled()` private helper)
- [x] `db.tenantTransaction()` for ALL tenant-scoped queries (verified Sessions 6-10)
- [x] NO double-wrapping — services return raw data (ADR-007, verified Sessions 6-10)
- [x] 4 EventBus methods added (Session 11 — `emitVacationRequest{Created,Responded,Withdrawn,Cancelled}`)
- [x] 4 SSE handlers registered (Session 11 — `canAccess('vacation')` block + `registerVacationHandlers()` helper)
- [x] `VacationNotificationService` created with 4 notify methods + email stub (Session 11)
- [x] `??` not `||`, no `any`, explicit boolean checks (Session 5 — verified)
- [x] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/vacation/` (Session 11 — re-verified)
- [x] Type-check passes: `docker exec assixx-backend pnpm run type-check` (Session 11 — re-verified)
- [x] All DTOs use Zod + `createZodDto()` pattern (Session 5 — 15 DTO files + common.dto.ts)

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete
> **Pattern:** `backend/src/nest/shifts/shifts.service.test.ts` (co-located tests)

### Test Files

```
backend/src/nest/vacation/
    vacation.service.test.ts              # 20 tests (core mutations + race condition, Session 13+14; approver tests extracted Session 22)
    vacation-approver.service.test.ts     # 11 tests (approver determination, extracted Session 22)
    vacation-holidays.service.test.ts     # 20 tests (countWorkdays critical, Session 13)
    vacation-entitlements.service.test.ts # 17 tests (balance + 4 cross-year scenarios, Session 13+14)
    vacation-capacity.service.test.ts     # 17 tests (capacity analysis, Session 14)
    vacation-blackouts.service.test.ts    # 18 tests (CRUD + scope polymorphism, Session 14)
    vacation-staffing-rules.service.test.ts # 12 tests (CRUD + bulk query, Session 14)
```

### Critical Test Scenarios

**vacation-approver.service.test.ts (approver determination, extracted Session 22):**

- Employee → approver = team_lead_id
- Employee + absent lead → approver = deputy_lead_id
- Employee IS team_lead → escalate to area_lead (self-approval prevention)
- Admin → approver = area_lead_id
- Root → auto-approved
- Area-lead user → auto-approved
- Admin + no area_lead → auto-approved
- Employee without team → BadRequestException
- Team without lead → BadRequestException
- Absent lead + no deputy → fallback to lead
- Deputy IS requester → fallback to lead

**vacation.service.test.ts (core mutations):**

- Insufficient balance → BadRequestException
- Blackout period → BadRequestException
- Overlapping request → ConflictException
- start_date in past → BadRequestException
- Cross-year split correct
- unpaid → no balance check
- Approve → updates user_availability
- Approve with is_special_leave → no balance deduction
- Deny without note → BadRequestException
- Respond to non-pending → ConflictException
- Non-approver responds → ForbiddenException
- Race condition (parallel approve) → ConflictException (FOR UPDATE)
- Withdraw own pending → ok
- Withdraw own approved (future) → ok + availability removed
- Withdraw own approved (past) → ForbiddenException
- Cancel by admin → ok
- Cancel by employee → ForbiddenException

**vacation-holidays.service.test.ts:**

- countWorkdays: Mon-Fri = 5
- countWorkdays: week with holiday = 4
- countWorkdays: half day start = 4.5
- countWorkdays: half day end = 4.5
- countWorkdays: single day full = 1.0
- countWorkdays: single day half = 0.5
- countWorkdays: weekend excluded
- Recurring holiday matched by month+day
- Duplicate holiday_date → ConflictException

**vacation-entitlements.service.test.ts:**

- getBalance: correct calculation
- getBalance: expired carry-over excluded
- getBalance: cross-year request split correctly
- getBalance: is_special_leave excluded from usedDays
- Duplicate (tenant, user, year) → ConflictException

### Phase 3 Definition of Done

- [x] > = 75 total assertions across all test files (115 tests)
- [x] All tests pass: `docker exec assixx-backend pnpm exec vitest run backend/src/nest/vacation/`
- [x] Cross-year splitting tested with >= 3 scenarios (4: approved split, pending split, half-day boundary, multiple cross-year)
- [x] Self-approval prevention tested
- [x] Race condition tested (FOR UPDATE lock verified in respondToRequest)
- [x] Every ConflictException / BadRequestException path covered

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete
> **Pattern:** `backend/test/*.api.test.ts` (HOW-TO-TEST-WITH-VITEST.md)

### Test File

`backend/test/vacation.api.test.ts`

### Scenarios (>= 20 assertions)

**Auth & Feature:**

- Unauthenticated → 401
- Feature disabled → 403

**Requests CRUD:**

- POST /vacation/requests → 201 (employee, correct approver)
- POST /vacation/requests → 201 auto-approved (root)
- POST /vacation/requests → 400 insufficient balance
- POST /vacation/requests → 409 overlapping
- GET /vacation/requests → own requests only (pagination)
- GET /vacation/requests/incoming → only for approvers
- PATCH /vacation/requests/:id → edit pending
- PATCH /vacation/requests/:id/respond → approve
- PATCH /vacation/requests/:id/respond → deny with note
- PATCH /vacation/requests/:id/withdraw → requester
- PATCH /vacation/requests/:id/cancel → admin

**Capacity:**

- GET /vacation/capacity → returns analysis

**CRUD endpoints:**

- CRUD holidays (root only)
- CRUD blackouts (admin/root)
- CRUD staffing rules (admin/root)
- CRUD entitlements (admin/root)
- GET/PUT settings (admin/root)

**RLS:**

- Tenant A cannot see Tenant B data

### Phase 4 Definition of Done

- [x] > = 20 API integration test assertions (33 tests)
- [x] All tests pass (33/33 after migration 32 + scopeType→isGlobal test fix)
- [x] Tenant isolation verified (RLS via tenantTransaction)
- [x] Feature-flag gating verified (ensureFeatureEnabled on all endpoints)
- [x] Pagination verified on list endpoints (data/total/page/limit/totalPages)

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete (backend endpoints available)
> **Pattern:** Calendar module (`frontend/src/routes/(app)/(shared)/calendar/`)

### Step 5.1: /vacation Main Page [DONE — Session 16, 2026-02-12]

**14 new files + 1 modified:**

1. `_lib/types.ts` — 12 frontend interfaces (VacationRequest, VacationBalance, VacationCapacityAnalysis, PaginatedResult, form payloads, VacationPageData)
2. `_lib/constants.ts` — German labels (STATUS_LABELS, TYPE_LABELS, HALF_DAY_LABELS, CAPACITY_STATUS_LABELS), badge classes, filter options, VIEW_TABS, DEFAULT_PAGE_SIZE=10, CAPACITY_DEBOUNCE_MS=300
3. `_lib/api.ts` — 10 browser-side API functions via apiClient (getMyRequests, getIncomingRequests, createRequest, editRequest, respondToRequest, withdrawRequest, cancelRequest, getStatusLog, analyzeCapacity, getMyBalance)
4. `_lib/state-data.svelte.ts` — Data state (myRequests, incomingRequests, balance, capacityAnalysis, statusLog)
5. `_lib/state-ui.svelte.ts` — UI state (activeTab, statusFilter, year, page, 6 modals, selectedRequest, loading)
6. `_lib/state.svelte.ts` — Unified re-export composing data + ui state modules
7. `_lib/EntitlementBadge.svelte` — Balance summary with progress bar + color coding
8. `_lib/VacationFilters.svelte` — Tab toggle (my/incoming) + status dropdown + year selector
9. `_lib/RequestCard.svelte` — Own request card (status badge, dates, type, detail/edit/withdraw)
10. `_lib/IncomingRequestCard.svelte` — Incoming request card (requester name, approve/deny)
11. `_lib/CapacityIndicator.svelte` — Capacity analysis (ok/warning/blocked + conflicts + entitlement check)
12. `_lib/SpecialLeaveCheckbox.svelte` — Special leave toggle for approval flow
13. `_lib/RequestForm.svelte` — Create/edit form with 300ms debounced capacity check
14. `+page.server.ts` — SSR: parallel fetch (myRequests + incomingRequests + balance), canApprove logic
15. `+page.svelte` — Full page: tabs, filters, request lists, pagination, create modal, respond modal (approve/deny with reason)
16. `(app)/_lib/navigation-config.ts` — Added `vacation` icon + menu item to root, admin, employee arrays

**Quality:** svelte-check 0 errors, ESLint 0 errors, Vite build passes

### Route Structure

```
frontend/src/routes/(app)/
    (shared)/vacation/
        +page.svelte                # Main page (role-dependent view) [DONE Session 16]
        +page.server.ts             # Auth + SSR data loading [DONE Session 16]
        _lib/
            api.ts                  # apiClient wrapper (10 functions) [DONE Session 16]
            types.ts                # TypeScript interfaces (12 types) [DONE Session 16]
            constants.ts            # Status labels, colors, enums [DONE Session 16]
            state.svelte.ts         # Root state (re-exports sub-states) [DONE Session 16]
            state-data.svelte.ts    # Data state ($state for requests, entitlements) [DONE Session 16]
            state-ui.svelte.ts      # UI state ($state for filters, modals) [DONE Session 16]
            RequestForm.svelte      # Create/edit form + capacity debounce [DONE Session 16]
            RequestCard.svelte      # Own request card [DONE Session 16]
            IncomingRequestCard.svelte # Incoming request card [DONE Session 16]
            CapacityIndicator.svelte # Capacity analysis display [DONE Session 16]
            TeamCalendarPreview.svelte
            EntitlementBadge.svelte  # Balance progress bar [DONE Session 16]
            VacationFilters.svelte   # Tabs + filters [DONE Session 16]
            SpecialLeaveCheckbox.svelte # Special leave toggle [DONE Session 16]

    (admin)/vacation/
        rules/+page.svelte + +page.server.ts + _lib/  [DONE Session 17]
        entitlements/+page.svelte + +page.server.ts + _lib/
        overview/+page.svelte + +page.server.ts + _lib/

    (root)/vacation/
        holidays/+page.svelte + +page.server.ts + _lib/
```

### Step 5.2: /vacation/rules Admin Page [DONE — Session 17, 2026-02-13]

**6 new files + 1 CSS file + 2 modified:**

1. `rules/_lib/types.ts` — 8 frontend interfaces (VacationBlackout, VacationStaffingRule, VacationSettings, BlackoutScopeType, CRUD payloads, VacationRulesPageData)
2. `rules/_lib/constants.ts` — German labels (SCOPE_TYPE_LABELS, MONTH_LABELS, SETTINGS_LABELS), RulesTab type, RULES_TABS with icons
3. `rules/_lib/api.ts` — 10 browser-side API functions via apiClient (blackouts CRUD x4, staffing rules CRUD x4, settings get/update x2)
4. `rules/_lib/state.svelte.ts` — Svelte 5 Runes state: data (blackouts, staffingRules, settings) + UI (activeTab, 4 modals, editing/deleting items, isEditingSettings)
5. `rules/+page.server.ts` — SSR: parallel fetch (blackouts + staffingRules + settings via Promise.all)
6. `rules/+page.svelte` — 3-tab page: Sperrzeiten (blackout list + create/edit/delete modals), Besetzungsregeln (staffing rule list + create/edit/delete modals), Einstellungen (read-only display / inline edit form with 6 fields)
7. `frontend/src/styles/vacation-rules.css` — Rules list items, settings grid/display, responsive layout

**Modified files:**

- `(app)/_lib/navigation-config.ts` — Root + admin vacation items changed from single URL to submenu (VACATION_ADMIN_SUBMENU: "Anträge" + "Regeln & Einstellungen")
- `frontend/src/lib/components/Breadcrumb.svelte` — Added `/vacation/rules` breadcrumb entry

**Quality:** svelte-check 0 errors, 0 warnings. Backend type-check clean. 3984 unit tests passing.

### Step 5.3: /vacation/entitlements + /vacation/holidays [DONE — Session 18, 2026-02-13]

**12 new files + 2 modified:**

**Entitlements page** (`(admin)/vacation/entitlements/`):

1. `_lib/types.ts` — 7 interfaces (VacationEntitlement, VacationBalance, EmployeeListItem, CreateEntitlementPayload, AddDaysPayload, VacationEntitlementsPageData)
2. `_lib/constants.ts` — BALANCE_LABELS (9 German labels), ENTITLEMENT_LABELS (4 form labels), EMPLOYEES_PAGE_SIZE=100
3. `_lib/api.ts` — 3 apiClient functions (getUserBalance, createOrUpdateEntitlement, addDays)
4. `_lib/state.svelte.ts` — Runes state: employees, selectedEmployee, balance, selectedYear, searchQuery, 2 modals, filteredEmployees derived
5. `+page.server.ts` — SSR: GET /users?limit=500&isActive=1&sortBy=lastName, maps to EmployeeListItem[]
6. `+page.svelte` — 2-panel layout: left=employee list with search, right=balance display with progress bar + color coding + 9-field grid + entitlement form modal + add-days modal

**Holidays page** (`(root)/vacation/holidays/`):

1. `_lib/types.ts` — 5 interfaces (VacationHoliday, CreateHolidayPayload, UpdateHolidayPayload, VacationHolidaysPageData)
2. `_lib/constants.ts` — RECURRING_LABELS, DEFAULT_GERMAN_HOLIDAYS reference
3. `_lib/api.ts` — 4 apiClient functions (getHolidays, createHoliday, updateHoliday, deleteHoliday)
4. `_lib/state.svelte.ts` — Runes state: holidays, selectedYear, modals (form + delete), sortedHolidays derived, recurringCount/oneTimeCount
5. `+page.server.ts` — SSR: GET /vacation/holidays?year={currentYear}
6. `+page.svelte` — Holiday list with year filter, create/edit modal (name + date + recurring toggle), delete confirm modal with recurring warning

**Modified files:**

- `(app)/_lib/navigation-config.ts` — Split into VACATION_ADMIN_SUBMENU (3 items) + VACATION_ROOT_SUBMENU (4 items with holidays)
- `frontend/src/lib/components/Breadcrumb.svelte` — Added `/vacation/entitlements` + `/vacation/holidays` entries

**Quality:** svelte-check 0 errors, 0 warnings. ESLint 0 errors.

### Key Frontend Patterns

**apiClient (CRITICAL — Kaizen bug):**

```typescript
// apiClient.get<T>() returns data DIRECTLY (already unwrapped)
const balance = await apiClient.get<VacationBalance>('/vacation/entitlements/me');
// balance IS the VacationBalance object — NOT { success, data: VacationBalance }
```

**State management (Svelte 5 Runes):**

```typescript
// state-data.svelte.ts
let requests = $state<VacationRequest[]>([]);
let entitlement = $state<VacationBalance | null>(null);
```

**+page.server.ts pattern:**

```typescript
export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (!token) redirect(302, '/login');
  const { user } = await parent();
  // Feature check + data loading
};
```

**Design System:** Use existing CSS primitives (`badge--warning`, `badge--success`, `card-base`, `form-field`, `modal.base.css`, `table-base`).

### Phase 5 Definition of Done

- [x] `/vacation` page renders for employee, lead, admin, root (Session 16 — SSR + role-based tabs)
- [x] RequestForm with live capacity check (300ms debounce) (Session 16)
- [x] IncomingRequestCard with capacity + special leave checkbox (Session 16)
- [x] Approve/deny flow works (deny requires reason) (Session 16)
- [x] `/vacation/rules` page for blackouts + staffing rules + settings (Session 17 — 3-tab page, full CRUD, settings inline edit)
- [x] `/vacation/entitlements` page with add-days modal (Session 18 — employee list + balance display + entitlement form + add-days modal)
- [x] `/vacation/holidays` page with CRUD (Session 18 — holiday list + year filter + create/edit/delete modals)
- [x] `/vacation/overview` with team calendar (Session 19 — team selector + month/year nav + calendar grid + own balance + legend)
- [x] EntitlementBadge shows "X/Y days remaining" (Session 16 — progress bar + colors)
- [x] Svelte 5 Runes ($state, $derived, $effect) (Session 16)
- [x] apiClient generic = DATA shape (not wrapper) (Session 16)
- [x] Frontend ESLint 0 errors (Session 16 — svelte-check 0 errors, ESLint 0 errors)
- [x] Navigation config updated — vacation item in all 3 role menus (Session 16)

---

## Phase 6: Integration + Polish

> **Dependency:** Phase 5 complete

### Calendar Integration

- Frontend-side merge: Calendar component fetches approved vacations for the month
- Show vacation entries with distinct color in calendar view

### Schichtplan-Integration (überarbeitet Session 20)

**Problem:** Schichtpläne können bis zu 2 Jahre im Voraus belegt sein. Automatische Benachrichtigungen oder Schichtlöschungen sind nicht sinnvoll — der Admin muss selbst entscheiden.

**Lösung: 3 Bausteine**

#### A) UI-Warnung in Incoming Requests (Frontend)

In der **IncomingRequestCard** und im **Details-Modal** eine Info-Box anzeigen:

```
⚠️ Achtung: Der Mitarbeiter könnte in diesem Zeitraum im Schichtplan eingeplant sein.
   Bitte Schichtplan manuell überprüfen!
```

- Design: `badge--warning` / Info-Box im Design-System-Stil
- Wird bei **jedem** eingehenden Antrag angezeigt (kein Backend-Check nötig — ist eine generelle Erinnerung)
- Keine automatische Schichtlöschung — Admin entscheidet manuell

#### B) 🔴 KRITISCH: `user_availability` automatisch setzen (Backend)

Nach Genehmigung eines Urlaubsantrags **MUSS** automatisch ein `user_availability`-Eintrag erstellt werden:

```
Typ: "Urlaub"
Zeitraum: start_date — end_date (aus vacation_request)
User: requester_id
```

**Warum kritisch?** Das bestehende Schichtplan-Modul liest bereits `user_availability`:

- `/manage-employees/availability/[uuid]` zeigt Verfügbarkeiten an
- Schichtplan-Ansicht zeigt Badge: `🛫 Urlaub | 31.01.2026 - 02.02.2026`
- Wenn Availability gesetzt ist → Schichtplan erkennt Abwesenheit automatisch

**Ohne diesen Eintrag** bleibt der Mitarbeiter im Schichtplan als "verfügbar" sichtbar — obwohl er genehmigten Urlaub hat!

**Bei Storno/Widerruf:** `user_availability`-Eintrag wieder entfernen (oder deaktivieren).

#### C) Keine automatische Schichtlöschung

- Schichten werden NICHT automatisch gelöscht oder umgeplant
- Der Admin/Teamleiter sieht im Schichtplan die Availability-Badge und entscheidet selbst
- Das ist bewusst so — Schichtplanung ist zu komplex für automatische Umplanung

### ~~Seeds~~ — GESTRICHEN

> **Entscheidung (Session 20, 2026-02-13):** Keine Seed-Dateien. Test erfolgt direkt mit Testdaten über die UI/UX. Begründung: Seed-Daten sind tenant-spezifisch (Feiertage unterscheiden sich je nach Bundesland/Firma). Der Admin legt Feiertage und Ansprüche über die vorhandenen CRUD-Oberflächen an — genau so, wie es in Produktion funktionieren soll.

### Documentation

- `docs/infrastructure/adr/ADR-023-vacation-request-architecture.md` — architecture decisions
- ~~`docs/context.md` — add vacation controller/endpoints~~ — GESTRICHEN (nicht nötig)
- `docs/FEATURES.md` — update vacation feature status
- `brainstorming_vacation.md` — mark open points as "Resolved"

### Phase 6 Definition of Done

- [x] Approved vacations visible in calendar (vacation-indicators.svelte.ts)
- [x] Schichtplan-Warnung in IncomingRequestCard + Details-Modal (Frontend UI-Box)
- [x] 🔴 `user_availability` automatisch setzen bei Genehmigung + entfernen bei Storno/Widerruf (Backend)
- [x] Schichtplan erkennt genehmigte Urlaube automatisch via Availability-Badge
- ~~[ ] German holidays seeded for demo~~ — GESTRICHEN (Test via UI)
- [x] ADR-023 written (Session 20)
- ~~[ ] context.md updated~~ — GESTRICHEN
- [x] FEATURES.md updated (Session 20)
- [x] Customer fresh-install synced: `./scripts/sync-customer-migrations.sh` (Session 20 — 33 Migrationen)
- [x] Vacation notifications integrated (Session 23): persistent DB notifications (ADR-004 pattern), sidebar badge counts, mark-read/vacation endpoint, dashboard vacation count, "Neu" badges on RequestCard + IncomingRequestCard, SSE types + frontend store
- [x] Audit logging integration (Session 24, ADR-009): ActivityLoggerService in alle 6 Mutation-Services (vacation, blackouts, holidays, staffing-rules, entitlements, settings), 6 neue ActivityEntityTypes, 5 RESOURCE_TABLE_MAP Einträge, fire-and-forget nach Transaction-Commit, 85 Unit Tests grün

---

## Implementation Order (Session-by-Session)

Each numbered item is roughly ONE implementation session:

```
Session 1:  Phase 1 — Migrations 27+28 (feature flag + teams extension) [DONE 2026-02-12]
Session 2:  Phase 1 — Migration 29 (7 core tables) [DONE 2026-02-12]
Session 3:  Phase 1 — Migration 30 (availability rebuild) + backend+frontend renames (12 files) [DONE 2026-02-12]
Session 4:  Phase 1 — Migration 31 (legacy cleanup) + verify all [DONE 2026-02-12]
Session 5:  Phase 2 — Module skeleton + types + DTOs + permissions [DONE 2026-02-12]
Session 6:  Phase 2 — Holidays service (countWorkdays) [DONE 2026-02-12]
Session 7:  Phase 2 — Settings service + Entitlements service (getBalance) [DONE 2026-02-12]
Session 8:  Phase 2 — Blackouts + Staffing Rules services [DONE 2026-02-12]
Session 9:  Phase 2 — Capacity service (heart) [DONE 2026-02-12]
Session 10: Phase 2 — Vacation service (3-file split: mutations + validation + queries) [DONE 2026-02-12]
Session 11: Phase 2 — Notification service + EventBus + SSE handlers [DONE 2026-02-12]
Session 12: Phase 2 — Controller (29 endpoints, feature check, module wiring) [DONE 2026-02-12]
Session 13: Phase 3 — Unit tests (core + holidays + entitlements, 64 tests) [DONE 2026-02-12]
Session 14: Phase 3 — Unit tests (capacity + blackouts + staffing, 115 total) [DONE 2026-02-12]
Session 15: Phase 4 — API integration tests (29 tests) [DONE 2026-02-12]
Session 16: Phase 5 — Frontend: /vacation main page [DONE 2026-02-12] (14 files: 3 foundation + 3 state + 7 components + 1 page, ESLint 0 errors)
Session 17: Phase 5 — Frontend: /vacation/rules [DONE 2026-02-13] (6 files: 4 foundation + 1 state + 1 page + 1 CSS, svelte-check 0 errors)
Session 18: Phase 5 — Frontend: /vacation/entitlements + /vacation/holidays [DONE 2026-02-13] (12 files: 8 foundation + 2 state + 2 pages + nav/breadcrumb updates, svelte-check 0 errors, ESLint 0 errors)
Session 19: Phase 5 — Frontend: /vacation/overview [DONE 2026-02-13] (6 files: 4 foundation + 1 state + 1 page + nav/breadcrumb updates, svelte-check 0 errors, ESLint 0 errors)
Session 20: Phase 6 — Integration + documentation + ADR-023
Session 21: Phase 1 — Migration 32 (blackout multi-scope) + API test fix (scopeType→isGlobal) [DONE 2026-02-13]
Session 22: Phase 2 — Extract VacationApproverService (vacation.service.ts exceeded 800-line ESLint limit → 4-file split) [DONE 2026-02-14]
Session 23: Phase 6 — Vacation notification integration: persistent DB notifications (ADR-004), sidebar badge counts, mark-read, dashboard counts, "Neu" badges on request cards [DONE 2026-02-14]
Session 24: Phase 6 — Audit logging integration (ADR-009): ActivityLoggerService in alle 6 Vacation Services injiziert, 6 neue EntityTypes, 5 RESOURCE_TABLE_MAP Einträge, userId-Parameter hinzugefügt wo fehlend [DONE 2026-02-14]
```

---

## Quick Reference: Exact File Paths

### Backend (new)

| File                                                           | Purpose                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| `backend/src/nest/vacation/vacation.module.ts`                 | NestJS module                                            |
| `backend/src/nest/vacation/vacation.controller.ts`             | REST controller (26 endpoints)                           |
| `backend/src/nest/vacation/vacation.service.ts`                | Core business logic (mutations)                          |
| `backend/src/nest/vacation/vacation-approver.service.ts`       | Approver determination chain                             |
| `backend/src/nest/vacation/vacation-validation.service.ts`     | Business-rule validation                                 |
| `backend/src/nest/vacation/vacation-queries.service.ts`        | Read-only queries (paginated)                            |
| `backend/src/nest/vacation/vacation-capacity.service.ts`       | Capacity analysis                                        |
| `backend/src/nest/vacation/vacation-holidays.service.ts`       | Holidays + countWorkdays                                 |
| `backend/src/nest/vacation/vacation-entitlements.service.ts`   | Entitlements + getBalance                                |
| `backend/src/nest/vacation/vacation-blackouts.service.ts`      | Blackout CRUD + conflict check                           |
| `backend/src/nest/vacation/vacation-staffing-rules.service.ts` | Min staffing CRUD                                        |
| `backend/src/nest/vacation/vacation-settings.service.ts`       | Tenant settings                                          |
| `backend/src/nest/vacation/vacation-notification.service.ts`   | SSE + persistent DB notifications (ADR-004) + email stub |
| `backend/src/nest/vacation/vacation.types.ts`                  | All interfaces                                           |
| `backend/src/nest/vacation/vacation.permissions.ts`            | Permission definition                                    |
| `backend/src/nest/vacation/vacation-permission.registrar.ts`   | Permission registration                                  |
| `backend/src/nest/vacation/dto/*.ts`                           | 15 DTO files                                             |

### Backend (modified)

| File                                                           | Change                                                                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/nest/app.module.ts`                               | Add VacationModule import                                                                                                                                |
| `backend/src/utils/eventBus.ts`                                | Add VacationRequestEvent interface + 4 emit methods [DONE Session 11]                                                                                    |
| `backend/src/nest/notifications/notifications.controller.ts`   | Add 4 SSE_EVENTS + NotificationEventData.request + canAccess('vacation') block + registerVacationHandlers() helper + 4 listener counts [DONE Session 11] |
| `backend/src/nest/users/user-availability.service.ts`          | Rename 12 SQL + 8 column references (employee_availability → user_availability)                                                                          |
| `backend/src/nest/teams/teams.service.ts`                      | Rename 2 LEFT JOIN references                                                                                                                            |
| `backend/src/nest/users/users.service.ts`                      | Update 3 comment references                                                                                                                              |
| `backend/src/nest/users/users.helpers.ts`                      | Update 2 comment references                                                                                                                              |
| `backend/src/nest/users/users.types.ts`                        | Update 1 comment reference                                                                                                                               |
| `backend/src/nest/users/dto/update-availability.dto.ts`        | Update 1 comment reference                                                                                                                               |
| `backend/src/nest/users/user-availability.service.test.ts`     | **CRITICAL:** Update test data (employee_id → user_id) + SQL assertions                                                                                  |
| `backend/src/nest/dashboard/dashboard.service.ts`              | Added DatabaseService injection + `fetchVacationCount()` + vacation in parallel fetch [Session 23]                                                       |
| `backend/src/nest/dashboard/dto/dashboard-counts.dto.ts`       | Added `vacation: CountItemSchema` to Zod schema [Session 23]                                                                                             |
| `backend/src/nest/notifications/notification-addon.service.ts` | Extended type union to include 'vacation' [Session 23]                                                                                                   |
| `backend/src/nest/notifications/notifications.service.ts`      | Extended facade type union to include 'vacation' [Session 23]                                                                                            |
| `backend/src/nest/notifications/notifications.controller.ts`   | Extended mark-read/:type to accept 'vacation' [Session 23]                                                                                               |
| `backend/src/nest/common/services/activity-logger.service.ts`  | 6 neue EntityTypes: vacation, vacation_blackout, vacation_holiday, vacation_staffing_rule, vacation_entitlement, vacation_settings [Session 24]          |
| `backend/src/nest/common/audit/audit.constants.ts`             | 5 neue RESOURCE_TABLE_MAP Einträge: request, blackout, holiday, staffing-rule, entitlement [Session 24]                                                  |

### Database (new)

| File                                                            | Purpose                             |
| --------------------------------------------------------------- | ----------------------------------- |
| `database/migrations/20260212000027_vacation-feature-flag.ts`   | Feature registration                |
| `database/migrations/20260212000028_teams-deputy-lead.ts`       | Teams extension + Business Rule A1  |
| `database/migrations/20260212000029_vacation-core-tables.ts`    | 7 tables + 3 ENUMs                  |
| `database/migrations/20260212000030_availability-rebuild.ts`    | Rename employee_availability        |
| `database/migrations/20260212000031_vacation-legacy-cleanup.ts` | Drop absences                       |
| `database/migrations/20260213000032_blackout-multi-scope.ts`    | Blackout multi-scope junction table |

### Frontend (new)

| Path                                                                           | Purpose                                                        | Status          |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------- |
| `frontend/src/routes/(app)/(shared)/vacation/+page.svelte`                     | Main vacation page (tabs, lists, modals)                       | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/+page.server.ts`                  | SSR: parallel fetch + canApprove logic                         | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/types.ts`                    | 12 frontend TypeScript interfaces                              | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/constants.ts`                | German labels, badges, filters, pagination                     | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/api.ts`                      | 10 apiClient functions                                         | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/state.svelte.ts`             | Unified state re-export                                        | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/state-data.svelte.ts`        | Data state (requests, balance, capacity)                       | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/state-ui.svelte.ts`          | UI state (tabs, filters, 6 modals, pagination)                 | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/RequestForm.svelte`          | Create/edit form + 300ms capacity debounce                     | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/RequestCard.svelte`          | Own request card                                               | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/IncomingRequestCard.svelte`  | Incoming request card (approve/deny)                           | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/CapacityIndicator.svelte`    | Capacity analysis display                                      | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/EntitlementBadge.svelte`     | Balance progress bar                                           | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/VacationFilters.svelte`      | Tab toggle + status/year filters                               | DONE Session 16 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/SpecialLeaveCheckbox.svelte` | Special leave toggle                                           | DONE Session 16 |
| `frontend/src/routes/(app)/(admin)/vacation/rules/_lib/types.ts`               | 8 frontend interfaces (blackouts, rules, settings)             | DONE Session 17 |
| `frontend/src/routes/(app)/(admin)/vacation/rules/_lib/constants.ts`           | German labels, tabs, month names                               | DONE Session 17 |
| `frontend/src/routes/(app)/(admin)/vacation/rules/_lib/api.ts`                 | 10 apiClient functions (CRUD x3 groups)                        | DONE Session 17 |
| `frontend/src/routes/(app)/(admin)/vacation/rules/_lib/state.svelte.ts`        | Runes state (data + UI + modals)                               | DONE Session 17 |
| `frontend/src/routes/(app)/(admin)/vacation/rules/+page.server.ts`             | SSR: parallel fetch blackouts/rules/settings                   | DONE Session 17 |
| `frontend/src/routes/(app)/(admin)/vacation/rules/+page.svelte`                | 3-tab page (blackouts, staffing, settings)                     | DONE Session 17 |
| `frontend/src/styles/vacation-rules.css`                                       | Rules list + settings grid styles                              | DONE Session 17 |
| `frontend/src/routes/(app)/(admin)/vacation/entitlements/_lib/types.ts`        | 7 interfaces (entitlement, balance, employee)                  | DONE Session 18 |
| `frontend/src/routes/(app)/(admin)/vacation/entitlements/_lib/constants.ts`    | German labels (balance fields, form fields)                    | DONE Session 18 |
| `frontend/src/routes/(app)/(admin)/vacation/entitlements/_lib/api.ts`          | 3 apiClient functions (balance, upsert, addDays)               | DONE Session 18 |
| `frontend/src/routes/(app)/(admin)/vacation/entitlements/_lib/state.svelte.ts` | Runes state (employees, balance, modals, search)               | DONE Session 18 |
| `frontend/src/routes/(app)/(admin)/vacation/entitlements/+page.server.ts`      | SSR: fetch employee list (GET /users)                          | DONE Session 18 |
| `frontend/src/routes/(app)/(admin)/vacation/entitlements/+page.svelte`         | 2-panel: employee list + balance + entitlement/add-days modals | DONE Session 18 |
| `frontend/src/routes/(app)/(root)/vacation/holidays/_lib/types.ts`             | 5 interfaces (holiday, CRUD payloads)                          | DONE Session 18 |
| `frontend/src/routes/(app)/(root)/vacation/holidays/_lib/constants.ts`         | German labels + default holidays reference                     | DONE Session 18 |
| `frontend/src/routes/(app)/(root)/vacation/holidays/_lib/api.ts`               | 4 apiClient functions (CRUD)                                   | DONE Session 18 |
| `frontend/src/routes/(app)/(root)/vacation/holidays/_lib/state.svelte.ts`      | Runes state (holidays, year, modals, sorted)                   | DONE Session 18 |
| `frontend/src/routes/(app)/(root)/vacation/holidays/+page.server.ts`           | SSR: fetch holidays for current year                           | DONE Session 18 |
| `frontend/src/routes/(app)/(root)/vacation/holidays/+page.svelte`              | Holiday list + year filter + CRUD modals                       | DONE Session 18 |
| `frontend/src/routes/(app)/(admin)/vacation/overview/_lib/types.ts`            | 8 interfaces (calendar, balance, grid, page data)              | DONE Session 19 |
| `frontend/src/routes/(app)/(admin)/vacation/overview/_lib/constants.ts`        | German labels (months, weekdays, type labels/colors, half-day) | DONE Session 19 |
| `frontend/src/routes/(app)/(admin)/vacation/overview/_lib/api.ts`              | 2 apiClient functions (team-calendar, overview balance)        | DONE Session 19 |
| `frontend/src/routes/(app)/(admin)/vacation/overview/_lib/state.svelte.ts`     | Runes state (teams, calendar grid, month/year nav, balance)    | DONE Session 19 |
| `frontend/src/routes/(app)/(admin)/vacation/overview/+page.server.ts`          | SSR: fetch teams list for selector                             | DONE Session 19 |
| `frontend/src/routes/(app)/(admin)/vacation/overview/+page.svelte`             | Team calendar grid + balance summary + legend                  | DONE Session 19 |

### Frontend (modified)

| File                                                                          | Change                                                                                 | Status          |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------- |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`                         | Added `vacation` icon + menu item to root, admin, employee arrays                      | DONE Session 16 |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`                         | Root + admin vacation: single URL → submenu (VACATION_ADMIN_SUBMENU: Anträge + Regeln) | DONE Session 17 |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`                         | Split VACATION_ADMIN_SUBMENU (3 items) + VACATION_ROOT_SUBMENU (4 items with holidays) | DONE Session 18 |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`                         | Added "Übersicht" as first item in both VACATION_ADMIN_SUBMENU + VACATION_ROOT_SUBMENU | DONE Session 19 |
| `frontend/src/lib/components/Breadcrumb.svelte`                               | Added `/vacation/rules` breadcrumb entry                                               | DONE Session 17 |
| `frontend/src/lib/components/Breadcrumb.svelte`                               | Added `/vacation/entitlements` + `/vacation/holidays` breadcrumb entries               | DONE Session 18 |
| `frontend/src/lib/components/Breadcrumb.svelte`                               | Added `/vacation/overview` breadcrumb entry                                            | DONE Session 19 |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`                         | Added `badgeType: 'vacation'` to vacation menu items (all 3 roles)                     | DONE Session 23 |
| `frontend/src/lib/utils/notification-sse.ts`                                  | Added 4 vacation SSE event types + VacationRequestEventData interface                  | DONE Session 23 |
| `frontend/src/lib/stores/notification.store.svelte.ts`                        | Added vacation to NotificationCounts, SSE handler, FeatureType, initFromSSR, mark-read | DONE Session 23 |
| `frontend/src/routes/(app)/(shared)/vacation/+page.server.ts`                 | Added parallel fetch for unread notification request IDs                               | DONE Session 23 |
| `frontend/src/routes/(app)/(shared)/vacation/+page.svelte`                    | Added onMount markTypeAsRead('vacation') + isNew prop to cards                         | DONE Session 23 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/RequestCard.svelte`         | Added isNew prop + "Neu" badge (badge--sm badge--success)                              | DONE Session 23 |
| `frontend/src/routes/(app)/(shared)/vacation/_lib/IncomingRequestCard.svelte` | Added isNew prop + "Neu" badge                                                         | DONE Session 23 |

---

## Spec Deviations Found (prompt_vacation.md vs Actual Ecosystem)

These are errors or outdated patterns in the spec that MUST be corrected during implementation:

| #   | Spec Says                                                                                       | Actual Ecosystem                                                                                            | Resolution                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| D1  | `import { type PermissionCategoryDef } from '../admin-permissions/permission-registry.service'` | Import path is `'../common/permission-registry/permission.types.js'`                                        | Use actual path                                                                                                |
| D2  | `PermissionCategoryDef` has `addonCode` and modules with `{ code, name }`                       | Actual interface uses `code`, `label`, `icon`, and modules with `{ code, label, icon, allowedPermissions }` | Use actual interface shape                                                                                     |
| D3  | `GRANT SELECT, INSERT, UPDATE, DELETE` for ALL tables                                           | `vacation_request_status_log` is append-only audit → `GRANT SELECT, INSERT` only (no UPDATE/DELETE)         | Apply exception for status_log                                                                                 |
| D4  | Spec lists 3 backend files for availability rename                                              | Actually 12 files: 2 SQL services + 4 comment files + 2 DTO files + 1 test file + 3 frontend files          | Updated all 12                                                                                                 |
| D5  | Spec doesn't mention `SSE_EVENTS` constant map                                                  | `notifications.controller.ts` uses a const object at line ~108 with all event strings                       | Must add 4 vacation entries to SSE_EVENTS                                                                      |
| D6  | Spec doesn't mention SSE stats endpoint listener counts                                         | Stats endpoint at ~line 600 lists listener counts per event                                                 | Must add vacation listener counts                                                                              |
| D7  | Phase ordering: Spec Phase 3=Frontend, Phase 5=Tests                                            | This plan: Phase 3=Tests, Phase 5=Frontend (test backend before building UI)                                | Follow this plan's ordering (spec's own implementation order agrees — steps 15-16 tests before 17-21 frontend) |

---

## Known Limitations (V1 — Intentionally Excluded)

1. **Bewegliche Feiertage** (Ostern, Pfingsten) — manual non-recurring entries per year
2. **Eskalation/Timeout** — no auto-reminder if lead doesn't respond
3. **Automatische Ablehnung** — no auto-deny when min staffing violated
4. **Automatische Schicht-Umplanung** — warning only, no auto-reschedule
5. **CSV/Excel Export** — no download for year overview
6. **Multi-Team Support** — 1 team per employee (Business Rule A1)
7. **Full Email Integration** — stub only until SMTP configured

---

**This document is the execution plan. Each session starts here, picks the next unchecked item, and marks it done.**
