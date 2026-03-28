# FEAT: Approval Config Scope — Execution Masterplan

> **Created:** 2026-03-23
> **Version:** 0.1.0 (Draft)
> **Status:** COMPLETE — All 4 phases implemented
> **Branch:** `refactor/KVP`
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 2
> **Actual Sessions:** 1 / 2 (all done in session 1)
> **Related ADRs:** ADR-037 (Approvals), ADR-036 (Organizational Scope), ADR-010 (Permissions)

---

## Changelog

| Version | Date       | Change                                             |
| ------- | ---------- | -------------------------------------------------- |
| 0.1.0   | 2026-03-23 | Initial Draft — 4 phases planned                   |
| 0.2.0   | 2026-03-23 | Post-review fixes: 3 critical + 4 important issues |

---

## Problem Statement

`approval_configs` is flat per tenant + addon — no concept of organizational scope.
When `approver_type = 'user'` or `'position'`, the configured approver handles ALL
approval requests for the entire tenant. Real-world requirement: different approval
masters per area, department, or team.

**Example:** A company with 3 areas needs 3 different KVP approval masters — one per area.
Currently impossible to express.

**Secondary problem:** A KVP approval master cannot see KVPs in their approval scope
on `/kvp` if they lack organizational scope access to those teams/departments.

**What already works correctly:**

- `approver_type = 'team_lead'` / `'area_lead'` / `'department_lead'` — scope is implicit
  via `resolveApprovers()` which joins through the requester's org membership. No changes needed.

**What needs scope:**

- `approver_type = 'user'` — currently matches all requests in the tenant
- `approver_type = 'position'` — currently matches all users with that position, no area filter

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (all containers healthy)
- [ ] DB Backup created
- [ ] No pending migrations
- [ ] KVP Approval Integration complete (FEAT_KVP_APPROVAL_INTEGRATION_MASTERPLAN.md)
- [ ] `@Roles('admin', 'root')` removed from `POST /kvp/:id/request-approval` (bugfix from this session)

### 0.2 Risk Register

| #   | Risk                               | Impact | Probability | Mitigation                                              | Verification                                          |
| --- | ---------------------------------- | ------ | ----------- | ------------------------------------------------------- | ----------------------------------------------------- |
| R1  | Backward compatibility break       | High   | Low         | NULL scope = whole tenant (existing configs unchanged)  | Existing API tests still pass after migration         |
| R2  | Scope mismatch → no approver found | Medium | Medium      | Frontend validation: warn if no approver covers a scope | Unit test: request from uncovered scope → clear error |
| R3  | KVP visibility query performance   | Medium | Low         | EXISTS subquery with indexed columns, lazy evaluation   | EXPLAIN ANALYZE on visibility query                   |
| R4  | Unique index needs update          | High   | High        | Drop + recreate unique index including scope columns    | Dry-run migration                                     |

### 0.3 Ecosystem Integration Points

| Existing System            | Integration                                     | Phase |
| -------------------------- | ----------------------------------------------- | ----- |
| `approval_configs` table   | 3 new INTEGER[] columns                         | 1     |
| `ApprovalsConfigService`   | `resolveApprovers()` scope filter               | 2     |
| `UpsertApprovalConfigDto`  | Add scope fields to Zod schema                  | 2     |
| `ApprovalsController`      | Pass scope to createConfig                      | 2     |
| KVP visibility query       | Additional visibility path for approval masters | 2     |
| `/settings/approvals` page | Scope UI (Blackboard pattern)                   | 3     |
| ADR-037                    | Amendment: scope columns documented             | 4     |

---

## Phase 1: Database Migration

> **Dependency:** None
> **Files:** 1 new migration

### Step 1.1: Add scope columns to `approval_configs` [✅ DONE — 2026-03-23]

**New file:** `database/migrations/{timestamp}_add-approval-config-scope.ts`

**SQL operations:**

```sql
-- 1. Add 3 nullable INTEGER[] columns
ALTER TABLE approval_configs ADD COLUMN scope_area_ids INTEGER[] DEFAULT NULL;
ALTER TABLE approval_configs ADD COLUMN scope_department_ids INTEGER[] DEFAULT NULL;
ALTER TABLE approval_configs ADD COLUMN scope_team_ids INTEGER[] DEFAULT NULL;

-- 2. Drop existing unique index
DROP INDEX IF EXISTS idx_approval_configs_unique;

-- 3. Recreate unique index including scope
-- Note: PostgreSQL arrays need special handling in unique constraints.
-- We use a canonical sorted text representation to ensure {1,2} == {2,1}.
-- IMPORTANT: Backend MUST sort scope arrays before INSERT (normalize).
CREATE UNIQUE INDEX idx_approval_configs_unique
  ON approval_configs (
    tenant_id,
    addon_code,
    approver_type,
    COALESCE(approver_user_id, 0),
    COALESCE(approver_position_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(array_to_string(ARRAY(SELECT unnest(scope_area_ids) ORDER BY 1), ','), ''),
    COALESCE(array_to_string(ARRAY(SELECT unnest(scope_department_ids) ORDER BY 1), ','), ''),
    COALESCE(array_to_string(ARRAY(SELECT unnest(scope_team_ids) ORDER BY 1), ','), '')
  )
  WHERE is_active = 1;

-- 4. Add GIN indexes for array containment queries
CREATE INDEX idx_approval_configs_scope_areas ON approval_configs USING GIN (scope_area_ids) WHERE is_active = 1;
CREATE INDEX idx_approval_configs_scope_depts ON approval_configs USING GIN (scope_department_ids) WHERE is_active = 1;
CREATE INDEX idx_approval_configs_scope_teams ON approval_configs USING GIN (scope_team_ids) WHERE is_active = 1;

-- 5. GRANT (app_user already has full CRUD on approval_configs — no change needed)

-- NOTE: Existing CHECK constraint `chk_approver_type_fields` does NOT need changes.
-- It only validates approver_user_id/approver_position_id based on approver_type.
-- The new scope columns are orthogonal and not part of the check.
```

**Backward compatibility:** All existing rows have `NULL` scope columns = "whole tenant". No data migration needed.

**Scope semantics:** All three scope columns NULL = whole tenant. If ANY column is non-NULL,
it acts as an OR filter: a requester matches if their area/dept/team appears in ANY of the
scope arrays. Partial NULL (e.g., `scope_area_ids = NULL, scope_department_ids = {5}`) means
"only department 5" — NOT "all areas + department 5".

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d approval_configs"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT id, addon_code, approver_type, scope_area_ids, scope_department_ids, scope_team_ids FROM approval_configs;"
```

### Phase 1 — Definition of Done

- [ ] Migration file with `up()` AND `down()`
- [ ] Dry-run passes
- [ ] Migration applied successfully
- [ ] 3 new columns exist with NULL defaults
- [ ] GIN indexes created
- [ ] Unique index recreated
- [ ] Existing configs unchanged (scope = NULL)
- [ ] Backend compiles
- [ ] Existing tests pass

---

## Phase 2: Backend Changes

> **Dependency:** Phase 1 complete

### Step 2.1: Extend `UpsertApprovalConfigDto` [✅ DONE — 2026-03-23]

**File:** `backend/src/nest/approvals/dto/upsert-approval-config.dto.ts`

**Add to Zod schema:**

```typescript
scopeAreaIds: z.array(z.number().int().positive()).nullable().optional(),
scopeDepartmentIds: z.array(z.number().int().positive()).nullable().optional(),
scopeTeamIds: z.array(z.number().int().positive()).nullable().optional(),
```

**Refinement:** When `approverType` is `'team_lead'`, `'area_lead'`, or `'department_lead'`,
scope fields must be null/empty (implicit scope — UI hides them, backend enforces).

### Step 2.2: Update `ApprovalsConfigService.createConfig()` + `assertNoDuplicateConfig()` [✅ DONE — 2026-03-23]

**File:** `backend/src/nest/approvals/approvals-config.service.ts`

**Changes:**

1. **INSERT query:** Add `scope_area_ids`, `scope_department_ids`, `scope_team_ids` columns.
   Sort arrays before INSERT for unique index consistency. Convert `[]` → `NULL`.

2. **`assertNoDuplicateConfig()` (CRITICAL):** Currently checks uniqueness by
   `(tenant_id, addon_code, approver_type, approver_user_id, approver_position_id)`.
   With scope, the SAME user can be approver for the SAME addon with DIFFERENT scopes
   (e.g., Jürgen approves KVP for Area 1, AND separately for Area 3).
   **Must include scope arrays in the duplicate check WHERE clause**, or it will
   incorrectly block valid scoped configurations.

### Step 2.3: Update `ApprovalsConfigService.resolveApprovers()` [✅ DONE — 2026-03-23]

**File:** `backend/src/nest/approvals/approvals-config.service.ts`

**Current:** `RESOLVE_APPROVERS_QUERY` is a `SELECT DISTINCT` with 8 UNION ALL branches.
The `type='user'` branch (lines 27-33) does **NOT** join any org tables — it simply
selects `ac.approver_user_id` by `addon_code + is_active`. Same for `type='position'`
(lines 110-118) — only joins `user_positions`, no org tables.

**Change:** Add a CTE at the top of the query to resolve the requester's org membership,
then reference it in the `user` and `position` branches:

```sql
-- New CTE at top of RESOLVE_APPROVERS_QUERY
WITH requester_org AS (
  SELECT DISTINCT
    d.area_id,
    ut.team_id AS team_id,
    t.department_id
  FROM user_teams ut
  JOIN teams t ON t.id = ut.team_id AND t.tenant_id = $tenantId
  JOIN departments d ON d.id = t.department_id AND d.tenant_id = $tenantId
  WHERE ut.user_id = $requestingUserId AND ut.tenant_id = $tenantId
)

-- For type='user' branch, add scope filter:
SELECT ac.approver_user_id AS approver_id
FROM approval_configs ac
WHERE ac.addon_code = $1 AND ac.is_active = 1 AND ac.tenant_id = $tenantId
  AND ac.approver_type = 'user'
  AND (
    -- Whole tenant: ALL three scope columns are NULL
    (ac.scope_area_ids IS NULL AND ac.scope_department_ids IS NULL AND ac.scope_team_ids IS NULL)
    -- OR requester's org matches any scope array
    OR EXISTS (SELECT 1 FROM requester_org ro WHERE ro.area_id = ANY(ac.scope_area_ids))
    OR EXISTS (SELECT 1 FROM requester_org ro WHERE ro.department_id = ANY(ac.scope_department_ids))
    OR EXISTS (SELECT 1 FROM requester_org ro WHERE ro.team_id = ANY(ac.scope_team_ids))
  )

-- Same pattern for type='position' branch
```

**Why EXISTS + CTE instead of scalar comparisons:** A user can belong to multiple teams
across different departments/areas. The CTE returns all org memberships, and EXISTS
checks if ANY membership matches the scope.

**No signature change needed** — `resolveApprovers(addonCode, requestingUserId)` already
receives the user ID. The CTE resolves org context inside the SQL.

**Hierarchy branches (`team_lead`, `area_lead`, `department_lead`) remain unchanged** — they
already resolve via the requester's org membership and have no scope columns to check.

### Step 2.4: Update `approvals.types.ts` + `getConfigs()` [✅ DONE — 2026-03-23]

**File:** `backend/src/nest/approvals/approvals.types.ts`

**Changes:**

1. `ApprovalConfigRow` interface: add `scope_area_ids: number[] | null`,
   `scope_department_ids: number[] | null`, `scope_team_ids: number[] | null`
2. `ApprovalConfig` interface: add `scopeAreaIds: number[] | null`,
   `scopeDepartmentIds: number[] | null`, `scopeTeamIds: number[] | null`
3. `mapConfigRowToApi()`: map the 3 new fields (snake_case → camelCase)

**File:** `backend/src/nest/approvals/approvals-config.service.ts`

**Change:** `getConfigs()` already uses `SELECT ac.*` — new columns are auto-included.
Only the mapper needs updating (see above).

### Step 2.5: KVP Visibility Path for Approval Masters [✅ DONE — 2026-03-23]

**File:** `backend/src/nest/kvp/kvp.helpers.ts` — specifically `buildVisibilityClause()`
(NOT `kvp.service.ts` — the service calls the helper, the SQL lives in the helper)

**Change:** Add an additional OR clause in the KVP visibility query:

```sql
-- User is configured as approval master for KVP and the suggestion
-- falls within their approval scope
OR EXISTS (
  SELECT 1 FROM approval_configs ac
  LEFT JOIN departments d ON d.id = ks.department_id
  WHERE ac.addon_code = 'kvp'
    AND ac.tenant_id = ks.tenant_id
    AND ac.is_active = 1
    AND (
      ac.approver_user_id = $userId
      OR ac.approver_position_id IN (
        SELECT position_id FROM user_positions WHERE user_id = $userId AND tenant_id = ks.tenant_id
      )
    )
    AND (
      -- Whole tenant scope
      (ac.scope_area_ids IS NULL AND ac.scope_department_ids IS NULL AND ac.scope_team_ids IS NULL)
      -- Area match (KVP's department → area)
      OR d.area_id = ANY(ac.scope_area_ids)
      -- Department match
      OR ks.department_id = ANY(ac.scope_department_ids)
      -- Team match
      OR ks.team_id = ANY(ac.scope_team_ids)
    )
)
```

**Note:** `kvp_suggestions` has `department_id` and `team_id` but no `area_id`.
Area is derived via `departments.area_id` (one JOIN).

### Step 2.6: Update Existing Unit Tests [✅ DONE — 2026-03-23]

**File:** `backend/src/nest/approvals/approvals-config.service.test.ts`

**Breaking changes in existing tests:**

1. `makeConfigRow()` helper (line ~50): add scope fields (`scope_area_ids: null`, etc.)
2. `createConfig` tests: mock INSERT params will shift indices (3 new columns added).
   Update parameter position assertions (e.g., `expect(params[4])` → renumber).
3. `resolveApprovers` tests: SQL query changes → update query content assertions if any.
4. `assertNoDuplicateConfig` tests: update to include scope in duplicate detection.

**Goal:** All existing tests must pass with the scope changes BEFORE writing new tests.

### Phase 2 — Definition of Done

- [ ] DTO extended with scope fields + refinement
- [ ] `createConfig()` persists scope columns (sorted, `[]` → `NULL`)
- [ ] `assertNoDuplicateConfig()` includes scope in duplicate check
- [ ] `getConfigs()` returns scope columns (via updated mapper in `approvals.types.ts`)
- [ ] `ApprovalConfigRow` + `ApprovalConfig` interfaces updated
- [ ] `mapConfigRowToApi()` maps scope fields
- [ ] `resolveApprovers()` filters `user` + `position` branches by scope (CTE pattern)
- [ ] KVP visibility extended for approval masters (in `kvp.helpers.ts`)
- [ ] Empty arrays normalized to NULL, arrays sorted before storage
- [ ] Hierarchy types (`team_lead`, etc.) ignore scope (enforced in DTO + service)
- [ ] Existing unit tests updated and passing
- [ ] ESLint: 0 errors
- [ ] Type-check: 0 errors

---

## Phase 3: Frontend — Scope UI on Settings Page

> **Dependency:** Phase 2 complete
> **Pattern:** Copy from `BlackboardEntryModal.svelte` (lines 223-342)

### Step 3.1: Load Areas/Departments/Teams in `+page.server.ts` [✅ DONE — 2026-03-23]

**File:** `frontend/src/routes/(app)/(admin)/settings/approvals/+page.server.ts`

**Change:** Fetch org data (same endpoints used by blackboard):

```typescript
const [configs, areas, departments, teams] = await Promise.all([
  apiFetch<ApprovalConfig[]>('/approvals/configs', token, fetch),
  apiFetch<Area[]>('/areas', token, fetch),
  apiFetch<Department[]>('/departments', token, fetch),
  apiFetch<Team[]>('/teams', token, fetch),
]);
```

### Step 3.2: Add Scope UI to Config Form [✅ DONE — 2026-03-23]

**File:** `frontend/src/routes/(app)/(admin)/settings/approvals/+page.svelte`

**Add (inside config creation form, after approver type/user/position selection):**

1. "Ganze Firma" toggle (`toggle-switch--danger`) — default ON
2. Area multiselect — disabled when toggle ON
3. Department multiselect — cascaded, excludes area-covered depts
4. Team multiselect — cascaded, excludes dept-covered teams

**Conditional visibility:** Only show scope controls when `approverType === 'user'` or
`approverType === 'position'`. For hierarchy types, hide scope (implicit).

**Cascade logic:** Copy `handleAreaChange()`, `handleDepartmentChange()`, `availableDepartments`,
`availableTeams` derived computations from `BlackboardEntryModal.svelte`.

### Step 3.3: Update API call + Types [✅ DONE — 2026-03-23]

**File:** `frontend/src/routes/(app)/(admin)/settings/approvals/_lib/api.ts`

**Change:** `createConfig()` sends `scopeAreaIds`, `scopeDepartmentIds`, `scopeTeamIds`.
When "Ganze Firma" is ON → send `null` for all three.

**File:** `frontend/src/routes/(app)/(admin)/settings/approvals/_lib/types.ts`

**Change:** Add scope fields to `ApprovalConfig` interface.

### Step 3.4: Display Scope in Config List [✅ DONE — 2026-03-23]

**File:** `frontend/src/routes/(app)/(admin)/settings/approvals/+page.svelte`

**Change:** In the config list table, show scope info:

- "Ganze Firma" badge when scope is NULL
- Area/Department/Team names when scoped

### Phase 3 — Definition of Done

- [ ] "Ganze Firma" toggle works (default ON)
- [ ] Area/Department/Team multiselect with cascade logic
- [ ] Scope controls hidden for hierarchy-based approver types
- [ ] Config list shows scope info
- [ ] Create + edit preserves scope
- [ ] svelte-check: 0 errors
- [ ] ESLint: 0 errors

---

## Phase 4: Tests + Documentation

> **Dependency:** Phase 2-3 complete

### Step 4.1: Unit Tests [✅ DONE — 2026-03-23]

**File:** `backend/src/nest/approvals/approvals-config.service.test.ts`

**New test scenarios:**

- `resolveApprovers()` with scoped config: requester in scope → returns approver
- `resolveApprovers()` with scoped config: requester NOT in scope → returns empty
- `resolveApprovers()` with NULL scope (whole tenant) → returns approver (backward compat)
- `resolveApprovers()` with mixed configs: scoped + global → correct resolution
- `createConfig()` with scope arrays → persisted correctly
- `createConfig()` with empty arrays → normalized to NULL
- `createConfig()` with hierarchy type + scope → scope ignored/rejected
- KVP visibility: approval master sees KVPs in their scope
- KVP visibility: approval master does NOT see KVPs outside their scope

### Step 4.2: API Integration Tests [✅ DONE — 2026-03-23]

**File:** `backend/test/kvp-approval.api.test.ts` (extend existing)

**New test scenarios:**

- PUT /approvals/configs with scope → 200, scope persisted
- GET /approvals/configs → scope fields returned
- Existing tests still pass (backward compatibility)

### Step 4.3: ADR-037 Amendment [✅ DONE — 2026-03-23]

**File:** `docs/infrastructure/adr/ADR-037-approvals-architecture.md`

**Add section:** "Amendment: Organizational Scope (2026-03-23)"

- Document `scope_area_ids`, `scope_department_ids`, `scope_team_ids` columns
- Document scope matching logic in `resolveApprovers()`
- Document that hierarchy-based types have implicit scope (no change)
- Document KVP visibility extension for approval masters
- Fix pre-existing inaccuracies: remove `role_label` from schema (never existed in DB),
  add `position` to `approval_approver_type` enum documentation (already exists in DB)

### Phase 4 — Definition of Done

- [ ] > = 9 new unit tests, all green
- [ ] > = 3 new API tests, all green
- [ ] All existing tests still pass
- [ ] ADR-037 amended
- [ ] KVP Approval Masterplan updated (reference this plan)

---

## Session Tracking

| Session | Phase | Description                                                   | Status | Date       |
| ------- | ----- | ------------------------------------------------------------- | ------ | ---------- |
| 1       | 1-4   | Full implementation: migration, backend, frontend, tests, ADR | DONE   | 2026-03-23 |

---

## File Reference

### Backend (modified)

| File                                                           | Change                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| `backend/src/nest/approvals/dto/upsert-approval-config.dto.ts` | Add scope fields to Zod schema                             |
| `backend/src/nest/approvals/approvals-config.service.ts`       | Scope in resolveApprovers, createConfig, assertNoDuplicate |
| `backend/src/nest/approvals/approvals.types.ts`                | Scope fields in Row/Config interfaces + mapper             |
| `backend/src/nest/approvals/approvals-config.service.test.ts`  | Update existing tests for scope changes                    |
| `backend/src/nest/kvp/kvp.helpers.ts`                          | Visibility path for approval masters                       |
| `backend/src/nest/approvals/approvals.controller.ts`           | No changes needed — scope flows via DTO                    |

### Database (new)

| File                                                           | Purpose             |
| -------------------------------------------------------------- | ------------------- |
| `database/migrations/{timestamp}_add-approval-config-scope.ts` | 3 columns + indexes |

### Frontend (modified)

| File                                                                   | Change                        |
| ---------------------------------------------------------------------- | ----------------------------- |
| `frontend/src/routes/(app)/(admin)/settings/approvals/+page.server.ts` | Load areas/depts/teams        |
| `frontend/src/routes/(app)/(admin)/settings/approvals/+page.svelte`    | Scope UI (Blackboard pattern) |
| `frontend/src/routes/(app)/(admin)/settings/approvals/_lib/api.ts`     | Send scope in API call        |
| `frontend/src/routes/(app)/(admin)/settings/approvals/_lib/types.ts`   | Scope types                   |

### Documentation (modified)

| File                                                        | Change              |
| ----------------------------------------------------------- | ------------------- |
| `docs/infrastructure/adr/ADR-037-approvals-architecture.md` | Amendment: scope    |
| `docs/FEAT_KVP_APPROVAL_INTEGRATION_MASTERPLAN.md`          | Reference this plan |

---

## Known Limitations (V1 — Intentionally Excluded)

1. **No scope validation against org hierarchy** — if a user selects area_id=999 that doesn't exist, the config is saved but never matches. V2: validate IDs against actual org structure.
2. **No "approval master auto-permissions"** — the approval master gets KVP visibility via query extension, but does NOT automatically receive `kvp-suggestions.canWrite` permission. Must be granted manually.
3. **No scope on the `approvals` table itself** — only on `approval_configs`. The individual approval request inherits scope context from the config at creation time.
4. **No cascade deletion** — if an area is deleted, scoped configs are NOT auto-cleaned. V2: trigger or CRON cleanup.
5. **No UI for bulk scope reassignment** — changing an approval master's scope requires delete + recreate of the config row.
