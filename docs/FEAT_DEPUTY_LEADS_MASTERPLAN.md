# FEAT: Deputy Leads on All Hierarchy Levels — Execution Masterplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Created:** 2026-03-21
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planning)
> **Branch:** `refactor/KVP` (current working branch)
> **Spec:** This document (self-contained)
> **Context:** ADR-034 (Hierarchy Labels), ADR-035 (Org Hierarchy), ADR-036 (Scope Access), ADR-038 (Position Catalog)
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 8
> **Actual Sessions:** 0 / 8

---

## Changelog

| Version | Date       | Change                                                                  |
| ------- | ---------- | ----------------------------------------------------------------------- |
| 0.1.0   | 2026-03-21 | Initial Draft — Phases 1-6 planned                                      |
| 0.2.0   | 2026-03-21 | Review fixes: trigger migrations, vacation.service.ts, position seeding |

---

## What Is Being Built?

**Deputy leads (Stellvertreter) on ALL three hierarchy levels — areas, departments, and teams.**

Currently, only `teams` has a `deputy_lead_id` column (DB exists, no UI). This feature:

1. Adds `area_deputy_lead_id` to `areas`
2. Adds `department_deputy_lead_id` to `departments`
3. Renames `teams.deputy_lead_id` → `teams.team_deputy_lead_id` (naming consistency)
4. Adds UI dropdowns in all 3 management modals
5. Grants deputies **equal permissions and visibility** to their corresponding leads
6. Registers 3 system positions in the Position Catalog (ADR-038)
7. Propagates deputy labels via Hierarchy Labels (ADR-034)

### Naming Convention

| Entity      | Lead Column          | Deputy Column                  | Position Key                | Display                               |
| ----------- | -------------------- | ------------------------------ | --------------------------- | ------------------------------------- |
| Areas       | `area_lead_id`       | `area_deputy_lead_id`          | `area_deputy_lead`          | `${labels.area} Stellvertreter`       |
| Departments | `department_lead_id` | `department_deputy_lead_id`    | `department_deputy_lead`    | `${labels.department} Stellvertreter` |
| Teams       | `team_lead_id`       | `team_deputy_lead_id` (rename) | `team_deputy_lead` (rename) | `${labels.team} Stellvertreter`       |

### Permission Model: DEPUTY_EQUALS_LEAD

Deputies have **identical** visibility and scope rights as their lead:

| Scope Check           | Current Pattern                                    | New Pattern                                                         |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Area lead scope       | `WHERE area_lead_id = $1`                          | `WHERE (area_lead_id = $1 OR area_deputy_lead_id = $1)`             |
| Department lead scope | `WHERE department_lead_id = $1`                    | `WHERE (department_lead_id = $1 OR department_deputy_lead_id = $1)` |
| Team lead scope       | `WHERE (team_lead_id = $1 OR deputy_lead_id = $1)` | `WHERE (team_lead_id = $1 OR team_deputy_lead_id = $1)`             |

### Role Categories (Mirror Leads)

| Position Key             | roleCategory | Selectable From         |
| ------------------------ | ------------ | ----------------------- |
| `area_deputy_lead`       | `admin`      | Admin/Root users        |
| `department_deputy_lead` | `admin`      | Admin/Root users        |
| `team_deputy_lead`       | `employee`   | Employees with position |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (all containers healthy)
- [ ] DB Backup created
- [ ] No pending migrations
- [ ] All existing tests green
- [ ] DATABASE-MIGRATION-GUIDE.md re-read (mandatory per project rules)

### 0.2 Risk Register

| #   | Risk                                            | Impact | Probability | Mitigation                                                   | Verification                                                       |
| --- | ----------------------------------------------- | ------ | ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| R1  | Rename `deputy_lead_id` breaks 13 backend files | High   | High        | Single migration + systematic find-replace in one session    | Type-check + ESLint + all tests after rename                       |
| R2  | Position key rename breaks stored DB data       | High   | Medium      | Migration updates `position_catalog.name` + `user_positions` | Query: `SELECT * FROM position_catalog WHERE name LIKE '%deputy%'` |
| R3  | Visibility queries miss a deputy check          | Medium | High        | Comprehensive audit (done — see Section 0.3)                 | Permission tests cover all 3 deputy levels                         |
| R4  | Survey/TPM/Approvals don't include deputies     | Medium | High        | Fix existing bugs as part of this feature                    | API tests for each affected module                                 |
| R5  | Frontend KVP deputy mismatch                    | Low    | High        | Fix frontend team matching to include deputy                 | Manual smoke test                                                  |

### 0.3 Ecosystem Integration Points — Full Audit

Every file below uses `*_lead_id` in permission/visibility logic and MUST be updated:

| File                              | Current Pattern                           | Change Required                          | Phase |
| --------------------------------- | ----------------------------------------- | ---------------------------------------- | ----- |
| `hierarchy-permission.service.ts` | `lead_areas`: area_lead only              | Add `OR area_deputy_lead_id = $1`        | 3     |
|                                   | `lead_depts`: dept_lead only              | Add `OR department_deputy_lead_id = $1`  | 3     |
|                                   | `lead_teams`: team + deputy (unified)     | Rename column reference                  | 3     |
|                                   | `UNNEST_SCOPE`: team + deputy             | Rename column reference                  | 3     |
| `teams.service.ts`                | `deputy_lead_id` in SELECT/UPDATE/cleanup | Rename all to `team_deputy_lead_id`      | 3     |
| `areas.service.ts`                | No deputy column                          | Add `area_deputy_lead_id` handling       | 3     |
| `departments.service.ts`          | No deputy column                          | Add `department_deputy_lead_id` handling | 3     |
| `kvp.helpers.ts`                  | `deputy_lead_id` in unshared clause       | Rename + add area/dept deputy checks     | 3     |
| `user-permissions.service.ts`     | `is_any_lead` check — team deputy only    | Add area/dept deputy to `is_any_lead`    | 3     |
| `survey-access.service.ts`        | NO deputy check at all (**existing bug**) | Add deputy to all 3 levels               | 3     |
| `approvals-config.service.ts`     | Leads only, no deputies                   | Add deputy UNION ALL branches (3 new)    | 3     |
| `vacation.service.ts`             | `deputy_lead_id` in interface + SQL query | Rename to `team_deputy_lead_id`          | 3     |
| `vacation-approver.service.ts`    | team deputy in approval chain             | Rename + add area/dept deputy fallback   | 3     |
| `tpm-approval.service.ts`         | `team_lead_id` only (**existing bug**)    | Add `team_deputy_lead_id` OR check       | 3     |
| `tpm-escalation.service.ts`       | `team_lead_id` only (**existing bug**)    | Add `team_deputy_lead_id` OR check       | 3     |
| `admin-permissions.service.ts`    | area_lead + dept_lead only                | Add deputy checks                        | 3     |
| `organigram.service.ts`           | LEFT JOINs for lead names                 | Add deputy LEFT JOINs + name mapping     | 3     |
| `chat.service.ts`                 | LEFT JOINs for lead detection             | Add deputy LEFT JOINs                    | 3     |
| `frontend kvp/_lib/api.ts`        | `team_lead_id` only (**existing bug**)    | Add `team_deputy_lead_id` check          | 5     |
| `hierarchy-labels.ts`             | `deputy_lead` position key                | Rename + add 2 new position keys         | 2     |
| `position-catalog.types.ts`       | `deputy_lead` system position             | Rename + add 2 new system positions      | 2     |
| `organizational-scope.types.ts`   | `DEPUTY_EQUALS_LEAD` flag                 | Extend for all 3 levels                  | 2     |
| `TeamFormModal.svelte`            | No deputy dropdown                        | Add deputy leader dropdown               | 5     |
| `AreaModal.svelte`                | No deputy field                           | Add deputy leader dropdown               | 5     |
| `DepartmentModal.svelte`          | No deputy field                           | Add deputy leader dropdown               | 5     |
| `manage-teams types.ts`           | `deputyLeaderId` field                    | Rename to match new column               | 5     |
| `manage-areas types.ts`           | No deputy field                           | Add `areaDeputyLeadId`                   | 5     |
| `manage-departments types.ts`     | No deputy field                           | Add `departmentDeputyLeadId`             | 5     |

---

## Phase 1: Database Migrations

> **Dependency:** None (first phase)
> **Files:** 3 new migration files
> **Pre-Requisite:** `doppler run -- ./scripts/run-migrations.sh up --dry-run` must pass before applying

### Step 1.1: Add `area_deputy_lead_id` to `areas` [PENDING]

**New File:** `database/migrations/{timestamp}_add-area-deputy-lead.ts`

**What happens:**

1. `ALTER TABLE areas ADD COLUMN area_deputy_lead_id INTEGER`
2. `ALTER TABLE areas ADD CONSTRAINT fk_areas_deputy_lead FOREIGN KEY (area_deputy_lead_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL`
3. `CREATE INDEX idx_areas_deputy_lead ON areas (area_deputy_lead_id)`
4. `GRANT SELECT, INSERT, UPDATE, DELETE ON areas TO app_user` (already exists, verify)

**down():**

1. Drop index, drop constraint, drop column

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d areas" | grep deputy
```

### Step 1.2: Add `department_deputy_lead_id` to `departments` [PENDING]

**New File:** `database/migrations/{timestamp}_add-department-deputy-lead.ts`

**What happens:**

1. `ALTER TABLE departments ADD COLUMN department_deputy_lead_id INTEGER`
2. `ALTER TABLE departments ADD CONSTRAINT fk_departments_deputy_lead FOREIGN KEY (department_deputy_lead_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL`
3. `CREATE INDEX idx_departments_deputy_lead ON departments (department_deputy_lead_id)`

**down():**

1. Drop index, drop constraint, drop column

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d departments" | grep deputy
```

### Step 1.3: Rename `teams.deputy_lead_id` → `teams.team_deputy_lead_id` [PENDING]

**New File:** `database/migrations/{timestamp}_rename-teams-deputy-lead.ts`

**What happens:**

1. `ALTER TABLE teams RENAME COLUMN deputy_lead_id TO team_deputy_lead_id`
2. `ALTER INDEX idx_teams_deputy_lead RENAME TO idx_teams_team_deputy_lead`
3. Update `position_catalog`: `UPDATE position_catalog SET name = 'team_deputy_lead' WHERE name = 'deputy_lead'`

**down():**

1. Reverse rename column
2. Reverse rename index
3. Reverse position_catalog update

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d teams" | grep deputy
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT name FROM position_catalog WHERE name LIKE '%deputy%'"
```

### Step 1.4: Update DB Triggers for Renamed Column [PENDING]

**New File:** `database/migrations/{timestamp}_update-deputy-lead-triggers.ts`

**CRITICAL:** Two existing triggers reference `deputy_lead_id` and will BREAK after the rename in Step 1.3. This migration MUST run immediately after Step 1.3.

**Trigger 1 — `validate_team_lead_position()` (from migration 093):**

```sql
CREATE OR REPLACE FUNCTION validate_team_lead_position()
RETURNS TRIGGER AS $$
BEGIN
  -- Update reference: NEW.deputy_lead_id → NEW.team_deputy_lead_id
  -- Also add validation functions for area_deputy_lead_id and department_deputy_lead_id
END;
$$ LANGUAGE plpgsql;
```

**Trigger 2 — `enforce_manage_permissions_target_is_lead()` (from migration 095):**

```sql
-- Update reference: t.deputy_lead_id → t.team_deputy_lead_id
-- Add area/department deputy checks to is_lead detection
```

**Also add new triggers:**

1. `validate_area_deputy_lead_position()` on `areas` — ensures deputy has admin/root role
2. `validate_department_deputy_lead_position()` on `departments` — ensures deputy has admin/root role

**down():**

1. Restore original trigger functions referencing `deputy_lead_id`
2. Drop new area/dept deputy triggers

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE '%deputy%' OR tgname LIKE '%lead_position%'"
```

### Step 1.5: Seed New System Positions for Existing Tenants [PENDING]

**New File:** `database/migrations/{timestamp}_seed-deputy-positions.ts`

**What happens:**

The Position Catalog uses lazy seeding (seed on first access via `ensureSystemPositions()`). However, the `SYSTEM_POSITIONS` array must be updated in code first (Phase 2). This migration ensures existing tenants get the new positions:

```sql
INSERT INTO position_catalog (id, tenant_id, name, role_category, sort_order, is_system, is_active)
SELECT gen_random_uuid(), t.id, pos.name, pos.role_category::position_role_category,
       pos.sort_order, true, 1
FROM tenants t
CROSS JOIN (VALUES
  ('area_deputy_lead', 'admin', 4),
  ('department_deputy_lead', 'admin', 5)
) AS pos(name, role_category, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM position_catalog pc
  WHERE pc.tenant_id = t.id AND pc.name = pos.name AND pc.is_active = 1
)
ON CONFLICT DO NOTHING;
```

**down():**

```sql
DELETE FROM position_catalog WHERE name IN ('area_deputy_lead', 'department_deputy_lead') AND is_system = true;
```

### Phase 1 — Definition of Done

- [ ] 5 migration files with `up()` AND `down()`
- [ ] All migrations pass dry-run
- [ ] All migrations applied successfully
- [ ] `areas.area_deputy_lead_id` exists with FK + index
- [ ] `departments.department_deputy_lead_id` exists with FK + index
- [ ] `teams.team_deputy_lead_id` exists (renamed from `deputy_lead_id`)
- [ ] `position_catalog.name = 'team_deputy_lead'` (renamed from `deputy_lead`)
- [ ] DB triggers updated — no broken trigger references to old `deputy_lead_id`
- [ ] New system positions seeded for existing tenants
- [ ] Backend compiles (will have errors — but migration is independent)
- [ ] Backup exists before migrations
- [ ] Customer fresh-install synced: `./scripts/sync-customer-migrations.sh`

---

## Phase 2: Backend Types & Position Catalog

> **Dependency:** Phase 1 complete
> **Files:** ~5 files modified

### Step 2.1: Update Position Catalog Types [PENDING]

**File:** `backend/src/nest/organigram/position-catalog.types.ts`

**Changes:**

1. Rename `{ name: 'deputy_lead', roleCategory: 'employee' }` → `{ name: 'team_deputy_lead', roleCategory: 'employee' }`
2. Add `{ name: 'area_deputy_lead', roleCategory: 'admin' }`
3. Add `{ name: 'department_deputy_lead', roleCategory: 'admin' }`

### Step 2.2: Update Hierarchy Labels (Shared) [PENDING]

**File:** `frontend/src/lib/types/hierarchy-labels.ts`

**Changes:**

1. Rename `LEAD_POSITION_KEYS.DEPUTY` value from `'deputy_lead'` to `'team_deputy_lead'`
2. Add `LEAD_POSITION_KEYS.AREA_DEPUTY = 'area_deputy_lead'`
3. Add `LEAD_POSITION_KEYS.DEPARTMENT_DEPUTY = 'department_deputy_lead'`
4. Update `resolvePositionDisplay()`:
   - Rename case `'deputy_lead'` → `'team_deputy_lead'`
   - Add case `'area_deputy_lead'`: return `${labels.area} Stellvertreter`
   - Add case `'department_deputy_lead'`: return `${labels.department} Stellvertreter`

### Step 2.3: Update Organizational Scope Types [PENDING]

**File:** `backend/src/nest/hierarchy-permission/organizational-scope.types.ts`

**Changes:**

1. Rename any `deputy_lead_id` reference to `team_deputy_lead_id`
2. Document that DEPUTY_EQUALS_LEAD applies to all 3 levels

### Step 2.4: Update Position Validation Trigger (if exists) [PENDING]

**File:** `database/migrations/20260314000000093_validate-lead-positions-trigger.ts`

**Check:** Does the trigger restrict which positions can be set as team_lead_id or deputy_lead_id? If so, update for the new column names + add validation for area/dept deputy columns.

### Phase 2 — Definition of Done

- [ ] `SYSTEM_POSITIONS` has 6 entries: `area_lead`, `department_lead`, `team_lead`, `area_deputy_lead`, `department_deputy_lead`, `team_deputy_lead`
- [ ] `LEAD_POSITION_KEYS` has 6 entries (3 leads + 3 deputies)
- [ ] `resolvePositionDisplay()` handles all 6 position keys
- [ ] `isLeadPosition()` returns true for all 6 keys
- [ ] Type-check passes: `docker exec assixx-backend pnpm run type-check`

---

## Phase 3: Backend Services — Rename & Extend

> **Dependency:** Phase 2 complete
> **Files:** ~15 service files
> **CRITICAL:** This is the largest phase. Work in dependency order.

### Step 3.1: Teams Service — Column Rename [PENDING]

**File:** `backend/src/nest/teams/teams.service.ts`

**Changes:** Systematic find-replace `deputy_lead_id` → `team_deputy_lead_id` in:

- `FIND_ALL_TEAMS_QUERY` (SELECT + LEFT JOIN)
- `buildUpdateFields()` mapping: `['deputyLeaderId', 'team_deputy_lead_id']`
- `cleanupLeadPermissions()` WHERE clause
- `handleLeadPermissionChanges()` logic
- Activity logging references

**Also rename DTO field:** `deputyLeaderId` → `teamDeputyLeadId` in teams DTOs

### Step 3.2: Areas Service — Add Deputy Support [PENDING]

**File:** `backend/src/nest/areas/areas.service.ts`

**Changes:**

1. Add `area_deputy_lead_id` to SELECT queries (with LEFT JOIN for name)
2. Add `areaDeputyLeadId` to create/update DTOs
3. Add `validateLeader()` call for deputy (same validation as area_lead — admin/root role)
4. Add to `buildUpdateFields()` mapping
5. Add `cascadeVacationApprover()` for deputy changes (if applicable)
6. Add to activity logging

### Step 3.3: Departments Service — Add Deputy Support [PENDING]

**File:** `backend/src/nest/departments/departments.service.ts`

**Changes:**

1. Add `department_deputy_lead_id` to SELECT queries (with LEFT JOIN for name)
2. Add `departmentDeputyLeadId` to create/update DTOs
3. Add `validateLeader()` call for deputy
4. Add to `buildUpdateFields()` mapping
5. Add `ensureLeaderInDepartment()` equivalent for deputy
6. Add to activity logging

### Step 3.4: Hierarchy Permission Service — Unify All Deputies [PENDING]

**File:** `backend/src/nest/hierarchy-permission/hierarchy-permission.service.ts`

**Changes to UNIFIED_SCOPE_CTE:**

```sql
-- lead_areas CTE (was: area_lead_id only)
lead_areas AS (
  SELECT id FROM areas
  WHERE (area_lead_id = $1 OR area_deputy_lead_id = $1)
    AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
)

-- lead_depts CTE (was: department_lead_id only)
lead_depts AS (
  SELECT id FROM departments
  WHERE (department_lead_id = $1 OR department_deputy_lead_id = $1)
    AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
)

-- lead_teams CTE (rename column)
lead_teams AS (
  SELECT id FROM teams
  WHERE (team_lead_id = $1 OR team_deputy_lead_id = $1)
    AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
)
```

**Changes to VISIBLE_USERS_QUERY:**

```sql
WHERE (t.team_lead_id = u.id OR t.team_deputy_lead_id = u.id)
```

### Step 3.5: KVP Helpers — Rename + Extend [PENDING]

**File:** `backend/src/nest/kvp/kvp.helpers.ts`

**Changes:**

1. Rename `deputy_lead_id` → `team_deputy_lead_id` in `buildUnsharedClause()`
2. Evaluate: Should KVP unshared visibility also check area/dept deputies? (Probably not — KVP is team-scoped)

### Step 3.6: User Permissions Service — Extend `is_any_lead` [PENDING]

**File:** `backend/src/nest/user-permissions/user-permissions.service.ts`

**Changes to `is_any_lead` query:**

```sql
(EXISTS (SELECT 1 FROM teams t
         WHERE (t.team_lead_id = u.id OR t.team_deputy_lead_id = u.id)
           AND t.is_active = ${IS_ACTIVE.ACTIVE})
 OR EXISTS (SELECT 1 FROM departments d
            WHERE (d.department_lead_id = u.id OR d.department_deputy_lead_id = u.id)
              AND d.is_active = ${IS_ACTIVE.ACTIVE})
 OR EXISTS (SELECT 1 FROM areas a
            WHERE (a.area_lead_id = u.id OR a.area_deputy_lead_id = u.id)
              AND a.is_active = ${IS_ACTIVE.ACTIVE})
) AS is_any_lead
```

### Step 3.7: Survey Access Service — Fix Missing Deputy Checks [PENDING]

**File:** `backend/src/nest/surveys/survey-access.service.ts`

**Changes:**

1. Update `LEADERSHIP_QUERIES.area`: Add `OR a.area_deputy_lead_id = $2`
2. Update `LEADERSHIP_QUERIES.department`: Add `OR d.department_deputy_lead_id = $2`
3. Update `LEADERSHIP_QUERIES.team`: Add `OR t.team_deputy_lead_id = $2` (currently has NO deputy check — **existing bug**)
4. Update visibility clause (lines 357-378): Add deputy OR checks at all 3 levels

### Step 3.8: Approvals Config Service — Add Deputy Branches [PENDING]

**File:** `backend/src/nest/approvals/approvals-config.service.ts`

**Changes to `resolveApprovers()` UNION ALL query:**

Add 3 new UNION ALL branches where deputies can also serve as approvers:

```sql
-- Deputies as team_lead approvers
UNION ALL
SELECT t.team_deputy_lead_id AS approver_id
FROM approval_configs ac
INNER JOIN user_teams ut ON ut.user_id = $2
INNER JOIN teams t ON t.id = ut.team_id
  AND t.team_deputy_lead_id IS NOT NULL
  AND t.is_active = 1
WHERE ac.addon_code = $1 AND ac.approver_type = 'team_lead'

-- Deputies as area_lead approvers
UNION ALL
SELECT a.area_deputy_lead_id AS approver_id
FROM approval_configs ac
INNER JOIN user_departments ud ON ud.user_id = $2
INNER JOIN departments d ON d.id = ud.department_id
INNER JOIN areas a ON a.id = d.area_id
  AND a.area_deputy_lead_id IS NOT NULL
  AND a.is_active = 1
WHERE ac.addon_code = $1 AND ac.approver_type = 'area_lead'

-- Deputies as department_lead approvers
UNION ALL
SELECT d2.department_deputy_lead_id AS approver_id
FROM approval_configs ac
INNER JOIN user_departments ud2 ON ud2.user_id = $2
INNER JOIN departments d2 ON d2.id = ud2.department_id
  AND d2.department_deputy_lead_id IS NOT NULL
  AND d2.is_active = 1
WHERE ac.addon_code = $1 AND ac.approver_type = 'department_lead'
```

### Step 3.9: Vacation Services — Rename + Extend [PENDING]

**File 1:** `backend/src/nest/vacation/vacation.service.ts`

**Changes:**

1. Rename `deputy_lead_id` → `team_deputy_lead_id` in `UserTeamInfoRow` interface (~line 63)
2. Rename in SQL query: `t.deputy_lead_id` → `t.team_deputy_lead_id` (~line 608)

**File 2:** `backend/src/nest/vacation/vacation-approver.service.ts`

**Changes:**

1. Rename `deputy_lead_id` → `team_deputy_lead_id` in approval chain logic
2. Add area/dept deputy as fallback approvers in the approval chain

### Step 3.10: TPM Services — Fix Missing Deputy Checks [PENDING]

**Files:**

- `backend/src/nest/tpm/tpm-approval.service.ts`
- `backend/src/nest/tpm/tpm-escalation.service.ts`

**Changes:**

1. `tpm-approval.service.ts` line 203: `AND (t.team_lead_id = $3 OR t.team_deputy_lead_id = $3)`
2. `tpm-escalation.service.ts` line 275: `AND (t.team_lead_id IS NOT NULL OR t.team_deputy_lead_id IS NOT NULL)`

### Step 3.11: Admin Permissions Service — Add Deputy Checks [PENDING]

**File:** `backend/src/nest/admin-permissions/admin-permissions.service.ts`

**Changes:**

1. Line 789: `WHERE (a.area_lead_id = $1 OR a.area_deputy_lead_id = $1) AND a.tenant_id = $2`
2. Line 829: `WHERE (d.department_lead_id = $1 OR d.department_deputy_lead_id = $1) AND d.tenant_id = $2`

### Step 3.12: Organigram Service — Add Deputy JOINs [PENDING]

**File:** `backend/src/nest/organigram/organigram.service.ts`

**Changes:**

1. Rename `deputy_lead_id` LEFT JOIN → `team_deputy_lead_id`
2. Add deputy LEFT JOINs for areas and departments
3. Map deputy names in response objects

### Step 3.13: Chat Service — Add Deputy JOINs [PENDING]

**File:** `backend/src/nest/chat/chat.service.ts`

**Changes:**

1. Add `LEFT JOIN areas area_deputy ON u.id = area_deputy.area_deputy_lead_id`
2. Add `LEFT JOIN departments dept_deputy ON u.id = dept_deputy.department_deputy_lead_id`
3. Incorporate into lead detection logic

### Phase 3 — Definition of Done

- [ ] All 13+ service files updated
- [ ] Zero references to old column name `deputy_lead_id` remain (grep verification)
- [ ] All deputy checks follow `(lead_id = $1 OR deputy_lead_id = $1)` pattern
- [ ] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/`
- [ ] Type-check passed: `docker exec assixx-backend pnpm run type-check`
- [ ] Survey access includes deputies at all 3 levels (bug fix)
- [ ] TPM includes team deputies (bug fix)
- [ ] Approvals include deputy as fallback approvers

---

## Phase 4: Backend Tests

> **Dependency:** Phase 3 complete
> **Files:** ~6 test files

### Step 4.1: Update Hierarchy Permission Tests [PENDING]

**File:** `backend/src/nest/hierarchy-permission/hierarchy-permission.service.test.ts`

**New test cases:**

- Area deputy has same scope as area lead
- Department deputy has same scope as department lead
- Team deputy has same scope as team lead (rename existing)
- Deputy of one area cannot see another area's data

### Step 4.2: Update KVP Helper Tests [PENDING]

**File:** `backend/src/nest/kvp/kvp.helpers.test.ts`

**Changes:** Rename `deputy_lead_id` references to `team_deputy_lead_id`

### Step 4.3: Update Teams Lead Permission Tests [PENDING]

**File:** `backend/src/nest/teams/teams-lead-permissions.test.ts`

**Changes:** Rename column references

### Step 4.4: Update Vacation Tests [PENDING]

**Files:**

- `backend/src/nest/vacation/vacation.service.test.ts`
- `backend/src/nest/vacation/vacation-approver.service.test.ts`

**Changes:** Rename + add area/dept deputy approval chain tests

### Phase 4 — Definition of Done

- [ ] All existing tests green after rename
- [ ] New tests for area/dept deputy scope
- [ ] All tests: `docker exec assixx-backend pnpm exec vitest run`

---

## Phase 5: Frontend — Modals, Types & API

> **Dependency:** Phase 3 complete (backend endpoints available)

### Step 5.1: Update manage-teams Types + API + Modal [PENDING]

**Files:**

- `frontend/src/routes/(app)/(shared)/manage-teams/_lib/types.ts`
- `frontend/src/routes/(app)/(shared)/manage-teams/_lib/api.ts`
- `frontend/src/routes/(app)/(shared)/manage-teams/_lib/TeamFormModal.svelte`
- `frontend/src/routes/(app)/(shared)/manage-teams/+page.svelte`

**Changes:**

1. `types.ts`: Rename `deputyLeaderId` → `teamDeputyLeadId`, `deputyLeaderName` → `teamDeputyLeadName`
2. `api.ts`: Update field mappings
3. `TeamFormModal.svelte`: Add deputy leader dropdown (same pattern as leader dropdown — separate dropdown state, select function, display text)
4. `+page.svelte`: Wire new deputy field into form state + submit handler

### Step 5.2: Update manage-areas Types + API + Modal [PENDING]

**Files:**

- `frontend/src/routes/(app)/(shared)/manage-areas/_lib/types.ts`
- `frontend/src/routes/(app)/(shared)/manage-areas/_lib/api.ts`
- `frontend/src/routes/(app)/(shared)/manage-areas/_lib/AreaModal.svelte`
- `frontend/src/routes/(app)/(shared)/manage-areas/+page.svelte`

**Changes:**

1. `types.ts`: Add `areaDeputyLeadId: number | null`, `areaDeputyLeadName: string | null`
2. `api.ts`: Add to create/update payloads
3. `AreaModal.svelte`: Add deputy lead dropdown (same user pool as area lead — admin/root users)
4. `+page.svelte`: Wire into form state
5. `constants.ts`: Add deputy-related messages to `createMessages()` factory

### Step 5.3: Update manage-departments Types + API + Modal [PENDING]

**Files:**

- `frontend/src/routes/(app)/(shared)/manage-departments/_lib/types.ts`
- `frontend/src/routes/(app)/(shared)/manage-departments/_lib/api.ts`
- `frontend/src/routes/(app)/(shared)/manage-departments/_lib/DepartmentModal.svelte`
- `frontend/src/routes/(app)/(shared)/manage-departments/+page.svelte`

**Changes:**

1. `types.ts`: Add `departmentDeputyLeadId: number | null`, `departmentDeputyLeadName: string | null`
2. `api.ts`: Add to create/update payloads
3. `DepartmentModal.svelte`: Add deputy lead dropdown (same user pool as dept lead — admin/root users)
4. `+page.svelte`: Wire into form state
5. `constants.ts`: Add deputy-related messages

### Step 5.4: Fix Frontend KVP Deputy Check [PENDING]

**File:** `frontend/src/routes/(app)/(shared)/kvp/_lib/api.ts`

**Changes (line ~329):**

```typescript
userTeam = teams.find(
  (team) =>
    team.team_lead_id === userId ||
    team.teamLeadId === userId ||
    team.leaderId === userId ||
    team.teamDeputyLeadId === userId, // <-- ADD
);
```

### Step 5.5: Update Organigram NodeDetailModal [PENDING]

**File:** `frontend/src/routes/(app)/(root)/settings/organigram/_lib/types.ts`

**Changes:** Rename `deputyLead` → `teamDeputyLead`, add `areaDeputyLead`, `departmentDeputyLead`

**File:** `frontend/src/routes/(app)/(root)/settings/organigram/_lib/NodeDetailModal.svelte`

**Changes:** Update label mapping for all 3 deputy types

### Step 5.6: Update Positions Page — LEAD_ORDER + Display [PENDING]

**File:** `frontend/src/routes/(app)/(root)/settings/organigram/positions/+page.svelte`

**Changes:**

1. Update `LEAD_ORDER` array (line 55-60):

```typescript
const LEAD_ORDER = [
  'area_lead',
  'area_deputy_lead', // NEW
  'department_lead',
  'department_deputy_lead', // NEW
  'team_lead',
  'team_deputy_lead', // RENAMED from 'deputy_lead'
];
```

2. `displayName()` already calls `resolvePositionDisplay()` for system positions — no change needed there (auto-resolves via updated `LEAD_POSITION_KEYS`)

**Result:** The positions list will show 6 system positions:

- Bereiche-Leiter (System)
- Bereiche Stellvertreter (System)
- Abteilungen-Leiter (System)
- Abteilungen Stellvertreter (System)
- Teams-Leiter (System)
- Teams Stellvertreter (System)

(With custom labels, e.g. "Segmente Stellvertreter" if tenant renamed departments)

### Phase 5 — Definition of Done

- [ ] All 3 management modals have deputy lead dropdown
- [ ] Deputy dropdown uses same user pool as lead (admin/root for area/dept, employees for teams)
- [ ] CRUD operations work for all 3 deputy fields
- [ ] Positions page shows 6 system positions in correct order
- [ ] `svelte-check` 0 errors: `cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json`
- [ ] ESLint 0 errors: `cd frontend && pnpm exec eslint src/routes/`
- [ ] Frontend KVP deputy visibility fixed
- [ ] Organigram shows all deputy names

---

## Phase 6: Integration, Polish & Documentation

> **Dependency:** Phase 5 complete

### Step 6.1: Verify ADR-010 Permission Inheritance [PENDING]

Verify that ADR-010's Access Check Flow works for all 3 deputy levels:

- [ ] Area deputy → same visibility as area lead (all depts + teams in area)
- [ ] Department deputy → same visibility as dept lead (all teams in dept)
- [ ] Team deputy → same visibility as team lead

### Step 6.2: Update ADR-035 [PENDING]

**File:** `docs/infrastructure/adr/ADR-035-organizational-hierarchy-and-assignment-architecture.md`

Add deputy lead columns to the hierarchy documentation.

### Step 6.3: Update ADR-034 [PENDING]

**File:** `docs/infrastructure/adr/ADR-034-hierarchy-labels-propagation.md`

Update the V2.3 section to reflect 3 deputy positions instead of 1.

### Step 6.4: Smoke Test Checklist [PENDING]

- [ ] Set area deputy → deputy sees all area content
- [ ] Set department deputy → deputy sees all dept content
- [ ] Set team deputy → deputy sees all team content
- [ ] Remove deputy → visibility revoked
- [ ] Organigram shows all 3 deputy types
- [ ] Position catalog shows all 6 system positions
- [ ] Vacation approval chain includes deputies
- [ ] Survey visibility includes deputies
- [ ] TPM approval includes team deputies
- [ ] KVP unshared visibility includes team deputies

### Phase 6 — Definition of Done

- [ ] All smoke tests pass
- [ ] ADR-035 updated
- [ ] ADR-034 updated
- [ ] No `deputy_lead_id` references remain in codebase (only `*_deputy_lead_id`)
- [ ] Zero ESLint errors backend + frontend
- [ ] Zero type-check errors
- [ ] All tests green

---

## Session Tracking

| Session | Phase | Description                                         | Status | Date |
| ------- | ----- | --------------------------------------------------- | ------ | ---- |
| 1       | 1     | DB Migrations: 3 new migration files                |        |      |
| 2       | 2     | Backend types + position catalog + hierarchy labels |        |      |
| 3       | 3     | Backend services: teams rename + areas/depts extend |        |      |
| 4       | 3     | Backend services: hierarchy-perm + kvp + surveys    |        |      |
| 5       | 3     | Backend services: approvals + vacation + TPM + chat |        |      |
| 6       | 4     | Backend tests: update existing + add new            |        |      |
| 7       | 5     | Frontend: all 3 modals + types + API + KVP fix      |        |      |
| 8       | 6     | Integration + ADR updates + smoke tests             |        |      |

---

## Quick Reference: File Paths

### Database (new — 5 files)

| File                                                      | Purpose                                        |
| --------------------------------------------------------- | ---------------------------------------------- |
| `database/migrations/{ts}_add-area-deputy-lead.ts`        | Add column to areas                            |
| `database/migrations/{ts}_add-department-deputy-lead.ts`  | Add column to departments                      |
| `database/migrations/{ts}_rename-teams-deputy-lead.ts`    | Rename column in teams + position catalog      |
| `database/migrations/{ts}_update-deputy-lead-triggers.ts` | Fix triggers referencing old column name       |
| `database/migrations/{ts}_seed-deputy-positions.ts`       | Seed new system positions for existing tenants |

### Backend (modified — ~16 files)

| File                              | Change                          |
| --------------------------------- | ------------------------------- |
| `position-catalog.types.ts`       | 3 new system positions          |
| `organizational-scope.types.ts`   | Extend DEPUTY_EQUALS_LEAD       |
| `teams.service.ts`                | Rename column references        |
| `areas.service.ts`                | Add deputy CRUD                 |
| `departments.service.ts`          | Add deputy CRUD                 |
| `hierarchy-permission.service.ts` | Unify all 3 levels              |
| `kvp.helpers.ts`                  | Rename column                   |
| `user-permissions.service.ts`     | Extend is_any_lead              |
| `survey-access.service.ts`        | Fix missing deputy checks (bug) |
| `approvals-config.service.ts`     | Add 3 deputy UNION branches     |
| `vacation.service.ts`             | Rename column references        |
| `vacation-approver.service.ts`    | Rename + extend                 |
| `tpm-approval.service.ts`         | Fix missing deputy check (bug)  |
| `tpm-escalation.service.ts`       | Fix missing deputy check (bug)  |
| `admin-permissions.service.ts`    | Add deputy checks               |
| `organigram.service.ts`           | Add deputy JOINs                |
| `chat.service.ts`                 | Add deputy JOINs                |

### Frontend (modified — ~15 files)

| File                                     | Change                                 |
| ---------------------------------------- | -------------------------------------- |
| `hierarchy-labels.ts`                    | 3 new position keys + display          |
| `manage-teams/_lib/*`                    | Rename + add dropdown                  |
| `manage-areas/_lib/*`                    | Add deputy field + dropdown            |
| `manage-departments/_lib/*`              | Add deputy field + dropdown            |
| `kvp/_lib/api.ts`                        | Fix deputy visibility (bug)            |
| `organigram/_lib/types.ts`               | Add deputy types                       |
| `organigram/_lib/NodeDetailModal.svelte` | Add deputy display                     |
| `organigram/positions/+page.svelte`      | Update LEAD_ORDER (6 system positions) |

---

## Spec Deviations

| #   | Original Spec                           | Actual Implementation            | Decision                                      |
| --- | --------------------------------------- | -------------------------------- | --------------------------------------------- |
| D1  | `deputy_lead` is a single position key  | Split into 3: area/dept/team     | Required for 3 hierarchy levels               |
| D2  | Teams `deputy_lead_id` column name kept | Renamed to `team_deputy_lead_id` | Consistency with `{entity}_*_lead_id` pattern |

---

## Known Limitations (V1 — Intentionally Excluded)

1. **No deputy on hall level** — Halls have no lead column at all. Out of scope.
2. **No deputy-specific approval type** — Deputies piggyback on `approver_type = 'team_lead'` etc. No separate `'team_deputy_lead'` type. Simplifies approval config.
3. **No deputy self-service** — Deputies are assigned by admins only, no self-request workflow.
4. **No cascading deputy cleanup** — If area_lead changes, area_deputy is NOT auto-cleared. Manual management.
5. **No deputy for department groups** — Department groups are logical, not org-chart entities.
