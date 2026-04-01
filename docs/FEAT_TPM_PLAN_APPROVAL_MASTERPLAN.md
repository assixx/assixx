# FEAT: TPM Plan Approval — Execution Masterplan

> **Created:** 2026-03-29
> **Version:** 0.2.0 (Validated Draft)
> **Status:** DRAFT — Phase 0 (Planning)
> **Branch:** `refactor/TPM`
> **Spec:** [ADR-037 Approvals Architecture](./infrastructure/adr/ADR-037-approvals-architecture.md)
> **Context:** [FEAT_TPM_MASTERPLAN.md](./FEAT_TPM_MASTERPLAN.md) (parent feature, v2.1.0 COMPLETE)
> **Author:** SCS + Claude (Staff Engineer)
> **Estimated Sessions:** 3
> **Actual Sessions:** 0 / 3

---

## Changelog

| Version | Date       | Change                                                                                  |
| ------- | ---------- | --------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-03-29 | Initial Draft — 4 Phases, 3 Sessions                                                    |
| 0.2.0   | 2026-03-29 | Validation fixes: C1 supersede removed, C2 approval_version added, C3/H1-H3/M1-M4 fixed |

> **Versioning:**
>
> - `0.x.0` = Planning phase (Draft)
> - `1.x.0` = Implementation in progress (minor bump per phase)
> - `2.0.0` = Feature fully complete
> - Patch `x.x.1` = Hotfix within a phase

---

## Summary

Integrate TPM Plan management with the centralized Approvals system (ADR-037).
Every plan creation or edit requires approval by a configured TPM Approval Master.
Approval status is **informational/documentary** (ISO 9001 compliance) — plans remain
fully operational regardless of approval status.

**Version Scheme (approval_version.revision_minor):**

```
Create plan     → v0.0  (draft, pending approval)
Master approves → v1.0  (approved)
User edits      → v1.1  (draft, pending approval covers latest state)
User edits      → v1.2  (draft, same pending approval)
Master approves → v2.0  (approved)
```

**approval_version** = approval count (NEW column). **revision_minor** = draft edits since last approval (NEW column).
**revision_number** = total edit count (UNCHANGED — no semantic shift).

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (all containers healthy)
- [ ] DB Backup created
- [ ] Branch `refactor/TPM` checked out
- [ ] TPM feature complete (v2.1.0) — all 29 sessions done
- [ ] Approvals module complete — ADR-037 implemented
- [ ] TPM Approval Master configurable in `/settings/approvals` (DONE — 2026-03-29)
- [ ] DATABASE-MIGRATION-GUIDE.md read

### 0.2 Risk Register

| #   | Risk                                           | Impact | Probability | Mitigation                                                      | Verification                                                 |
| --- | ---------------------------------------------- | ------ | ----------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| R1  | Race condition: concurrent edit + approve      | Medium | Low         | `FOR UPDATE` lock on plan row before approval_version change    | Unit test: parallel approve + edit → no data corruption      |
| R2  | Edit with pending approval creates orphans     | Low    | High        | No new approval on edit-with-pending; minor bump only           | Unit test: edit with pending → no new approval, minor++      |
| R3  | Existing plans without approval record         | Low    | Certain     | Migration sets `approval_version = 1` for existing active plans | Frontend shows "—" badge only for `approval_version = 0`     |
| R4  | ApprovalsModule circular dependency with TPM   | Medium | Low         | One-way dependency: TPM imports Approvals, never reverse        | Type-check passes, no circular import warnings               |
| R5  | New columns break existing queries             | Medium | Low         | DEFAULT 0 — existing queries unaffected, columns are additive   | All existing tests pass after migration                      |
| R6  | No approval master configured → orphan request | Low    | Medium      | `hasApprovalConfig()` gates `requestApproval()` — skip if empty | Unit test: no config → no approval created, plan still works |

### 0.3 Ecosystem Integration Points

| Existing System              | Integration                                               | Phase | Verified |
| ---------------------------- | --------------------------------------------------------- | ----- | -------- |
| `ApprovalsService`           | Create approval requests for TPM plans                    | 2     |          |
| `ApprovalsConfigService`     | Check if TPM approval masters are configured              | 2     |          |
| `EventBus`                   | Subscribe to `approval.decided` for `addonCode === 'tpm'` | 2     |          |
| `ActivityLoggerService`      | Log approval request + decision events                    | 2     |          |
| `tpm_plan_revisions`         | Include approval_version + revision_minor in snapshots    | 2     |          |
| `TpmPlanRevisionsService`    | Map revisionMinor + approvalVersion in revision responses | 2     |          |
| `/manage-approvals`          | TPM module filter + source URL to plan detail             | 3     |          |
| `/lean-management/tpm` table | "Freigabe" column with approval status badge              | 3     |          |
| Version display              | `v{approval_version}.{revision_minor}` format everywhere  | 3     |          |

---

## Architecture Decisions

### D1: No Plan Blocking

Approval status is **informational only**. Plans remain fully operational (cards, board,
executions) regardless of pending/rejected approval. Rationale: TPM maintenance must not
be blocked by administrative workflows. The approval documents that a master has reviewed
the plan — it does not gate operations.

### D2: Version Scheme — approval_version.revision_minor (NEW columns)

- `approval_version` (**NEW** INTEGER DEFAULT 0) = approval count (displayed as major)
- `revision_minor` (**NEW** INTEGER DEFAULT 0) = draft edits since last approval
- `revision_number` (**UNCHANGED**) = total edit count — no semantic shift, no breaking change
- On create: `approval_version = 0, revision_minor = 0` → displayed as `v0.0`
- On edit: `revision_minor += 1` → displayed as `v0.1`, `v1.1`, etc.
- On approve event: `approval_version += 1, revision_minor = 0` → displayed as `v1.0`, `v2.0`, etc.
- Existing active plans: migration sets `approval_version = 1` (legacy-approved at `v1.0`)
- Existing archived plans: migration sets `approval_version = 1` (legacy)

**Why not repurpose revision_number?** A plan at `revision_number = 5` (5 edits) would
falsely imply "5× approved". Separate columns avoid semantic confusion. (Validation C2)

### D3: No Supersede — Edit-with-Pending Reuses Existing Approval

**Why no supersede:** `ApprovalsService.reject()` has a self-approval prevention check
(`requested_by === decidedBy` → ForbiddenException). The plan editor who is also the
requester CANNOT auto-reject their own pending approval. (Validation C1)

**Simplified approach:**

- **Create** → always create new approval request (if masters configured)
- **Edit WITH existing pending approval** → only bump `revision_minor`, NO new approval.
  The pending approval covers the latest plan state. Master reviews current version.
- **Edit WITHOUT pending** (approved/rejected/none) → create new approval request
- This prevents orphaned approvals and avoids authorization complexity.

### D4: Source Reference

```
addon_code:          'tpm'
source_entity_type:  'tpm_plan'
source_uuid:         plan.uuid
title:               'TPM Plan: {planName} ({assetName})'
```

### D5: No Separate Approval Status Column on tpm_maintenance_plans

The approval status lives in the centralized `approvals` table (ADR-037). The `listPlans()`
query enriches results via LEFT JOIN subquery. No denormalization needed — the query is
bounded by pagination (max 20 plans per page) and the subquery uses `DISTINCT ON` for
latest approval per plan.

### D6: hasApprovalConfig() Gates Approval Creation

If no TPM approval master is configured (`approval_configs` has no rows for `addon_code = 'tpm'`),
`requestApproval()` is skipped entirely. This prevents orphaned approvals that nobody can decide.
The plan is created/edited normally without an approval record. (Validation H3)

### D7: Event Handler Must Resolve sourceUuid

The `approval.decided` EventBus payload contains `approval.uuid` and `approval.addonCode`
but does **NOT** contain `sourceUuid`. The event handler must call
`ApprovalsService.findById(approval.uuid)` to get `sourceUuid` (= plan UUID),
then use that to look up and update the plan's `approval_version`. (Validation M3)

---

## File Size Budget

### Backend — New Files (2 files)

```
backend/src/nest/tpm/
├── tpm-plan-approval.service.ts          (~180 lines — Bridge service)
└── tpm-plan-approval.service.test.ts     (~150 lines — Unit tests)
```

### Backend — Modified Files (7 files)

| File                                 | Change                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tpm.module.ts`                      | Import ApprovalsModule, add TpmPlanApprovalService                                                                                                             |
| `tpm-plans.service.ts`               | approval_version=0 on create, revision_minor++ on edit                                                                                                         |
| `tpm-plans.controller.ts`            | Call requestApproval after create/update (conditional)                                                                                                         |
| `tpm-plans.helpers.ts`               | Map approvalVersion + revisionMinor + approvalStatus; update `insertRevisionSnapshot()` signature                                                              |
| `tpm.types.ts`                       | Add approval_version + revision_minor to Row types, approvalVersion + revisionMinor + approvalStatus to API types, update TpmPlanRevision + TpmPlanRevisionRow |
| `tpm-plan-revisions.service.ts`      | Include revisionMinor + approvalVersion in revision list/detail responses                                                                                      |
| `tpm-plan-revisions.service.test.ts` | Update test expectations if needed                                                                                                                             |

### Frontend — Modified Files (5 files)

| File                                                                                | Change                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `frontend/src/routes/(app)/(shared)/manage-approvals/+page.svelte`                  | Add TPM module filter + source URL                              |
| `frontend/src/routes/(app)/(shared)/lean-management/tpm/_admin/PlanOverview.svelte` | Add "Freigabe" column with badge                                |
| `frontend/src/routes/(app)/(shared)/lean-management/tpm/_admin/types.ts`            | Add approvalVersion + revisionMinor + approvalStatus to TpmPlan |
| `frontend/src/routes/(app)/(shared)/lean-management/tpm/_admin/constants.ts`        | Add approval badge labels + classes                             |
| `frontend/src/routes/(app)/(shared)/lean-management/tpm/_lib/types.ts`              | Mirror approval fields for employee view                        |

### Database — New Files (1 migration)

| File                                                        | Content                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `database/migrations/XXXXXXXX_tpm-plan-approval-version.ts` | ADD COLUMN approval_version + revision_minor to 2 tables |

---

## Phase 1: Database Migration

> **Dependency:** None (first phase)
> **MUST READ:** [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md)

### Step 1.1: Session 1 — Add approval_version + revision_minor Columns ✅ DONE

**Migration:** `XXXXXXXX_tpm-plan-approval-version.ts` (generator-created)

**What happens:**

1. `ALTER TABLE tpm_maintenance_plans ADD COLUMN approval_version INTEGER NOT NULL DEFAULT 0`
2. `ALTER TABLE tpm_maintenance_plans ADD COLUMN revision_minor INTEGER NOT NULL DEFAULT 0`
3. `ALTER TABLE tpm_plan_revisions ADD COLUMN approval_version INTEGER NOT NULL DEFAULT 0`
4. `ALTER TABLE tpm_plan_revisions ADD COLUMN revision_minor INTEGER NOT NULL DEFAULT 0`
5. Backfill existing active/archived plans: `UPDATE tpm_maintenance_plans SET approval_version = 1 WHERE is_active IN (1, 3)`
6. Backfill existing revisions: `UPDATE tpm_plan_revisions SET approval_version = 1`

**Note:** `revision_number` is NOT changed. It keeps DEFAULT 1 and its existing semantics (total edit count).

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_maintenance_plans" | grep -E "revision|approval"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_plan_revisions" | grep -E "revision|approval"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT uuid, revision_number, approval_version, revision_minor FROM tpm_maintenance_plans WHERE is_active = 1;"
```

### Phase 1 — Definition of Done

- [x] Migration file generated via `doppler run -- pnpm run db:migrate:create tpm-plan-approval-version`
- [x] `up()` and `down()` implemented (Edit tool on generated stub, NOT Write)
- [x] Dry-run passed: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [x] Backup created before apply (`full_backup_pre_tpm_approval_20260329_213647.dump`, 2.3M)
- [x] Migration applied successfully (`20260329193653918_tpm-plan-approval-version.ts`)
- [x] Both new columns exist on both tables (verified via information_schema)
- [x] Existing active plans have `approval_version = 1, revision_minor = 0` (verified)
- [x] `revision_number` is unchanged on all plans (value=3 preserved)
- [x] Backend compiles (type-check 0 errors)
- [x] All existing tests pass (317 files, 7719 tests)
- [x] Customer fresh-install synced: 119 migrations

---

## Phase 2: Backend — Bridge Service + CRUD Integration

> **Dependency:** Phase 1 complete
> **Base pattern:** `backend/src/nest/kvp/kvp-approval.service.ts` — extended with version bumping logic. Unlike KVP, TPM does NOT sync source entity status and does NOT supersede pending approvals.

### Step 2.1: Session 2 — TpmPlanApprovalService ✅ DONE

**New file:** `backend/src/nest/tpm/tpm-plan-approval.service.ts` (~180 lines)

**Dependencies:** `ApprovalsService`, `ApprovalsConfigService`, `DatabaseService`, `ActivityLoggerService`

**Public Methods:**

| Method                                                                         | Description                                                                   |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `requestApproval(tenantId, userId, planUuid, planName, assetName)`             | Check config → create approval via ApprovalsService.create()                  |
| `hasPendingApproval(tenantId, planUuid): Promise<boolean>`                     | Query approvals table for pending TPM approval for this plan                  |
| `getApprovalStatusForPlans(tenantId, planUuids): Promise<Map<string, string>>` | Batch query: latest approval status per plan UUID                             |
| `hasApprovalConfig(tenantId): Promise<boolean>`                                | Check if any TPM approval master is configured — gates requestApproval() (D6) |

**Event Subscription (constructor):**

```
eventBus.on('approval.decided', handler)
  → filter: data.approval.addonCode === 'tpm'
  → call ApprovalsService.findById(data.approval.uuid) to get sourceUuid (D7)
  → on approved: bump approval_version += 1, revision_minor = 0, insert revision snapshot
  → on rejected: no-op (status visible via enrichment query, plan stays operational)
```

**Startup Reconciliation (onModuleInit):**

Find TPM plans where latest approval is 'approved' but `approval_version` doesn't match
(edge case: app restart during decision event). Sync approval_version for missed decisions.

### Step 2.2: Session 2 — CRUD Integration ✅ DONE

**Modified files:**

1. **`tpm-plans.service.ts`** — `createPlan()`:
   - INSERT with `approval_version = 0, revision_minor = 0` (explicit values, overriding DEFAULT)
   - `revision_number` stays at DEFAULT 1 (unchanged behavior)
   - Return plan data for controller to pass to approval service

2. **`tpm-plans.service.ts`** — `updatePlan()`:
   - Bump `revision_minor += 1` in UPDATE query (alongside existing `revision_number` bump)
   - Include `revision_minor` + `approval_version` in revision snapshot via `insertRevisionSnapshot()`

3. **`tpm-plans.controller.ts`** — `create()`:
   - After successful plan creation, check `hasApprovalConfig()` → if true, call `requestApproval()`
   - Fire-and-forget (`void`) — approval failure must not block plan creation

4. **`tpm-plans.controller.ts`** — `update()`:
   - After successful plan update, check:
     - `hasPendingApproval()` → if true, skip (pending covers latest state, D3)
     - `hasApprovalConfig()` → if true AND no pending, call `requestApproval()`

5. **`tpm-plans.helpers.ts`**:
   - `mapPlanRowToApi()`: include `approvalVersion`, `revisionMinor`, `approvalStatus` in response
   - `insertRevisionSnapshot()`: add `approval_version` + `revision_minor` parameters to signature and INSERT

6. **`tpm.types.ts`**:
   - `TpmMaintenancePlanRow`: add `approval_version: number`, `revision_minor: number`
   - `TpmPlanJoinRow`: add `approval_status: string | null` (from enrichment query)
   - `TpmPlan` (API): add `approvalVersion: number`, `revisionMinor: number`, `approvalStatus: string | null`
   - `TpmPlanRevisionRow`: add `approval_version: number`, `revision_minor: number`
   - `TpmPlanRevision` (API): add `approvalVersion: number`, `revisionMinor: number`

7. **`tpm-plan-revisions.service.ts`**:
   - Include `approval_version` and `revision_minor` in SELECT queries
   - Map to `approvalVersion` and `revisionMinor` in response

8. **`tpm.module.ts`**:
   - Add `ApprovalsModule` to imports
   - Add `TpmPlanApprovalService` to providers + exports

### Step 2.3: Session 2 — Enrich listPlans Query ✅ DONE

**Modified:** `tpm-plans.service.ts` — `listPlans()` and `getPlan()`

Add LEFT JOIN subquery to fetch latest approval status per plan:

```sql
LEFT JOIN LATERAL (
  SELECT a.status AS approval_status
  FROM approvals a
  WHERE a.addon_code = 'tpm'
    AND a.source_entity_type = 'tpm_plan'
    AND a.source_uuid = p.uuid
    AND a.is_active = 1
  ORDER BY a.created_at DESC
  LIMIT 1
) latest_approval ON true
```

This adds zero overhead for plans without approvals (LEFT JOIN returns NULL)
and is bounded by the plan pagination (max 20 per page).

### Phase 2 — Definition of Done

- [ ] `TpmPlanApprovalService` created with all 4 public methods
- [ ] Event subscription for `approval.decided` with `addonCode === 'tpm'` filter
- [ ] Event handler calls `findById()` to resolve `sourceUuid` before updating plan (D7)
- [ ] `hasApprovalConfig()` gates `requestApproval()` — no orphan approvals (D6)
- [ ] `hasPendingApproval()` prevents duplicate approvals on edit (D3)
- [ ] Startup reconciliation implemented
- [ ] `createPlan()` starts at `approval_version=0, revision_minor=0`
- [ ] `updatePlan()` bumps `revision_minor += 1`
- [ ] Approve event bumps `approval_version += 1, revision_minor = 0`
- [ ] `listPlans()` and `getPlan()` return `approvalStatus` field
- [ ] `TpmPlan` API type includes `approvalVersion`, `revisionMinor`, `approvalStatus`
- [ ] `TpmPlanRevision` API type includes `approvalVersion`, `revisionMinor`
- [ ] `insertRevisionSnapshot()` signature updated with new parameters
- [ ] `tpm-plan-revisions.service.ts` maps new fields
- [ ] `TpmModule` imports `ApprovalsModule`
- [ ] `revision_number` semantics UNCHANGED (total edit count, DEFAULT 1)
- [ ] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/tpm/`
- [ ] Type-check 0 errors: `docker exec assixx-backend pnpm run type-check`
- [ ] All existing TPM tests still pass

---

## Phase 3: Frontend

> **Dependency:** Phase 2 complete (API returns approvalVersion + revisionMinor + approvalStatus)

### Step 3.1: Session 3 — manage-approvals TPM Filter ✅ DONE

**Modified:** `frontend/src/routes/(app)/(shared)/manage-approvals/+page.svelte`

1. Add TPM to module filter toggle group:

   ```
   { label: 'TPM', value: 'tpm', icon: 'fa-tools' }
   ```

2. Add TPM source URL resolution:

   ```typescript
   if (item.addonCode === 'tpm' && item.sourceEntityType === 'tpm_plan') {
     return `/lean-management/tpm/plan/${item.sourceUuid}`;
   }
   ```

3. Add TPM badge class:
   ```css
   .badge--module-tpm {
     /* matching existing pattern */
   }
   ```

### Step 3.2: Session 3 — TPM Table "Freigabe" Column ✅ DONE

**Modified files:**

1. **`frontend/src/routes/(app)/(shared)/lean-management/tpm/_admin/types.ts`** — Add to `TpmPlan`:

   ```typescript
   approvalVersion: number;
   revisionMinor: number;
   approvalStatus: 'pending' | 'approved' | 'rejected' | null;
   ```

2. **`frontend/src/routes/(app)/(shared)/lean-management/tpm/_admin/constants.ts`** — Add:

   ```typescript
   export const APPROVAL_STATUS_LABELS: Record<string, string> = {
     pending: 'Ausstehend',
     approved: 'Freigegeben',
     rejected: 'Abgelehnt',
   };
   export const APPROVAL_STATUS_BADGE: Record<string, string> = {
     pending: 'badge--warning',
     approved: 'badge--success',
     rejected: 'badge--danger',
   };
   ```

3. **`frontend/src/routes/(app)/(shared)/lean-management/tpm/_admin/PlanOverview.svelte`**:
   - Add "Freigabe" column header after "Version"
   - Render approval status badge (pending=yellow, approved=green, rejected=red, null="—")
   - Update version display: `v{plan.approvalVersion}.{plan.revisionMinor}` (was: `v{plan.revisionNumber}`)

4. **`frontend/src/routes/(app)/(shared)/lean-management/tpm/_lib/types.ts`** — Mirror `approvalVersion`, `revisionMinor`, `approvalStatus` for employee view

### Phase 3 — Definition of Done

- [ ] TPM appears in manage-approvals module filter
- [ ] Clicking TPM approval links to `/lean-management/tpm/plan/{uuid}`
- [ ] TPM table shows "Freigabe" column with colored badge
- [ ] Version display shows `v{approval_version}.{revision_minor}` format
- [ ] Legacy plans (`approval_version >= 1`, no approval record) show "—" in Freigabe column
- [ ] New plans (`approval_version = 0`) show "Ausstehend" with pending approval
- [ ] svelte-check 0 errors
- [ ] Frontend ESLint 0 errors
- [ ] Responsive: column works on mobile (consider hiding on small screens)

---

## Phase 4: Testing + Verification

> **Dependency:** Phase 3 complete

### Step 4.1: Session 3 (continued) — Unit Tests ✅ DONE

**New file:** `backend/src/nest/tpm/tpm-plan-approval.service.test.ts` (~150 lines)

**Test scenarios (minimum 12):**

| #   | Scenario                                                                | Expected                                               |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | requestApproval creates approval via ApprovalsService                   | ApprovalsService.create() called with correct payload  |
| 2   | requestApproval when no config → skipped (D6)                           | hasApprovalConfig() returns false, no approval created |
| 3   | hasPendingApproval with existing pending                                | Returns true                                           |
| 4   | hasPendingApproval with no pending                                      | Returns false                                          |
| 5   | getApprovalStatusForPlans with mixed statuses                           | Returns correct Map<uuid, status>                      |
| 6   | getApprovalStatusForPlans with empty array                              | Returns empty Map                                      |
| 7   | approval.decided event (approved) bumps approval_version                | approval_version += 1, revision_minor = 0              |
| 8   | approval.decided event (approved) calls findById to get sourceUuid (D7) | findById called before plan update                     |
| 9   | approval.decided event (rejected) is no-op                              | No version change                                      |
| 10  | approval.decided event for non-TPM addon                                | Ignored                                                |
| 11  | createPlan starts at v0.0                                               | approval_version=0, revision_minor=0                   |
| 12  | updatePlan bumps minor                                                  | revision_minor += 1, approval_version unchanged        |
| 13  | edit with pending → no new approval (D3)                                | hasPendingApproval true → requestApproval not called   |
| 14  | edit without pending → new approval created                             | hasPendingApproval false → requestApproval called      |

### Step 4.2: E2E Verification [PENDING]

Manual verification checklist:

- [ ] Create new plan → appears as v0.0 with "Ausstehend" badge
- [ ] Approval master sees request in `/manage-approvals` with TPM filter
- [ ] Master approves → plan shows v1.0 with "Freigegeben" badge
- [ ] Edit plan → version bumps to v1.1, badge stays "Ausstehend" (same pending)
- [ ] Edit again → v1.2, still same pending approval (no new one created)
- [ ] Master approves → v2.0, "Freigegeben"
- [ ] Edit after approval → v2.1, NEW approval created, "Ausstehend"
- [ ] Master rejects → stays at v2.1, "Abgelehnt" badge
- [ ] Edit after rejection → v2.2, NEW approval created, "Ausstehend"
- [ ] Existing plans show v1.0 with "—" (legacy, no approval record)
- [ ] Plan with no configured master → no approval created, no badge

### Phase 4 — Definition of Done

- [ ] > = 14 unit tests for TpmPlanApprovalService
- [ ] All tests green: `pnpm exec vitest run --project unit backend/src/nest/tpm/tpm-plan-approval`
- [ ] E2E verification checklist complete
- [ ] `pnpm run validate:all` passes (0 errors)
- [ ] All existing TPM tests still pass

---

## Session Tracking

| Session | Phase | Description                                                    | Status      | Date       |
| ------- | ----- | -------------------------------------------------------------- | ----------- | ---------- |
| 1       | 1+2   | Migration + TpmPlanApprovalService + CRUD integration          | IN PROGRESS | 2026-03-29 |
| 2       | 2+3   | listPlans enrichment + Frontend (manage-approvals + TPM table) | PENDING     |            |
| 3       | 4     | Unit tests + E2E verification + polish                         | PENDING     |            |

---

## Known Limitations (V1 — Intentionally Excluded)

1. **No plan blocking** — Plans remain operational regardless of approval status.
   The approval is documentary. Blocking could be added in V2 by filtering unapproved
   plans from employee views.

2. **No SSE notifications for TPM approvals** — The approval master must check
   `/manage-approvals` manually. SSE integration can be added later using the existing
   notification patterns (eventBus + NotificationAddonService).

3. **No batch approval** — Each plan must be approved individually.
   Batch-approve is a planned approvals-system enhancement (ADR-037 §Geplante Erweiterungen).

4. **No approval for card-level changes** — Only plan create/edit triggers approval.
   Card CRUD, execution recording, and config changes are not gated.

5. **No multi-step approval chain** — Single master approves. Multi-level chains
   (Lead → Manager → Director) are a future approvals-system enhancement.

6. **No supersede on edit** — When editing with a pending approval, the minor version
   bumps but no new approval is created. The master reviews the latest plan state.
   Supersede was removed due to self-approval prevention in ApprovalsService.reject().

---

## Spec Deviations

| #   | Spec / Plan says                     | Actual code | Decision |
| --- | ------------------------------------ | ----------- | -------- |
| D1  | (to be filled during implementation) |             |          |

---

## Quick Reference: File Paths

### Backend (new)

| File                                                     | Purpose                    |
| -------------------------------------------------------- | -------------------------- |
| `backend/src/nest/tpm/tpm-plan-approval.service.ts`      | Bridge to Approvals system |
| `backend/src/nest/tpm/tpm-plan-approval.service.test.ts` | Unit tests                 |

### Backend (modified)

| File                                                 | Change                                                 |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `backend/src/nest/tpm/tpm.module.ts`                 | Import ApprovalsModule + new service                   |
| `backend/src/nest/tpm/tpm-plans.service.ts`          | approval_version=0 on create, revision_minor++ on edit |
| `backend/src/nest/tpm/tpm-plans.controller.ts`       | Call approval service after CRUD (conditional)         |
| `backend/src/nest/tpm/tpm-plans.helpers.ts`          | Map new fields + update insertRevisionSnapshot()       |
| `backend/src/nest/tpm/tpm.types.ts`                  | Add approval + minor fields to ALL relevant types      |
| `backend/src/nest/tpm/tpm-plan-revisions.service.ts` | Map approvalVersion + revisionMinor in responses       |

### Database (new)

| File                                                        | Content                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `database/migrations/XXXXXXXX_tpm-plan-approval-version.ts` | ADD COLUMN approval_version + revision_minor to 2 tables |

### Frontend (modified)

| File                                                                                | Change                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| `frontend/src/routes/(app)/(shared)/manage-approvals/+page.svelte`                  | TPM filter + source URL                          |
| `frontend/src/routes/(app)/(shared)/lean-management/tpm/_admin/PlanOverview.svelte` | "Freigabe" column                                |
| `frontend/src/routes/(app)/(shared)/lean-management/tpm/_admin/types.ts`            | approvalVersion + revisionMinor + approvalStatus |
| `frontend/src/routes/(app)/(shared)/lean-management/tpm/_admin/constants.ts`        | Approval badge config                            |
| `frontend/src/routes/(app)/(shared)/lean-management/tpm/_lib/types.ts`              | Mirror fields                                    |
| `frontend/src/routes/(app)/(admin)/settings/approvals/_lib/constants.ts`            | TPM in APPROVABLE_ADDONS (DONE)                  |
