# FEAT: KVP Approval Integration — Execution Masterplan

> **Created:** 2026-03-20
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planning)
> **Branch:** `refactor/KVP`
> **ADR:** [ADR-037](./infrastructure/adr/ADR-037-approvals-architecture.md) (Approvals), [ADR-038](./infrastructure/adr/ADR-038-position-catalog-architecture.md) (Position Catalog), [ADR-004](./infrastructure/adr/ADR-004-persistent-notification-counts.md) (Persistent Notifications), [ADR-018](./infrastructure/adr/ADR-018-testing-strategy.md) (Testing Strategy)
> **Depends on:** Approvals System (Phase 1-4 DONE), Position Catalog (All Phases DONE)
> **Related Plans:** [FEAT_APPROVALS_SYSTEM_MASTERPLAN.md](./FEAT_APPROVALS_SYSTEM_MASTERPLAN.md) (Phase 5 = this plan), [FEAT_POSITION_CATALOG_MASTERPLAN.md](./FEAT_POSITION_CATALOG_MASTERPLAN.md) (Position-based approval masters)
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 4
> **Actual Sessions:** 0 / 4

---

## Changelog

| Version | Date       | Change                                        |
| ------- | ---------- | --------------------------------------------- |
| 0.1.0   | 2026-03-20 | Initial Draft — 4 phases, 4 sessions planned  |
| 0.1.1   | 2026-03-20 | Added: ADR-004 persistent notifications (Step 1.5), ADR-018 test reference, Related Documents section, linked parent masterplans |
| 0.2.0   | 2026-03-21 | Real-Life Workflow documented, TBD resolved: dynamic dropdown rules, CRON archives BOTH rejected+implemented, `status='archived'` (no is_active on kvp_suggestions) |

---

## Problem Statement

KVP suggestions are currently approved/rejected **directly by Team Leads** via a status dropdown on the detail page. There is no formal approval workflow — no configured approval masters, no binding approval decisions, no position-based approval routing.

The Approvals System (ADR-037) and Position Catalog (ADR-038) were built specifically to enable this: a tenant configures a **KVP Master** (e.g. position "Qualitätsmanager") as approval master for addon `kvp`. Team Leads curate KVP suggestions and **request formal approval** from the configured masters. The approval decision is **binding** — it automatically syncs to the KVP status.

**Goal:** Connect KVP as the first consumer of the Approvals System. Team Lead requests approval → KVP Master decides → KVP status auto-syncs.

---

## Real-Life Workflow (Example)

**Setup:** KVP "Lichtschranke" (UUID `019ceec8-...`), submitted by John Doe (Team Linie 99). KVP Master: Jürgen Schmitz (User 30), configured via `/settings/approvals` for addon `kvp`.

**Actors:**
- **John Doe** — Team member, submitted the KVP suggestion
- **Corc Öztürk** — Team Lead of Linie 99, sees the KVP on `/kvp-detail`
- **Jürgen Schmitz** — KVP Master (approval master), sees pending approvals on `/manage-approvals`

**Visibility (unshared KVP):** Only author (John Doe), Team Lead + Deputy Lead (Corc Öztürk), and users with `has_full_access = true`. Department/Area Leads do NOT see unshared KVPs.

### Step-by-Step Flow

```
1. John Doe (employee) creates KVP "Lichtschranke"
   → Status: "offen" (new)
   → Visible to: John Doe, Corc Öztürk (Team Lead), has_full_access users

2. Corc Öztürk (Team Lead) opens KVP detail page
   → Reads description, discusses in comment section
   → Dropdown shows: "offen", "abgelehnt" (NO "genehmigt" — blocked by approval config)
   → Sidebar shows: "Freigabe anfordern" button (in Aktionen card)

3a. BAD KVP → Corc sets status directly to "abgelehnt" via dropdown
   → No approval needed for rejection
   → Status: "abgelehnt" → LOCKED (no further changes)
   → After 30 days: CRON archives (is_active = 4)

3b. GOOD KVP → Corc clicks "Freigabe anfordern"
   → Status auto-changes to "in Prüfung" (in_review)
   → Dropdown: LOCKED (nobody can change status manually)
   → Approval request created → appears in /manage-approvals
   → Jürgen Schmitz receives notification (SSE + persistent DB)

4. Jürgen Schmitz (KVP Master) opens /manage-approvals
   → Sees "Lichtschranke" approval request
   → Reviews, decides:

   4a. APPROVE → Status auto-syncs to "genehmigt" (approved)
      → Corc Öztürk receives notification
      → Dropdown unlocks: only "umgesetzt" available
      → Corc sets to "umgesetzt" when implementation is complete
      → After 30 days: CRON archives (is_active = 4)

   4b. REJECT → Status auto-syncs to "abgelehnt" (rejected) with reason
      → Corc Öztürk receives notification with rejection reason
      → LOCKED — no re-submission allowed
      → John Doe must create a new KVP if desired
      → After 30 days: CRON archives (is_active = 4)
```

### Dynamic Dropdown Rules (when approval config exists for KVP)

| Current Status | Dropdown Options | "Freigabe anfordern" Button | Rationale |
| --- | --- | --- | --- |
| `new` (offen) | `abgelehnt` only | visible | Team Lead curates: reject bad, request approval for good |
| `in_review` (in Prüfung) | LOCKED | hidden | Waiting for master decision — no manual override |
| `approved` (genehmigt) | `umgesetzt` only | hidden | Master approved — Team Lead confirms implementation |
| `rejected` (abgelehnt) | LOCKED | hidden | Final — no re-submission, CRON archives after 30 days |
| `implemented` (umgesetzt) | LOCKED | hidden | Final — CRON archives after 30 days |

> **Without approval config:** Old behavior — all status options available in dropdown, no "Freigabe anfordern" button.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (all containers healthy)
- [ ] DB Backup created
- [ ] Approvals system fully functional (Phases 1-4 of Approvals Masterplan DONE)
- [ ] Position Catalog fully functional (All 5 phases DONE)
- [ ] `approval_approver_type` ENUM contains `'position'` value
- [ ] `position_catalog` table exists with system positions seeded
- [ ] Branch checked out
- [ ] No pending migrations

### 0.2 Risk Register

| #   | Risk                                       | Impact | Probability | Mitigation                                                       | Verification                                                     |
| --- | ------------------------------------------ | ------ | ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| R1  | EventBus event missed (server restart)     | High   | Low         | Startup reconciliation: check in_review KVPs against approvals   | Unit test: simulate missed event → reconcile catches it          |
| R2  | Double approval request for same KVP       | Medium | Medium      | DB query: EXISTS check before creating                           | API test: second request → 409 ConflictException                 |
| R3  | KVP status out of sync with approval       | High   | Low         | EventBus + startup reconciliation + idempotent status sync       | E2E test: approve → verify KVP status = 'approved'               |
| R4  | No approval config for 'kvp' → button UX   | Low    | High        | Hide button when no approval config exists for addon 'kvp'       | Frontend check: button hidden when hasApprovalConfig = false     |
| R5  | CRON archives KVP with pending approval    | High   | Low         | CRON only targets `status IN ('rejected', 'implemented')`        | Unit test: pending/in_review/approved KVP not touched by CRON    |
| R6  | Self-approval (Team Lead is also KVP Master)| Medium | Medium     | Already enforced by ApprovalsService: `requested_by !== decided_by` | Existing unit test covers this                                  |

### 0.3 Ecosystem Integration Points

| Existing System              | Integration Type                                                    | Phase |
| ---------------------------- | ------------------------------------------------------------------- | ----- |
| `ApprovalsService`           | `create()` — create approval request from KVP                      | 1     |
| `ApprovalsConfigService`     | `resolveApprovers('kvp', userId)` — check if config exists          | 1     |
| EventBus `approval.decided`  | Subscribe → sync KVP status on approval decision                   | 1     |
| KVP status lifecycle         | `in_review` → `approved` / `rejected` (auto-sync)                  | 1     |
| `@nestjs/schedule`           | New CRON: archive rejected KVPs after 30 days                      | 1     |
| KVP Detail Sidebar           | "Freigabe anfordern" button for Team Lead                          | 3     |
| KVP Detail Page              | Approval status badge (pending/approved/rejected)                  | 3     |
| KVP Detail `+page.server.ts` | Fetch approval data alongside suggestion                           | 3     |
| SSE Notifications            | Already handled by Approvals SSE events (`approval.created`, `approval.decided`) | —     |
| Persistent Notifications     | DB notifications for offline users (ADR-004 dual-pattern)          | 1     |
| `NotificationsService`       | `createAddonNotification()` for KVP approval masters + requester   | 1     |

---

## Phase 1: Backend — KVP-Approval Bridge

> **Dependency:** None (Approvals + Position Catalog already complete)
> **Key insight:** No DB migration needed. All tables exist. This is pure service-layer integration.

### Step 1.1: KvpApprovalService [PENDING]

**New file:** `backend/src/nest/kvp/kvp-approval.service.ts`

**Why separate service:** Follows existing KVP pattern (kvp-lifecycle, kvp-comments, kvp-attachments are all separate services). Keeps approval logic isolated from core KVP CRUD.

**Methods:**

- `requestApproval(tenantId, suggestionUuid, requestedBy)` — Create approval request
  - Validates: suggestion exists, is active, status allows approval request
  - Checks: no existing approval for this KVP (ANY status — no re-submission)
  - Resolves approvers via `ApprovalsConfigService.resolveApprovers('kvp', requestedBy)`
  - Creates approval via `ApprovalsService.create()` with `addon_code='kvp'`, `source_entity_type='kvp_suggestion'`
  - Updates KVP status to `'in_review'`
  - Returns created approval

- `getApprovalForSuggestion(tenantId, suggestionUuid)` — Fetch linked approval
  - Query: `SELECT * FROM approvals WHERE addon_code = 'kvp' AND source_uuid = $1 AND tenant_id = $2 AND is_active = 1`
  - Returns approval object or `null`

- `hasApprovalConfig(tenantId)` — Check if approval master configured for KVP
  - Calls `ApprovalsConfigService.resolveApprovers('kvp', 0)` or direct config check
  - Returns `boolean` — used by frontend to show/hide button

- `handleApprovalDecision(addonCode, sourceUuid, status, decisionNote, tenantId)` — Sync KVP status
  - Called by EventBus listener (Step 1.3)
  - If `status === 'approved'`: update KVP status to `'approved'`
  - If `status === 'rejected'`: update KVP status to `'rejected'`, set `rejection_reason = decisionNote`
  - Idempotent: no-op if KVP already has matching status

- `reconcilePendingApprovals()` — Startup recovery
  - Find KVPs with `status = 'in_review'` that have a decided approval
  - Sync their status (catch missed EventBus events from server downtime)
  - Called from `onModuleInit()`

**Dependencies:** `ApprovalsService`, `ApprovalsConfigService`, `DatabaseService`, `ActivityLoggerService`

**Module change:** `kvp.module.ts` — add `ApprovalsModule` to imports

### Step 1.2: Controller Endpoints [PENDING]

**Modified file:** `backend/src/nest/kvp/kvp.controller.ts`

| Method | Route                          | Permission           | Description                |
| ------ | ------------------------------ | -------------------- | -------------------------- |
| POST   | `/kvp/:uuid/request-approval`  | kvp-manage.canWrite  | Request approval from master |
| GET    | `/kvp/:uuid/approval`          | kvp.canRead          | Get linked approval status |
| GET    | `/kvp/approval-config-status`  | kvp.canRead          | Check if approval config exists |

**POST /kvp/:uuid/request-approval:**
- Only Team Lead / Admin / Root
- Validates: no pending/decided approval exists for this KVP
- Returns 201 + approval object

**GET /kvp/:uuid/approval:**
- Returns approval object or `{ approval: null }` if none exists
- Includes: status, requestedBy, decidedBy, decisionNote, timestamps

**GET /kvp/approval-config-status:**
- Returns `{ hasConfig: boolean }`
- Used by frontend to show/hide "Freigabe anfordern" button
- Static route BEFORE `/:uuid` routes (Fastify route ordering)

### Step 1.3: EventBus Subscription [PENDING]

**Modified file:** `backend/src/nest/kvp/kvp-approval.service.ts`

**Pattern:** Subscribe in constructor (same as existing SSE handlers):

```typescript
constructor(/* deps */) {
  eventBus.on('approval.decided', (data) => {
    if (data.addonCode === 'kvp') {
      void this.handleApprovalDecision(
        data.addonCode, data.sourceUuid, data.status, data.decisionNote, data.tenantId,
      );
    }
  });
}
```

**Startup recovery:** `onModuleInit()` calls `reconcilePendingApprovals()`

### Step 1.4: CRON — Archive Rejected KVPs [PENDING]

**New file:** `backend/src/nest/kvp/kvp-approval-archive-cron.service.ts`

**Pattern:** Follows blackboard-archive.service.ts

```typescript
@Cron('1 0 * * *', { name: 'kvp-final-archive', timeZone: 'Europe/Berlin' })
async archiveFinalKvps(): Promise<void> {
  // UPDATE kvp_suggestions SET status = 'archived'
  // WHERE status IN ('rejected', 'implemented')
  //   AND updated_at < NOW() - INTERVAL '30 days'
}
```

> **Note:** `kvp_suggestions` has NO `is_active` column (verified in DB schema).
> Archival uses `status = 'archived'` — consistent with existing KVP status enum.
> The Blackboard pattern uses `is_active` because blackboard_entries HAS that column.

**Schedules:**
- Primary: Daily at 00:01 (Europe/Berlin)
- Startup: `onModuleInit()` recovery

**Both `rejected` AND `implemented`** KVPs are archived after 30 days.

### Step 1.5: Persistent Notifications (ADR-004) [PENDING]

**Modified file:** `backend/src/nest/kvp/kvp-approval.service.ts`

**ADR-004 Dual-Pattern:** EventBus = real-time SSE (online users). DB notifications = persistent storage (offline users, badge counts on page load). Both are needed.

**When approval is REQUESTED (Team Lead → KVP Masters):**
- SSE: Already emitted by `ApprovalsService` via `approval.created` event
- Persistent: Create DB notification for each resolved approver via `NotificationsService.createAddonNotification()`
- Type: `'approval'` (or extend `notification_type` ENUM if needed)
- Message: "Neue Freigabe-Anfrage: {KVP title}"
- Badge: Approvals badge count incremented for KVP masters

**When approval is DECIDED (KVP Master → Team Lead):**
- SSE: Already emitted by `ApprovalsService` via `approval.decided` event
- Persistent: Create DB notification for the requesting Team Lead
- Message (approved): "Freigabe erteilt: {KVP title}"
- Message (rejected): "Freigabe abgelehnt: {KVP title} — {reason}"
- Badge: Approvals badge count incremented for Team Lead

**Check:** Verify if `ApprovalsService` already creates persistent notifications. If yes, this step may be reduced to just verifying the flow. If not, add notification creation in `KvpApprovalService`.

### Phase 1 — Definition of Done

- [ ] `KvpApprovalService` with requestApproval + getApproval + handleDecision + reconcile
- [ ] `kvp.module.ts` imports `ApprovalsModule`
- [ ] `POST /kvp/:uuid/request-approval` endpoint functional
- [ ] `GET /kvp/:uuid/approval` endpoint functional
- [ ] `GET /kvp/approval-config-status` endpoint functional
- [ ] EventBus subscription to `approval.decided` (filtered by `addon_code='kvp'`)
- [ ] Startup reconciliation for missed events
- [ ] CRON job: rejected KVPs → `is_active = 4` after 30 days
- [ ] KvpApprovalService registered as provider in `kvp.module.ts`
- [ ] KvpApprovalArchiveCronService registered as provider in `kvp.module.ts`
- [ ] Persistent DB notifications for offline users (ADR-004 dual-pattern)
- [ ] Badge counts correct on page load (not just during SSE session)
- [ ] ESLint 0 errors
- [ ] Type-check passes
- [ ] Existing KVP tests still pass

---

## Phase 2: Unit + API Tests

> **Dependency:** Phase 1 complete
> **Reference:** [ADR-018](./infrastructure/adr/ADR-018-testing-strategy.md) — Two-Tier Testing Strategy (unit: `vi.mock()` + `createMockActivityLogger()`, API: `fetch()` + `authHeaders()`/`authOnly()`)

### Step 2.1: Unit Tests [PENDING]

**File:** `backend/src/nest/kvp/kvp-approval.service.test.ts`

**Critical test scenarios:**

- [ ] Request approval: happy path → approval created, KVP status = 'in_review'
- [ ] Request approval: no approval config → appropriate error
- [ ] Request approval: already has pending approval → ConflictException
- [ ] Request approval: already has decided approval → ConflictException (no re-submission)
- [ ] Request approval: KVP not found → NotFoundException
- [ ] Request approval: KVP is archived/deleted → BadRequestException
- [ ] Handle approved decision → KVP status = 'approved'
- [ ] Handle rejected decision → KVP status = 'rejected' + rejection_reason
- [ ] Handle decision: idempotent (already synced → no-op)
- [ ] Reconcile on startup: missed approved decision → synced
- [ ] Reconcile on startup: no missed decisions → no changes
- [ ] hasApprovalConfig: config exists → true
- [ ] hasApprovalConfig: no config → false
- [ ] Persistent notification created for KVP masters on request
- [ ] Persistent notification created for Team Lead on decision
- [ ] CRON: rejected KVP older than 30 days → status = 'archived'
- [ ] CRON: implemented KVP older than 30 days → status = 'archived'
- [ ] CRON: rejected/implemented KVP younger than 30 days → untouched
- [ ] CRON: new/in_review/approved KVP → untouched (not final states)

### Step 2.2: API Integration Tests [PENDING]

**File:** `backend/test/kvp-approval.api.test.ts`

**Scenarios (>= 12 assertions):**

- [ ] Unauthenticated → 401
- [ ] POST /kvp/:uuid/request-approval → 201 (happy path)
- [ ] POST duplicate request → 409
- [ ] POST for non-existent KVP → 404
- [ ] GET /kvp/:uuid/approval → approval object
- [ ] GET /kvp/:uuid/approval (no approval) → `{ approval: null }`
- [ ] GET /kvp/approval-config-status → `{ hasConfig: boolean }`
- [ ] Employee cannot request approval → 403

### Phase 2 — Definition of Done

- [ ] >= 16 unit tests
- [ ] >= 8 API integration tests
- [ ] All tests green
- [ ] Coverage: all public methods have at least 1 test

---

## Phase 3: Frontend — KVP Detail Integration

> **Dependency:** Phase 1 complete (endpoints available)

### Step 3.1: Data Loading — Approval Info [PENDING]

**Modified file:** `frontend/src/routes/(app)/(shared)/kvp-detail/+page.server.ts`

**Changes:**
- Fetch approval status: `GET /kvp/:uuid/approval`
- Fetch config status: `GET /kvp/approval-config-status`
- Pass `approval` and `hasApprovalConfig` to page component via `data`

**Modified file:** `frontend/src/routes/(app)/(shared)/kvp-detail/_lib/types.ts`

- Add `ApprovalInfo` type (status, requestedBy, decidedBy, decisionNote, timestamps)
- Add to page data type

### Step 3.2: "Freigabe anfordern" Button [PENDING]

**Modified file:** `frontend/src/routes/(app)/(shared)/kvp-detail/_lib/DetailSidebar.svelte`

**New button in admin actions section:**
- Label: "Freigabe anfordern"
- Icon: `fa-check-double` (consistent with approvals sidebar icon)
- Visible when: `canManage && hasApprovalConfig && !existingApproval && statusAllowsApproval`
- Status allows: `'new'` or `'in_review'` (not already approved/rejected/implemented)
- Calls: `POST /kvp/:uuid/request-approval`
- On success: `invalidateAll()` + success toast
- On error: error toast with message

### Step 3.3: Approval Status Badge [PENDING]

**Modified file:** `frontend/src/routes/(app)/(shared)/kvp-detail/_lib/DetailSidebar.svelte` (or new component)

**New section "Freigabe-Status" in sidebar (shown when approval exists):**
- Pending: yellow badge "Freigabe ausstehend" + requester name + date
- Approved: green badge "Freigabe erteilt" + approver name + date
- Rejected: red badge "Freigabe abgelehnt" + rejector name + reason + date

### Step 3.4: Dynamic Status Dropdown [PENDING]

**RESOLVED** — Dropdown options depend on current status + approval config existence.

**Modified files:**
- `frontend/src/routes/(app)/(shared)/kvp-detail/+page.svelte` (status dropdown logic)
- `frontend/src/routes/(app)/(shared)/kvp-detail/_lib/constants.ts` (dropdown option sets)

**Logic (when approval config exists for addon 'kvp'):**

| Current Status | Dropdown Options | "Freigabe anfordern" | Rationale |
| --- | --- | --- | --- |
| `new` | `abgelehnt` only | visible | Curate: reject bad, request approval for good |
| `in_review` | LOCKED (disabled) | hidden | Waiting for master — no manual override |
| `approved` | `umgesetzt` only | hidden | Master approved — confirm implementation |
| `rejected` | LOCKED (disabled) | hidden | Final state |
| `implemented` | LOCKED (disabled) | hidden | Final state |

**Without approval config:** Old behavior — all status options available, no "Freigabe anfordern" button. Backward compatible.

**Implementation:** Conditional rendering based on `hasApprovalConfig` prop from `+page.server.ts`. When true, filter `STATUS_OPTIONS` array based on current status. When `in_review`/`rejected`/`implemented`, disable dropdown entirely.

### Phase 3 — Definition of Done

- [ ] Approval data loaded in `+page.server.ts`
- [ ] "Freigabe anfordern" button functional (visible only when appropriate)
- [ ] Approval status badge displayed (pending/approved/rejected)
- [ ] Button hidden when no approval config exists
- [ ] Button hidden when approval already exists (no re-submission)
- [ ] Dynamic dropdown: options filtered by current status + approval config
- [ ] Dropdown LOCKED during `in_review`, `rejected`, `implemented`
- [ ] Without approval config: old behavior preserved (backward compat)
- [ ] svelte-check 0 errors
- [ ] ESLint 0 errors
- [ ] Responsive design

---

## Phase 4: Integration + Polish

> **Dependency:** Phase 3 complete

### Step 4.1: E2E Verification [PENDING]

**Full workflow test (manual):**

1. Admin: Configure approval master for `kvp` addon (e.g. position "Qualitätsmanager")
2. Employee: Submit KVP suggestion
3. Team Lead: Open KVP detail → click "Freigabe anfordern"
4. Verify: KVP status = `in_review`, approval visible in `/manage-approvals`
5. KVP Master: Approve in `/manage-approvals`
6. Verify: KVP status auto-synced to `approved`
7. Repeat steps 2-4, but reject this time
8. Verify: KVP status = `rejected`, rejection reason shown
9. Wait 30 days (or manually trigger CRON) → verify `is_active = 4`

**Edge case verification:**
- [ ] No approval config → button not visible
- [ ] Second approval request for same KVP → blocked
- [ ] Self-approval → blocked (existing guard)
- [ ] Server restart recovery → missed decisions synced

### Step 4.2: Documentation [PENDING]

- [ ] Approvals Masterplan: Mark Phase 5 as DONE, Session 6 as DONE
- [ ] FEATURES.md: Update KVP feature description (mention approval integration)
- [ ] Customer migrations synced: `./scripts/sync-customer-migrations.sh` (if any migration needed)

### Phase 4 — Definition of Done

- [ ] Full E2E approval flow works (approve + reject)
- [ ] Rejection + 30-day CRON archive works
- [ ] Startup reconciliation verified
- [ ] Approvals Masterplan updated
- [ ] No open TODOs in code
- [ ] All existing tests still pass

---

## Session Tracking

| Session | Phase | Description                                          | Status | Date |
| ------- | ----- | ---------------------------------------------------- | ------ | ---- |
| 1       | 1     | KvpApprovalService + endpoints + EventBus + CRON     |        |      |
| 2       | 2     | Unit tests + API integration tests                   |        |      |
| 3       | 3     | Frontend: button + badge + data loading              |        |      |
| 4       | 4     | E2E verification + TBD blocking + documentation      |        |      |

---

## Known Limitations (V1 — Intentionally Excluded)

1. **No re-submission after rejection** — Rejected KVPs cannot be re-submitted for approval. User must create a new KVP suggestion. By design (keeps audit trail clean).
2. **No multi-step approval chains** — Single approval master decides. Multi-step chains (Lead → Manager → Director) is V2 of Approvals system.
3. **No batch approval from KVP list** — Approval must be requested per-KVP from detail page. Batch operations are V2.
4. **No approval deadline/SLA** — No auto-escalation if approval master doesn't decide within X days. V2.
5. **30-day archive is hard-coded** — Not configurable per tenant in V1.
6. **`kvp_suggestions` has no `is_active` column** — Archival uses `status = 'archived'` (existing ENUM value), not the `is_active` pattern used by blackboard. This is consistent with the existing KVP status lifecycle.

---

## Quick Reference: File Paths

### Backend (new)

| File                                                     | Purpose                       |
| -------------------------------------------------------- | ----------------------------- |
| `backend/src/nest/kvp/kvp-approval.service.ts`           | Approval bridge service       |
| `backend/src/nest/kvp/kvp-approval-archive-cron.service.ts` | 30-day CRON archival       |
| `backend/src/nest/kvp/kvp-approval.service.test.ts`      | Unit tests                    |
| `backend/test/kvp-approval.api.test.ts`                  | API integration tests         |

### Backend (modified)

| File                                            | Change                              |
| ----------------------------------------------- | ----------------------------------- |
| `backend/src/nest/kvp/kvp.module.ts`            | Import ApprovalsModule, new providers |
| `backend/src/nest/kvp/kvp.controller.ts`        | 3 new endpoints                     |

### Frontend (modified)

| File                                                                          | Change                       |
| ----------------------------------------------------------------------------- | ---------------------------- |
| `frontend/src/routes/(app)/(shared)/kvp-detail/+page.server.ts`              | Fetch approval data          |
| `frontend/src/routes/(app)/(shared)/kvp-detail/+page.svelte`                 | Pass approval to sidebar     |
| `frontend/src/routes/(app)/(shared)/kvp-detail/_lib/DetailSidebar.svelte`    | Button + badge               |
| `frontend/src/routes/(app)/(shared)/kvp-detail/_lib/types.ts`                | ApprovalInfo type            |
| `frontend/src/routes/(app)/(shared)/kvp-detail/_lib/api.ts`                  | requestApproval() function   |

---

---

## Related Documents

| Document | Relevance |
| -------- | --------- |
| [FEAT_APPROVALS_SYSTEM_MASTERPLAN.md](./FEAT_APPROVALS_SYSTEM_MASTERPLAN.md) | Parent plan — this is Phase 5 (KVP Integration) |
| [FEAT_POSITION_CATALOG_MASTERPLAN.md](./FEAT_POSITION_CATALOG_MASTERPLAN.md) | Position-based approval masters (approver_type='position') |
| [ADR-037](./infrastructure/adr/ADR-037-approvals-architecture.md) | Approvals architecture (UNION ALL resolver, 5 approver types) |
| [ADR-038](./infrastructure/adr/ADR-038-position-catalog-architecture.md) | Position catalog (enables "Qualitätsmanager as KVP Master") |
| [ADR-004](./infrastructure/adr/ADR-004-persistent-notification-counts.md) | Dual-pattern: EventBus (SSE) + DB notifications (persistent badges) |
| [ADR-018](./infrastructure/adr/ADR-018-testing-strategy.md) | Two-Tier Testing: unit (`vi.mock()`) + API (`fetch()`, `authHeaders()`) |
| [HOW-TO-TEST-WITH-VITEST.md](./HOW-TO-TEST-WITH-VITEST.md) | API test patterns, One-Request-per-Describe, `flushThrottleKeys()` |

---

**This document is the execution plan. Each session starts here,
picks the next unchecked item, and marks it as done.**
