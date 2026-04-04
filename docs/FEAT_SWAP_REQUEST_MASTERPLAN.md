# FEAT: Shift Swap Requests — Execution Masterplan

> **Created:** 2026-04-03
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planning)
> **Branch:** `feat/swaprequest`
> **Author:** Simon Öztürk (Staff Engineer)
> **Estimated Sessions:** 8
> **Actual Sessions:** 0 / 8

---

## Changelog

| Version | Date       | Change                                    |
| ------- | ---------- | ----------------------------------------- |
| 0.1.0   | 2026-04-03 | Initial Draft — Phases 1-6 planned        |
| 0.2.0   | 2026-04-03 | Fixed C1-C2, M1-M5, m1-m6 from validation |

---

## Feature Summary

Shift swap requests allow team members to swap their assigned shifts with each other.

**Core Flow:**

1. User A sees User B's shift on `/shifts` → clicks the employee card
2. Swap modal opens with pre-populated data (both users' shifts, date, scope selector)
3. User A submits → request created with status `pending_partner`
4. User B sees pending request on `/shifts` → accepts or declines
5. If User B accepts → status changes to `pending_approval`, approval entry created for Team Lead
6. Team Lead approves via `/manage-approvals` → status `approved`, shifts get swapped in DB
7. Both users see updated schedule

**Constraints:**

- Swap only within same team
- Gegenseitiger Tausch (A↔B, both directions)
- 2-step approval: User B consent → Team Lead approval
- Scoped to: single day, whole week, or date range
- Tenant-level toggle: `swapRequestsEnabled` in `tenants.settings` JSONB
- Belongs to `shift_planning` addon (no separate addon)

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (all containers healthy)
- [ ] DB Backup created before Phase 1
- [ ] Branch `feat/swaprequest` checked out
- [ ] No pending migrations
- [ ] Scope-based shifts refactor merged (current session's work)
- [ ] Approvals system functional (`/manage-approvals` working)

### 0.2 Risk Register

| #   | Risk                                                        | Impact | Likelihood | Mitigation                                                     | Verification                                            |
| --- | ----------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| R1  | Legacy table drop loses FK references                       | High   | Low        | Verify 0 rows + no other tables reference it before DROP       | `SELECT COUNT(*) FROM shift_swap_requests` = 0          |
| R2  | Shift swap creates inconsistent plan state                  | High   | Medium     | Wrap swap execution in transaction; validate both shifts exist | Unit test: swap with deleted shift → rollback           |
| R3  | Race condition: two swaps for same shift                    | High   | Medium     | `SELECT ... FOR UPDATE` on both shifts before swap             | Unit test: parallel swap → ConflictException            |
| R4  | User B consent UI blocks shift page rendering               | Medium | Low        | Separate component (`SwapConsentBanner.svelte`), lazy loaded   | Component renders independently of main grid            |
| R5  | Approval bridge event mismatch                              | Medium | Medium     | Strict `source_entity_type` matching + integration test        | API test: create swap → approve → verify shifts swapped |
| R6  | Shift deleted while swap pending                            | High   | Medium     | ON DELETE RESTRICT on shift FKs — blocks deletion              | Unit test: delete shift with pending swap → FK error    |
| R7  | Week/range scope with gaps (user has no shift on some days) | Medium | High       | Validate at creation: count matching shifts for both users     | Unit test: range with gap → BadRequestException         |

### 0.3 Ecosystem Integration Points

| Existing System     | Integration                                                  | Phase |
| ------------------- | ------------------------------------------------------------ | ----- |
| Approvals           | `source_entity_type: 'shift_swap_request'` via bridge        | 2     |
| Approval Config     | Runtime: create config on first swap if missing (per-tenant) | 2     |
| EventBus            | `approval.decided` → trigger shift swap execution            | 2     |
| SSE / Notifications | Notify User B on new request, both users on decision         | 6     |
| Tenant Settings     | `swapRequestsEnabled` toggle in `tenants.settings`           | 2     |
| Shifts Page         | Click handler on employee cards + consent banner             | 5     |
| Manage Approvals    | Swap requests appear with `addon_code='shift_planning'`      | 5     |

---

## Phase 1: Database Migrations

> **Dependency:** None (first phase)
> **Files:** 1 migration file

### Step 1.1: Drop Legacy + Create New Table ✅ DONE

**New File:** `database/migrations/{timestamp}_recreate-shift-swap-requests.ts`

**What happens:**

1. **down() safety:** Verify `shift_swap_requests` has 0 rows
2. **Drop legacy:** `DROP TABLE shift_swap_requests`, `DROP TYPE shift_swap_requests_status`
3. **Create new ENUMs:**
   ```sql
   CREATE TYPE swap_request_scope AS ENUM ('single_day', 'week', 'date_range');
   CREATE TYPE swap_request_status AS ENUM (
       'pending_partner',
       'pending_approval',
       'approved',
       'rejected',
       'cancelled'
   );
   ```
4. **Create new table:**

   ```sql
   CREATE TABLE shift_swap_requests (
       -- PK: gen_random_uuid() as DB default (v4); app layer generates UUIDv7
       uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
       -- Requester (who initiates the swap)
       requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
       requester_shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
       -- Target (swap partner)
       target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
       target_shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
       -- Context
       team_id INTEGER NOT NULL REFERENCES teams(id),
       swap_scope swap_request_scope NOT NULL DEFAULT 'single_day',
       start_date DATE NOT NULL,
       end_date DATE NOT NULL,
       -- Status flow: pending_partner → pending_approval → approved/rejected/cancelled
       status swap_request_status NOT NULL DEFAULT 'pending_partner',
       reason TEXT,
       -- Partner response
       partner_responded_at TIMESTAMPTZ,
       partner_note TEXT,
       -- Link to approvals table (CHAR(36) matches approvals.uuid type)
       approval_uuid CHAR(36),
       -- Standard columns
       is_active SMALLINT NOT NULL DEFAULT 1,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

   **FK design decisions (from validation):**
   - `shifts FK → ON DELETE RESTRICT`: prevents silent deletion of shifts with pending swaps (R6)
   - `users FK → ON DELETE SET NULL`: preserves swap history when users are deleted
   - `approval_uuid CHAR(36)`: matches `approvals.uuid` column type (not UUID type)
   - `requester_shift_id` / `target_shift_id` are "anchor" shifts (the trigger pair).
     For `week`/`date_range` scope, `executeSwap` queries all shifts for both users
     within `start_date`–`end_date` and validates at execution time.

5. **updated_at trigger** (standard pattern):
   ```sql
   CREATE TRIGGER update_shift_swap_requests_updated_at
     BEFORE UPDATE ON shift_swap_requests
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
   ```
6. **RLS + Grants + Indexes** (standard pattern)

**Mandatory checklist:**

- [ ] UUID PK (UUIDv7)
- [ ] `tenant_id` with FK + ON DELETE CASCADE
- [ ] RLS enabled + forced + policy with NULLIF pattern
- [ ] GRANT SELECT, INSERT, UPDATE, DELETE to app_user
- [ ] `is_active` column
- [ ] Partial indexes with `WHERE is_active = 1`
- [ ] `up()` AND `down()` implemented
- [ ] Dry-run passes

### Phase 1 — Definition of Done

- [ ] 1 migration file with `up()` and `down()`
- [ ] Dry-run passes: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [ ] Migration applied successfully
- [ ] New table exists with RLS policy
- [ ] Legacy table + enum dropped
- [ ] updated_at trigger created
- [ ] Backend compiles: `docker exec assixx-backend pnpm run type-check`
- [ ] Existing tests pass: `pnpm run test:api`
- [ ] Backup created before migration

---

## Phase 2: Backend Module

> **Dependency:** Phase 1 complete
> **Reference:** `backend/src/nest/shifts/shift-swap.service.ts` (rewrite)

### Step 2.1: Tenant Setting — `swapRequestsEnabled` ✅ DONE

**Files:**

- `backend/src/nest/organigram/organigram-settings.service.ts` — add get/update methods
- `backend/src/nest/organigram/organigram.controller.ts` — add GET/PATCH endpoints

**Methods:**

- `getSwapRequestsEnabled(tenantId): Promise<boolean>` — reads from `tenants.settings` JSONB
- `updateSwapRequestsEnabled(tenantId, enabled): Promise<boolean>` — read-merge-write pattern

**Endpoints:**

- `GET /organigram/swap-requests-enabled` — any authenticated user
- `PATCH /organigram/swap-requests-enabled` — `@Roles('root')` only

### Step 2.2: Types + DTOs ✅ DONE

**Files:**

- `backend/src/nest/shifts/shift-swap.types.ts` — DB row types, response types
- `backend/src/nest/shifts/dto/create-swap-request.dto.ts` — rewrite
- `backend/src/nest/shifts/dto/respond-swap-request.dto.ts` — NEW (partner consent)
- `backend/src/nest/shifts/dto/query-swap-requests.dto.ts` — extend

**Key Types:**

```typescript
interface SwapRequestRow {
  uuid: string;
  tenant_id: number;
  requester_id: number;
  requester_shift_id: number;
  target_id: number;
  target_shift_id: number;
  team_id: number;
  swap_scope: 'single_day' | 'week' | 'date_range';
  start_date: string;
  end_date: string;
  status: SwapRequestStatus;
  reason: string | null;
  partner_responded_at: string | null;
  partner_note: string | null;
  approval_uuid: string | null;
  is_active: number;
}

type SwapRequestStatus = 'pending_partner' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
```

### Step 2.3: ShiftSwapService Rewrite ✅ DONE

**File:** `backend/src/nest/shifts/shift-swap.service.ts`

**Methods:**

| Method                                                          | Description                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `createSwapRequest(dto, tenantId, requesterId)`                 | Validate both shifts exist + same team + setting enabled; INSERT; notify target |
| `respondToSwapRequest(uuid, tenantId, targetId, accept, note?)` | Partner consent; if accepted → create approval entry for team lead              |
| `listSwapRequests(tenantId, filters)`                           | Query with JOINs for user/shift names                                           |
| `getSwapRequestByUuid(uuid, tenantId)`                          | Single request detail                                                           |
| `cancelSwapRequest(uuid, tenantId, requesterId)`                | Only requester can cancel; only if `pending_partner`                            |
| `executeSwap(uuid, tenantId)`                                   | Called when approval approved; swap `user_id` on shifts; transactional          |
| `getMyPendingConsents(tenantId, userId)`                        | Swap requests where user is target + status=pending_partner                     |

**Critical:** `createSwapRequest` must:

1. Check `swapRequestsEnabled` setting → ForbiddenException if disabled
2. Validate both shifts exist, same team, not self-swap
3. For `week`/`date_range` scope: count matching shifts for both users in range → BadRequestException if gaps
4. Ensure `approval_configs` entry exists for `shift_planning` + `team_lead`; create on-the-fly if missing (C2 fix — configs are per-tenant, cannot be seeded in migrations)

**Critical:** `executeSwap` must:

1. Lock both shifts with `SELECT ... FOR UPDATE`
2. Swap `user_id` between all affected shifts in the date range
3. Handle week/range scope (query all shifts for both users in range)
4. Run in single transaction
5. Update swap request status to `approved`

### Step 2.4: SwapApprovalBridge Service ✅ DONE

**File:** `backend/src/nest/shifts/swap-approval-bridge.service.ts`

**Purpose:** Bridge between swap requests and generic approvals system.

**Methods:**

- `createApprovalForSwap(swapUuid, tenantId, requesterId)` — creates approval entry with `addon_code='shift_planning'`, `source_entity_type='shift_swap_request'`
- `onApprovalDecided(approvalUuid, status)` — EventBus listener; calls `executeSwap` on approval, updates swap status on rejection

**EventBus subscription:** `approval.decided` → check if `source_entity_type === 'shift_swap_request'`

### Step 2.5: Controller Endpoints ✅ DONE

**File:** `backend/src/nest/shifts/shifts.controller.ts` (extend swap section)

| Method | Route                                      | Permission          | Description                       |
| ------ | ------------------------------------------ | ------------------- | --------------------------------- |
| GET    | `/shifts/swap-requests`                    | shift-swap.canRead  | List (with filters)               |
| POST   | `/shifts/swap-requests`                    | shift-swap.canWrite | Create swap request               |
| GET    | `/shifts/swap-requests/my-consents`        | shift-swap.canRead  | Pending consents for current user |
| GET    | `/shifts/swap-requests/uuid/:uuid`         | shift-swap.canRead  | Single request detail             |
| POST   | `/shifts/swap-requests/uuid/:uuid/respond` | shift-swap.canWrite | Partner consent (accept/decline)  |
| POST   | `/shifts/swap-requests/uuid/:uuid/cancel`  | shift-swap.canWrite | Cancel own request                |

### Phase 2 — Definition of Done

- [ ] Tenant setting endpoints working (GET + PATCH)
- [ ] All DTOs use Zod + `createZodDto()` pattern
- [ ] ShiftSwapService rewritten with all 7 methods
- [ ] SwapApprovalBridge creates approvals and handles decisions
- [ ] All endpoints have `@RequirePermission` + `@RequireAddon`
- [ ] `db.tenantTransaction()` for all tenant-scoped queries
- [ ] No `any` types, explicit return types
- [ ] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/shifts/`
- [ ] Type-check passed: `docker exec assixx-backend pnpm run type-check`

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete
> **Pattern:** `backend/src/nest/shifts/shift-swap.service.test.ts`

### Test Files

```
backend/src/nest/shifts/
    shift-swap.service.test.ts              # ~25 tests (core swap logic)
    swap-approval-bridge.service.test.ts    # ~10 tests (approval integration)
    dto/create-swap-request.dto.test.ts     # ~8 tests (DTO validation)
    dto/respond-swap-request.dto.test.ts    # ~5 tests (DTO validation)
```

### Critical Test Scenarios

**Business Logic:**

- [ ] Happy path: create → partner accept → team lead approve → shifts swapped
- [ ] Partner declines → status `rejected`, no approval created
- [ ] Team lead rejects → status `rejected`, shifts unchanged
- [ ] Cancel by requester → only allowed in `pending_partner` status
- [ ] Self-swap prevention → BadRequestException
- [ ] Cross-team swap prevention → BadRequestException
- [ ] Setting disabled → ForbiddenException

**Edge Cases:**

- [ ] Swap when one user has no shift on target date → BadRequestException
- [ ] Week scope: swap 7 days of shifts correctly
- [ ] Shift deleted while swap pending → handle gracefully
- [ ] Duplicate swap request for same shifts → ConflictException

**Race Conditions:**

- [ ] Two swaps targeting same shift simultaneously → only one succeeds
- [ ] Approval arrives after swap cancelled → no-op

**Data Integrity:**

- [ ] `user_id` correctly swapped on both shifts after execution
- [ ] Swap with date_range scope affects exactly the right shifts
- [ ] Tenant isolation: Tenant A cannot see Tenant B's swaps

### Phase 3 — Definition of Done

- [ ] > = 48 unit tests total
- [ ] All tests green
- [ ] Every error path (Conflict, BadRequest, Forbidden, NotFound) covered
- [ ] Race condition tested
- [ ] Coverage: all public methods have at least 1 test

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete
> **File:** `backend/test/shift-swap.api.test.ts`

### Scenarios (>= 15 Assertions)

**Auth & Addon:**

- [ ] Unauthenticated → 401
- [ ] Addon disabled → 403

**CRUD:**

- [ ] POST swap request → 201
- [ ] POST self-swap → 400
- [ ] GET my-consents → 200 (array)
- [ ] POST respond (accept) → 200
- [ ] POST respond (decline) → 200
- [ ] POST cancel → 200
- [ ] GET by uuid → 200

**Setting:**

- [ ] GET swap-requests-enabled → 200
- [ ] PATCH swap-requests-enabled → 200 (root only)

### Phase 4 — Definition of Done

- [ ] > = 15 API integration tests
- [ ] All tests green
- [ ] Tenant setting toggle verified
- [ ] Swap lifecycle (create → consent → approve) verified end-to-end

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete (backend endpoints available)
> **Reference:** Existing shifts page components

### Step 5.1: Tenant Setting Toggle ✅ DONE

**File:** `frontend/src/routes/(app)/(root)/settings/company/+page.svelte` (extend)

- Add "Schichttausch" section with toggle checkbox
- Fetch `GET /organigram/swap-requests-enabled` in `+page.server.ts`
- `PATCH /organigram/swap-requests-enabled` on toggle

### Step 5.2: SwapRequestModal Component ✅ DONE

**File:** `frontend/src/routes/(app)/(shared)/shifts/_lib/SwapRequestModal.svelte`

**Props:**

- `targetShift: { userId, date, shiftType, userName }`
- `requesterShifts: Shift[]` (current user's shifts on that date)
- `onclose, onsubmit`

**UI:**

- Shows target user + their shift
- Shows requester's shift on same date (auto-selected)
- Scope selector: "Nur diesen Tag" / "Ganze Woche" / "Zeitraum" (date picker)
- Reason textarea (optional)
- Submit button

### Step 5.3: Swap API Client Functions ✅ DONE

**File:** `frontend/src/routes/(app)/(shared)/shifts/_lib/api.ts` (extend)

**Functions:**

- `createSwapRequest(dto)` → `POST /shifts/swap-requests`
- `respondToSwapRequest(uuid, accept, note?)` → `POST /shifts/swap-requests/uuid/:uuid/respond`
- `cancelSwapRequest(uuid)` → `POST /shifts/swap-requests/uuid/:uuid/cancel`
- `fetchMyPendingConsents()` → `GET /shifts/swap-requests/my-consents`
- `fetchSwapRequestsEnabled()` → `GET /organigram/swap-requests-enabled`

### Step 5.4: Employee Card Click Handler ✅ DONE

**File:** `frontend/src/routes/(app)/(shared)/shifts/_lib/ShiftScheduleGrid.svelte` (extend)

- Add `onclick` handler on `.employee-assignment` / `.employee-card` elements within shift cells
- Verify actual DOM structure before implementing (class names may differ from spec)
- If clicking own shift → show warning toast
- If clicking another user's shift → open SwapRequestModal
- Only active when `swapRequestsEnabled` is true AND user is NOT a manager (regular employee view)

### Step 5.5: SwapConsentBanner Component ✅ DONE

**File:** `frontend/src/routes/(app)/(shared)/shifts/_lib/SwapConsentBanner.svelte`

**Purpose:** Shows pending swap requests where current user is the target.

- Fetches `GET /shifts/swap-requests/my-consents` on mount
- Displays a dismissible banner at top of shifts page
- Each request shows: requester name, shift details, accept/decline buttons
- Accept → `POST /swap-requests/uuid/:uuid/respond` with `{ accept: true }`
- Decline → prompt for note, then respond with `{ accept: false, note }`

### Step 5.6: Shifts Page Integration ✅ DONE

**File:** `frontend/src/routes/(app)/(shared)/shifts/+page.svelte` (extend)

- Add `SwapConsentBanner` component (top of card body, below filters)
- Pass `swapRequestsEnabled` from server data
- Conditionally render swap UI elements based on setting

### Phase 5 — Definition of Done

- [ ] Settings toggle works (root only)
- [ ] SwapRequestModal opens on employee card click
- [ ] Self-swap shows warning
- [ ] Scope selector (day/week/range) works
- [ ] SwapConsentBanner shows pending requests
- [ ] Accept/decline triggers API call
- [ ] svelte-check 0 errors
- [ ] ESLint 0 errors
- [ ] German labels everywhere

---

## Phase 6: Integration + Polish

> **Dependency:** Phase 5 complete

### Integrations

- [ ] SSE notifications: User B gets notified on new swap request
- [ ] SSE notifications: Both users get notified on decision
- [ ] Manage Approvals page: swap requests filter working (`addon_code='shift_planning'`)
- [ ] Activity logging: all swap actions logged

### Documentation

- [ ] ADR written (if architectural decisions were made)
- [ ] FEATURES.md updated

### Phase 6 — Definition of Done

- [ ] All integrations work end-to-end
- [ ] Manual test: full lifecycle (create → consent → approve → shifts swapped)
- [ ] No open issues

---

## Session Tracking

| Session | Phase | Description                                | Status | Date       |
| ------- | ----- | ------------------------------------------ | ------ | ---------- |
| 1       | 1     | Migration: drop legacy + create new table  | DONE   | 2026-04-03 |
| 2       | 2     | Tenant setting + Types + DTOs              |        |            |
| 3       | 2     | ShiftSwapService rewrite                   | DONE   | 2026-04-03 |
| 4       | 2     | SwapApprovalBridge + Controller endpoints  | DONE   | 2026-04-03 |
| 5       | 3     | Unit tests (41 new swap tests, 317 total)  | DONE   | 2026-04-03 |
| 6       | 4     | API integration tests (12 tests)           | DONE   | 2026-04-03 |
| 7       | 5     | Frontend: Modal + Grid click + Consent     | DONE   | 2026-04-03 |
| 8       | 6     | Integration: Approvals filter, FEATURES.md | DONE   | 2026-04-03 |

---

## Quick Reference: File Paths

### Backend (new/modified)

| File                                                         | Purpose                                               |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `backend/src/nest/shifts/shift-swap.service.ts`              | Rewrite: core swap logic                              |
| `backend/src/nest/shifts/shift-swap.types.ts`                | New: DB row + response types                          |
| `backend/src/nest/shifts/swap-approval-bridge.service.ts`    | New: approval integration                             |
| `backend/src/nest/shifts/shifts.service.ts`                  | Modify: facade delegates to new swap service          |
| `backend/src/nest/shifts/shifts.types.ts`                    | Modify: update SwapRequestResponse + DbSwapRequestRow |
| `backend/src/nest/shifts/dto/create-swap-request.dto.ts`     | Rewrite: new fields                                   |
| `backend/src/nest/shifts/dto/respond-swap-request.dto.ts`    | New: partner consent DTO                              |
| `backend/src/nest/shifts/dto/swap-request-status.dto.ts`     | Rewrite: new status enum                              |
| `backend/src/nest/shifts/dto/common.dto.ts`                  | Modify: SwapRequestStatusSchema enum values           |
| `backend/src/nest/shifts/shifts.controller.ts`               | Extend: new endpoints                                 |
| `backend/src/nest/organigram/organigram-settings.service.ts` | Extend: setting                                       |
| `backend/src/nest/organigram/organigram.controller.ts`       | Extend: setting endpoints                             |

### Backend (test files — rewrite existing)

| File                                                           | Purpose                        |
| -------------------------------------------------------------- | ------------------------------ |
| `backend/src/nest/shifts/shift-swap.service.test.ts`           | Rewrite: match new service     |
| `backend/src/nest/shifts/swap-approval-bridge.service.test.ts` | New: bridge tests              |
| `backend/src/nest/shifts/dto/create-swap-request.dto.test.ts`  | May need update for new fields |
| `backend/test/shift-swap.api.test.ts`                          | New: API integration tests     |

### Database (new)

| File                                                       | Purpose         |
| ---------------------------------------------------------- | --------------- |
| `database/migrations/{ts}_recreate-shift-swap-requests.ts` | Drop + recreate |

### Frontend (new/modified)

| Path                                                                      | Purpose                |
| ------------------------------------------------------------------------- | ---------------------- |
| `frontend/src/routes/(app)/(shared)/shifts/_lib/SwapRequestModal.svelte`  | New: swap modal        |
| `frontend/src/routes/(app)/(shared)/shifts/_lib/SwapConsentBanner.svelte` | New: consent UI        |
| `frontend/src/routes/(app)/(shared)/shifts/_lib/ShiftScheduleGrid.svelte` | Extend: click handler  |
| `frontend/src/routes/(app)/(shared)/shifts/+page.svelte`                  | Extend: banner + state |
| `frontend/src/routes/(app)/(shared)/shifts/+page.server.ts`               | Extend: load setting   |
| `frontend/src/routes/(app)/(root)/settings/company/+page.svelte`          | Extend: toggle         |

---

## Spec Deviations

| #   | Spec says                           | Actual code              | Decision                                                                                        |
| --- | ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| D1  | Legacy `shift_swap_requests` reuse  | Drop + recreate          | Legacy has no UUID, no is_active, wrong FKs — 0 rows, never used                                |
| D2  | `uuid_generate_v7()` for PK default | `gen_random_uuid()` (v4) | pg_uuidv7 extension not installed; app layer generates UUIDv7 (existing pattern)                |
| D3  | Approval config seeded in migration | Created at runtime       | `approval_configs` is per-tenant; migration can't know which tenants exist                      |
| D4  | New `shift-swap` permission module  | Already exists           | `shifts.permissions.ts` already registers `shift-swap` with canRead/canWrite — no work needed   |
| D5  | New test files                      | Rewrite existing         | `shift-swap.service.test.ts`, `shifts.dto.test.ts` already exist — rewrite, not create          |
| D6  | `requester_id`/`target_id` NOT NULL | Nullable (no NOT NULL)   | `NOT NULL + ON DELETE SET NULL` is contradictory — SET NULL needs nullable column               |
| D7  | Approval in service                 | Approval in controller   | Avoids circular dep: Bridge → SwapService → Bridge. Controller orchestrates as composition root |
| D8  | SSE on approval decision            | Not yet implemented      | Phase 6 item — requires SSE event for both users on approve/reject                              |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Cross-team swaps** — V1 only supports same-team swaps. Cross-team would require dual team-lead approval.
2. **Partial week swaps** — V1 scope is day/week/range. "Swap only Mon+Wed" requires per-day selection UI (future).
3. **Swap chain** — If A↔B and B↔C are both pending, no conflict detection. V1 relies on `FOR UPDATE` locks at execution time.
4. **Auto-matching** — No "swap marketplace" where users post availability. V1 is direct user-to-user.
5. **Recurring swaps** — No "swap every Monday" pattern. Each swap is one-time.

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- (TBD)

### Was lief schlecht

- (TBD)

### Metriken

| Metrik                    | Geplant | Tatsächlich |
| ------------------------- | ------- | ----------- |
| Sessions                  | 8       |             |
| Migrationsdateien         | 1       |             |
| Neue Backend-Dateien      | 4       |             |
| Neue Frontend-Dateien     | 3       |             |
| Geänderte Dateien         | 10      |             |
| Unit Tests                | 48      |             |
| API Tests                 | 15      |             |
| ESLint Errors bei Release | 0       |             |
| Spec Deviations           | 5       |             |
