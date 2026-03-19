# FEAT: Position Catalog — Execution Masterplan

> **Created:** 2026-03-17
> **Version:** 0.3.0 (3rd review pass)
> **Status:** DRAFT — Phase 0 (Planning)
> **Branch:** `feat/position-catalog`
> **ADR:** [ADR-038](./infrastructure/adr/ADR-038-position-catalog-architecture.md)
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 6
> **Actual Sessions:** 0 / 6

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                          |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-03-17 | Initial Draft — Phases 1-5 planned                                                                                                                                                                                              |
| 0.2.0   | 2026-03-17 | Review corrections: ENUM fix, unique index, routing, seed trigger, merged sessions, production migration path                                                                                                                   |
| 0.2.1   | 2026-03-18 | Fix: down() data cleanup before index rebuild + ENUM recast, getConfigs() position-name JOIN, createConfig() duplicate-check for position-type, ADR session count                                                               |
| 0.3.0   | 2026-03-18 | UNIQUE → partial index (soft-delete safe), CHECK constraint (mutual exclusivity), TBD resolved (form modals), production migration excludes system positions, PUT facade marked @deprecated, system-position mapping documented |

---

## Problem Statement

Positions in Assixx are currently **free-text strings** stored in `tenants.settings` JSONB
(`positionOptions` key). They have no UUID, no FK constraints, no referential integrity.
The `users.position` field is a plain VARCHAR.

This makes it impossible to:

1. Reference a position from `approval_configs` (approval master by position)
2. Assign multiple positions to a single user (N:M)
3. Safely rename a position without breaking references
4. Build any future position-based logic (skill matrix, shift planning by qualification)

**Goal:** Promote positions from free-text labels to first-class DB entities with UUIDs,
enabling position-based approval masters and multi-position user assignments.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (all containers healthy)
- [ ] DB Backup created
- [ ] DB reset executed (tenant data wiped, seeds intact)
- [ ] Branch `feat/position-catalog` checked out
- [ ] No pending migrations
- [ ] Approvals V1 (ADR-037) complete and merged

### 0.2 Risk Register

| #   | Risk                                        | Impact | Probability | Mitigation                                                              | Verification                                                    |
| --- | ------------------------------------------- | ------ | ----------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| R1  | `users.position` VARCHAR code breakage      | High   | High        | Keep `users.position` as-is, add N:M as supplement                      | Grep all `users.position` usages, verify no breakage            |
| R2  | Position rename breaks approval configs     | Medium | Low         | FK on UUID, not on name — rename is safe                                | Unit test: rename position, verify config still works           |
| R3  | Organigram positions page regression        | High   | Medium      | Backward-compat facade on `position-options` endpoint                   | API test: GET/PUT position-options returns same shape           |
| R4  | System positions (leads) duplication        | Medium | Medium      | `is_system = true` positions are auto-seeded, not editable              | Seed via `ON CONFLICT DO NOTHING` + UI lock icon                |
| R5  | ENUM extension irreversible                 | Medium | Certain     | `ALTER TYPE ... ADD VALUE` cannot be rolled back — document in `down()` | Migration `down()` uses detach-drop-recreate pattern            |
| R6  | Unique index collision on approval_configs  | High   | Certain     | Rebuild index with `approver_position_id` dimension                     | Test: 2 different positions as approver for same addon succeeds |
| R7  | Frontend consumers break (4 pages + modals) | High   | Medium      | Same response shape from `position-options` endpoint                    | Manual test: manage-employees, manage-admins, manage-root       |

### 0.3 Ecosystem Integration Points

| Existing System                                    | Integration Type                                                            | Phase |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ----- |
| `approval_configs`                                 | New `approver_type: 'position'` (ENUM) + FK                                 | 1     |
| `approval_approver_type` ENUM                      | `ALTER TYPE ... ADD VALUE 'position'`                                       | 1     |
| `idx_approval_configs_unique` index                | DROP + CREATE with `approver_position_id` dimension                         | 1     |
| `tenants.settings` JSONB                           | `organigram-settings.service.ts` refactored to read from `position_catalog` | 2     |
| `approvals-config.service.ts`                      | `resolveApprovers()` UNION ALL: new 5th branch for `position` type          | 2     |
| Organigram positions page                          | Rewrite from JSONB CRUD to DB table CRUD                                    | 4     |
| Approval settings page                             | New dropdown for position-based approval master                             | 4     |
| manage-employees/+page.server.ts                   | Consumes `position-options` — backward-compat required                      | 5     |
| manage-admins/+page.server.ts                      | Consumes `position-options` — backward-compat required                      | 5     |
| manage-root/+page.server.ts                        | Consumes `position-options` — backward-compat required                      | 5     |
| EmployeeFormModal / AdminFormModal / RootUserModal | Position dropdown — backward-compat required                                | 5     |
| `users.position` VARCHAR                           | Keep as legacy display field (no change)                                    | —     |
| Permission Registry                                | No change (positions are not permissions)                                   | —     |

---

## Phase 1: Database Migrations

> **Dependency:** None (first phase)
> **Files:** 1 migration file (all schema changes combined)

### Step 1.1: Create tables + extend approval_configs [PENDING]

**New file:** `database/migrations/{timestamp}_position-catalog.ts`

**Schema:**

```sql
-- =============================================================================
-- 1. ENUM: position_role_category
-- =============================================================================
CREATE TYPE position_role_category AS ENUM ('employee', 'admin', 'root');

-- =============================================================================
-- 2. TABLE: position_catalog
-- =============================================================================
CREATE TABLE position_catalog (
    id UUID PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    role_category position_role_category NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: only active positions must be unique.
-- Soft-deleted positions (is_active=4) do NOT block re-creation of the same name.
CREATE UNIQUE INDEX idx_position_catalog_unique
    ON position_catalog (tenant_id, name, role_category)
    WHERE is_active = 1;

CREATE INDEX idx_position_catalog_tenant ON position_catalog(tenant_id);
CREATE INDEX idx_position_catalog_active ON position_catalog(tenant_id, is_active)
    WHERE is_active = 1;

ALTER TABLE position_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_catalog FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON position_catalog FOR ALL
    USING (NULLIF(current_setting('app.tenant_id', true), '') IS NULL
           OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);
GRANT SELECT, INSERT, UPDATE, DELETE ON position_catalog TO app_user;

-- Update trigger
CREATE TRIGGER update_position_catalog_updated_at
    BEFORE UPDATE ON position_catalog
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 3. TABLE: user_positions (N:M)
-- =============================================================================
CREATE TABLE user_positions (
    id UUID PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES position_catalog(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, position_id)
);

CREATE INDEX idx_user_positions_tenant ON user_positions(tenant_id);
CREATE INDEX idx_user_positions_user ON user_positions(user_id);
CREATE INDEX idx_user_positions_position ON user_positions(position_id);

ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_positions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_positions FOR ALL
    USING (NULLIF(current_setting('app.tenant_id', true), '') IS NULL
           OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);
GRANT SELECT, INSERT, UPDATE, DELETE ON user_positions TO app_user;

-- =============================================================================
-- 4. ENUM: extend approval_approver_type with 'position'
-- =============================================================================
-- NOTE: ALTER TYPE ... ADD VALUE is IRREVERSIBLE in PostgreSQL.
-- down() must use the detach-drop-recreate workaround.
ALTER TYPE approval_approver_type ADD VALUE IF NOT EXISTS 'position';

-- =============================================================================
-- 5. COLUMN: approval_configs.approver_position_id
-- =============================================================================
ALTER TABLE approval_configs
    ADD COLUMN approver_position_id UUID REFERENCES position_catalog(id) ON DELETE RESTRICT;

-- Mutual exclusivity: exactly one of approver_user_id / approver_position_id / neither
-- must be set, matching the approver_type.
ALTER TABLE approval_configs ADD CONSTRAINT chk_approver_type_fields CHECK (
    (approver_type = 'user' AND approver_user_id IS NOT NULL AND approver_position_id IS NULL)
    OR (approver_type = 'position' AND approver_position_id IS NOT NULL AND approver_user_id IS NULL)
    OR (approver_type IN ('team_lead', 'area_lead', 'department_lead')
        AND approver_user_id IS NULL AND approver_position_id IS NULL)
);

-- =============================================================================
-- 6. INDEX: rebuild unique index to include approver_position_id
-- =============================================================================
-- Current index: UNIQUE (tenant_id, addon_code, approver_type, COALESCE(approver_user_id, 0))
-- Problem: For approver_type='position', approver_user_id is always NULL → COALESCE=0,
-- which means only ONE position-config per addon per tenant would be allowed.
-- Fix: Add approver_position_id dimension.
DROP INDEX idx_approval_configs_unique;
CREATE UNIQUE INDEX idx_approval_configs_unique
    ON approval_configs (
        tenant_id,
        addon_code,
        approver_type,
        COALESCE(approver_user_id, 0),
        COALESCE(approver_position_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE is_active = 1;
```

**`down()` function:**

```sql
-- WARNING: One-way migration for ENUM extension.
-- The ENUM value 'position' cannot be removed with ALTER TYPE.
-- Full rollback requires detach-drop-recreate pattern.

-- 1. DELETE position-type rows FIRST — prevents index collision + ENUM cast failure
DELETE FROM approval_configs WHERE approver_type = 'position';

-- 2. Rebuild old unique index (safe now — no position rows remain)
DROP INDEX IF EXISTS idx_approval_configs_unique;
CREATE UNIQUE INDEX idx_approval_configs_unique
    ON approval_configs (tenant_id, addon_code, approver_type, COALESCE(approver_user_id, 0))
    WHERE is_active = 1;

-- 3. Drop CHECK constraint + position column
ALTER TABLE approval_configs DROP CONSTRAINT IF EXISTS chk_approver_type_fields;
ALTER TABLE approval_configs DROP COLUMN IF EXISTS approver_position_id;

-- 4. Drop tables (CASCADE handles policies, indexes, triggers)
DROP TABLE IF EXISTS user_positions CASCADE;
DROP TABLE IF EXISTS position_catalog CASCADE;

-- 5. ENUM rollback: detach column, recreate type without 'position'
--    Safe now — no rows with 'position' value exist (deleted in step 1)
ALTER TABLE approval_configs ALTER COLUMN approver_type TYPE VARCHAR(20);
DROP TYPE IF EXISTS approval_approver_type;
CREATE TYPE approval_approver_type AS ENUM ('user', 'team_lead', 'area_lead', 'department_lead');
ALTER TABLE approval_configs ALTER COLUMN approver_type TYPE approval_approver_type
    USING approver_type::approval_approver_type;

-- 6. Drop position_role_category ENUM
DROP TYPE IF EXISTS position_role_category;
```

**Key design decisions:**

- `position_role_category` is a proper PostgreSQL ENUM (consistent with codebase convention)
- `approval_approver_type` extended via `ALTER TYPE ... ADD VALUE` — irreversible, `down()` uses detach-drop-recreate
- Unique index rebuilt with `COALESCE(approver_position_id, ...)` to allow multiple position-configs per addon
- `ON DELETE RESTRICT` on both FKs — can't delete a position that's assigned or used as approval master
- `update_updated_at_column()` trigger on `position_catalog` (existing pattern)
- `users.position` VARCHAR is NOT touched — backward compatible
- All schema changes in ONE migration (< 100 lines SQL, single session)

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d position_catalog"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d user_positions"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d approval_configs"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('position_catalog', 'user_positions');"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'approval_configs';"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'approval_approver_type'::regtype ORDER BY enumsortorder;"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'position_role_category'::regtype ORDER BY enumsortorder;"
```

### Phase 1 — Definition of Done

- [ ] 1 migration file with `up()` AND `down()`
- [ ] `down()` deletes position-type rows BEFORE index rebuild + ENUM recast
- [ ] `down()` documents ENUM irreversibility and uses detach-drop-recreate
- [ ] Dry-run passes: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [ ] All migrations applied successfully
- [ ] 2 new tables with RLS policies (verified)
- [ ] `approval_configs` has `approver_position_id` column
- [ ] `approval_approver_type` ENUM contains 'position' value
- [ ] `position_role_category` ENUM contains 'employee', 'admin', 'root'
- [ ] Unique index `idx_approval_configs_unique` includes `approver_position_id` dimension
- [ ] Backend compiles without errors
- [ ] Existing tests still pass
- [ ] Backup created before migrations

---

## Phase 2: Backend — Position Catalog Module

> **Dependency:** Phase 1 complete
> **Reference:** `backend/src/nest/organigram/` (existing position logic)

### Step 2.1: Types + DTOs [PENDING]

**New/modified files:**

- `backend/src/nest/organigram/position-catalog.types.ts`
- `backend/src/nest/organigram/dto/upsert-position.dto.ts`
- `backend/src/nest/organigram/dto/assign-position.dto.ts`

**Types:**

```typescript
interface PositionCatalogRow {
  id: string; // UUID
  tenant_id: number;
  name: string;
  role_category: 'employee' | 'admin' | 'root';
  sort_order: number;
  is_system: boolean;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface PositionCatalogEntry {
  id: string;
  name: string;
  roleCategory: 'employee' | 'admin' | 'root';
  sortOrder: number;
  isSystem: boolean;
}

interface UserPositionRow {
  id: string;
  user_id: number;
  position_id: string;
  position_name: string; // JOINed
  role_category: string; // JOINed
}
```

### Step 2.2: PositionCatalogService [PENDING]

**File:** `backend/src/nest/organigram/position-catalog.service.ts`

**Methods:**

- `getAll(tenantId, roleCategory?)` — list positions (with optional filter)
- `create(tenantId, dto)` — create new position
- `update(tenantId, positionId, dto)` — rename/reorder (system positions blocked)
- `delete(tenantId, positionId)` — soft-delete (system positions blocked, FK check)
- `ensureSystemPositions(tenantId)` — lazy seed on first access (see below)

**System Position Seed Trigger:**
Lazy seed on first `GET /organigram/positions` call per tenant. Implementation:

```typescript
async ensureSystemPositions(tenantId: number): Promise<void> {
  // INSERT ... ON CONFLICT (tenant_id, name, role_category) DO NOTHING
  // No race condition: ON CONFLICT is atomic.
  // Called at the beginning of getAll().
}
```

System positions seeded:

- `team_lead` (role_category: `employee`, is_system: `true`)
- `area_lead` (role_category: `admin`, is_system: `true`)
- `department_lead` (role_category: `admin`, is_system: `true`)

**Critical:**

- System positions (`is_system = true`) cannot be edited or deleted
- `ON DELETE RESTRICT` on FK means DB blocks deletion if position is assigned

### Step 2.3: Refactor organigram-settings.service.ts [PENDING]

**Modified file:** `backend/src/nest/organigram/organigram-settings.service.ts`

**Changes:**

- `getPositionOptions(tenantId)` — refactored to read from `position_catalog` instead of `tenants.settings` JSONB
- `updatePositionOptions(tenantId, dto)` — refactored to upsert into `position_catalog` instead of JSONB
- Return shape stays identical: `{ employee: string[], admin: string[], root: string[] }`
- **System position mapping:** `position_catalog.name` is returned as-is (e.g. `'team_lead'`). The frontend auto-injects system positions by checking against `LEAD_POSITION_KEYS` — this behavior is unchanged since `name = 'team_lead'` matches the existing text in the JSONB arrays.
- This is the backward-compat facade — all existing consumers (manage-employees, manage-admins, manage-root, EmployeeFormModal, AdminFormModal, RootUserModal) continue to work without changes
- **Mark as transitional artifact:** Both methods should carry a `@deprecated` JSDoc tag with note: "Use PositionCatalogService CRUD methods directly. This facade will be removed once all frontend consumers migrate to the position_catalog API."

### Step 2.4: UserPositionService [PENDING]

**File:** `backend/src/nest/organigram/user-position.service.ts`

**Methods:**

- `getByUser(tenantId, userId)` — list all positions for a user
- `getByPosition(tenantId, positionId)` — list all users with a position
- `assign(tenantId, userId, positionId)` — assign position to user (idempotent via `ON CONFLICT DO NOTHING`)
- `unassign(tenantId, userId, positionId)` — remove position from user
- `hasPosition(tenantId, userId, positionId)` — check if user has position

### Step 2.5: Approval Service Extension [PENDING]

**Modified file:** `backend/src/nest/approvals/approvals-config.service.ts`

**Changes to `resolveApprovers()` — add 5th UNION ALL branch:**

```sql
-- Existing 4 branches: user, team_lead, area_lead, department_lead
-- NEW 5th branch for position type:
UNION ALL

SELECT DISTINCT u.id AS approver_id
FROM approval_configs ac
INNER JOIN user_positions up ON up.position_id = ac.approver_position_id
INNER JOIN users u ON u.id = up.user_id
    AND u.is_active = 1
WHERE ac.addon_code = $1
    AND ac.approver_type = 'position'
    AND ac.approver_position_id IS NOT NULL
    AND ac.is_active = 1
```

**Also modified:** `approvals-config.service.ts` — `getConfigs()`:

- Current query: `LEFT JOIN users u ON u.id = ac.approver_user_id` — returns NULL for position-type configs
- Add: `LEFT JOIN position_catalog pc ON pc.id = ac.approver_position_id`
- New column in SELECT: `pc.name AS approver_position_name`
- Frontend needs this to display "Qualitätsmanager" instead of a UUID

**Also modified:** `approvals-config.service.ts` — `createConfig()`:

- Current duplicate check uses `COALESCE(approver_user_id, 0) = $4` — for position-type configs this is always 0, causing false duplicates between different positions
- Fix: add `AND COALESCE(approver_position_id, '00000000-0000-0000-0000-000000000000'::uuid) = $5` to the WHERE clause
- INSERT must include `approver_position_id` column
- RETURNING subquery must include position name

**Also modified:** `backend/src/nest/approvals/approvals.service.ts`

- `createConfig()` accepts `approverType: 'position'` + `approverPositionId`

**Also modified:** `backend/src/nest/approvals/approvals.types.ts`

- Add `'position'` to `ApprovalApproverType` union
- Add `approverPositionId: string | null` and `approverPositionName: string | null` to config types
- Update `mapConfigRowToApi()` to include position fields

**Also modified:** `backend/src/nest/approvals/dto/upsert-approval-config.dto.ts`

- Add `approverPositionId` to Zod schema (nullable, required when `approverType === 'position'`)

### Step 2.6: Controller Endpoints [PENDING]

**Position catalog routes in `organigram.controller.ts`:**

| Method | Route                             | Description                   |
| ------ | --------------------------------- | ----------------------------- |
| GET    | `/organigram/positions`           | List all positions (catalog)  |
| POST   | `/organigram/positions`           | Create position               |
| PUT    | `/organigram/positions/:id`       | Update position               |
| DELETE | `/organigram/positions/:id`       | Soft-delete position          |
| GET    | `/organigram/positions/:id/users` | List users with this position |

**User-scoped position routes in `users.controller.ts`** (NOT organigram — `/users/...` routes belong in users controller):

| Method | Route                              | Description                 |
| ------ | ---------------------------------- | --------------------------- |
| GET    | `/users/:id/positions`             | List positions of a user    |
| POST   | `/users/:id/positions`             | Assign position to user     |
| DELETE | `/users/:id/positions/:positionId` | Unassign position from user |

**Backward compat:** `GET/PUT /organigram/position-options` stays — internally reads/writes `position_catalog` via refactored `organigram-settings.service.ts`.

### Phase 2 — Definition of Done

- [ ] PositionCatalogService with full CRUD + lazy system seed
- [ ] organigram-settings.service.ts refactored (JSONB → position_catalog)
- [ ] UserPositionService with assign/unassign/check
- [ ] `resolveApprovers()` in `approvals-config.service.ts` extended with 5th UNION ALL branch
- [ ] Approval DTOs/types extended for `approver_type: 'position'`
- [ ] Position catalog routes in organigram controller
- [ ] User position routes in users controller
- [ ] All endpoints working via curl
- [ ] System positions auto-seeded on first access via `ON CONFLICT DO NOTHING`
- [ ] Backward-compat: `GET/PUT /organigram/position-options` returns same shape `{ employee: string[], admin: string[], root: string[] }`
- [ ] ESLint 0 errors
- [ ] Type-check passes

---

## Phase 3: Unit + API Tests

> **Dependency:** Phase 2 complete

### Step 3.1: Unit Tests [PENDING]

**Files:**

- `backend/src/nest/organigram/position-catalog.service.test.ts`
- `backend/src/nest/organigram/user-position.service.test.ts`
- `backend/src/nest/approvals/approvals-config.service.test.ts` (extend)

**Critical test scenarios:**

- [ ] CRUD happy path for position catalog
- [ ] System position protection (edit/delete blocked → ForbiddenException)
- [ ] Duplicate name → ConflictException
- [ ] Delete position with active users → blocked by FK (DB error)
- [ ] Delete position used as approval master → blocked by FK (DB error)
- [ ] Assign/unassign positions to user (idempotent)
- [ ] `resolveApprovers()` with `approver_type = 'position'` → returns users with matching position
- [ ] Position rename does NOT break approval config reference (UUID stays)
- [ ] `ensureSystemPositions()` is idempotent (ON CONFLICT DO NOTHING)
- [ ] `getPositionOptions()` backward-compat shape

### Step 3.2: API Integration Tests [PENDING]

**File:** `backend/test/position-catalog.api.test.ts`

**Scenarios (>= 20 assertions):**

- [ ] Unauthenticated → 401
- [ ] CRUD lifecycle (create → list → update → delete)
- [ ] System position cannot be modified (409 or 403)
- [ ] Assign position to user → user has position
- [ ] Two different positions as approver for same addon → both allowed (unique index fix verified)
- [ ] Position-based approval master → user with position can approve
- [ ] User without position cannot approve
- [ ] `GET /organigram/position-options` backward-compat shape

### Phase 3 — Definition of Done

- [ ] > = 60 unit tests
- [ ] > = 20 API integration tests
- [ ] All tests green
- [ ] Coverage: all public methods have at least 1 test

---

## Phase 4: Frontend — Positions Page Rewrite

> **Dependency:** Phase 2 complete (endpoints available)
> **Reference:** Current `/settings/organigram/positions` page

### Step 4.1: Positions Page — CRUD on `position_catalog` [PENDING]

**Modified files:**

- `frontend/src/routes/(app)/(root)/settings/organigram/positions/+page.svelte`
- `frontend/src/routes/(app)/(root)/settings/organigram/positions/+page.server.ts`

**Changes:**

- Replace JSONB text-array management with real CRUD on `position_catalog`
- Each position shows: name, role category, system badge, sort order
- System positions: lock icon + "System" badge (existing pattern, keep as-is)
- Add/edit/delete custom positions via API
- Keep existing 3-tab layout (Employee / Admin / Root)

### Step 4.2: Approval Settings — Position Dropdown [PENDING]

**Modified files:**

- `frontend/src/routes/(app)/(admin)/settings/approvals/+page.svelte`
- `frontend/src/routes/(app)/(admin)/settings/approvals/_lib/constants.ts`
- `frontend/src/routes/(app)/(admin)/settings/approvals/_lib/types.ts`

**Changes:**

- Add 5th approver type option: "Position" with searchable dropdown
- When "Position" selected: show dropdown with all `position_catalog` entries
- Grouped by role_category (Employee / Admin / Root)
- Create approval config with `approverType: 'position'` + `approverPositionId`

### Step 4.3: User Position Assignment UI [PENDING]

**Location:** Existing form modals — extend the position dropdown to multi-select.

**Modified files:**

- `frontend/src/routes/(app)/(shared)/manage-employees/_lib/EmployeeFormModal.svelte`
- `frontend/src/routes/(app)/(root)/manage-admins/_lib/AdminFormModal.svelte`
- `frontend/src/routes/(app)/(root)/manage-root/_lib/RootUserModal.svelte`

**Changes:**

- Current: single `<select>` with `positionOptions: string[]` → sets `users.position` VARCHAR
- New: multi-select chips from `position_catalog` → manages `user_positions` N:M
- `users.position` VARCHAR stays populated with the primary/first selected position (backward compat)
- On save: sync `user_positions` via `POST/DELETE /users/:id/positions`

### Phase 4 — Definition of Done

- [ ] Positions page uses real CRUD (no more JSONB)
- [ ] Approval settings has position-based approver type
- [ ] User position assignment works
- [ ] svelte-check 0 errors
- [ ] ESLint 0 errors
- [ ] Responsive design

---

## Phase 5: Integration + Polish

> **Dependency:** Phase 4 complete

### Step 5.1: Backward Compatibility Verification [PENDING]

**All 4 consumer pages must work without changes:**

| Page               | File                                           | Consumes                         |
| ------------------ | ---------------------------------------------- | -------------------------------- |
| Manage Employees   | `manage-employees/+page.server.ts` (line 44)   | `position-options` → `.employee` |
| Manage Admins      | `manage-admins/+page.server.ts` (line 63)      | `position-options` → `.admin`    |
| Manage Root        | `manage-root/+page.server.ts` (line 29)        | `position-options` → `.root`     |
| Positions Settings | `organigram/positions/+page.svelte` (line 205) | `position-options` (full)        |

**All 3 form modals must work without changes:**

| Modal             | File                                             | Uses `positionOptions` prop  |
| ----------------- | ------------------------------------------------ | ---------------------------- |
| EmployeeFormModal | `manage-employees/_lib/EmployeeFormModal.svelte` | `positionOptions?: string[]` |
| AdminFormModal    | `manage-admins/_lib/AdminFormModal.svelte`       | `positionOptions?: string[]` |
| RootUserModal     | `manage-root/_lib/RootUserModal.svelte`          | `positionOptions?: string[]` |

**Verification:** Open each page, verify position dropdown renders correctly with same options.

### Step 5.2: Production Migration Path [PENDING]

> **Dev environment:** DB will be reset, no data migration needed.
> **Production (future):** Document how to migrate existing JSONB data to `position_catalog`.

**Production migration script (for reference, not needed now):**

```sql
-- Migrate existing positionOptions from tenants.settings JSONB to position_catalog.
-- Run AFTER position_catalog table exists AND AFTER ensureSystemPositions() has seeded.
-- EXCLUDES system positions — those are handled by ensureSystemPositions() with stable UUIDs.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).

INSERT INTO position_catalog (id, tenant_id, name, role_category, sort_order, is_system)
SELECT
    gen_random_uuid(),
    t.id,
    pos.value::text,
    cat.key::position_role_category,
    pos.ordinality - 1,
    false
FROM tenants t
CROSS JOIN LATERAL jsonb_each(t.settings->'positionOptions') AS cat(key, value)
CROSS JOIN LATERAL jsonb_array_elements_text(cat.value) WITH ORDINALITY AS pos(value, ordinality)
WHERE t.settings->'positionOptions' IS NOT NULL
    AND pos.value::text NOT IN ('team_lead', 'area_lead', 'department_lead')
ON CONFLICT DO NOTHING;
```

> **Why exclude system positions?** `ensureSystemPositions()` creates them with stable, deterministic UUIDs.
> The JSONB migration uses `gen_random_uuid()` — if it runs first, system positions get random UUIDs,
> and `ensureSystemPositions()` skips them due to `ON CONFLICT DO NOTHING`. This leads to non-deterministic
> UUIDs for system positions across tenants. Excluding them ensures `ensureSystemPositions()` is the single
> source of truth for system position UUIDs.

### Step 5.3: Documentation [PENDING]

- [ ] ADR-038 finalized (status: Accepted)
- [ ] FEATURES.md updated
- [ ] Customer migrations synced: `./scripts/sync-customer-migrations.sh`

### Phase 5 — Definition of Done

- [ ] All 4 consumer pages verified (manage-employees, manage-admins, manage-root, positions)
- [ ] All 3 form modals verified (EmployeeFormModal, AdminFormModal, RootUserModal)
- [ ] Production migration path documented
- [ ] ADR-038 accepted
- [ ] No open TODOs in code
- [ ] Existing test suites still pass

---

## Session Tracking

| Session | Phase | Description                                                                  | Status  | Date |
| ------- | ----- | ---------------------------------------------------------------------------- | ------- | ---- |
| 1       | 1     | DB migration: position_catalog + user_positions + approval_configs extension | PENDING |      |
| 2       | 2     | PositionCatalogService + organigram-settings refactor + UserPositionService  | PENDING |      |
| 3       | 2     | Approval integration (resolveApprovers UNION ALL) + Controller endpoints     | PENDING |      |
| 4       | 3     | Unit tests + API tests                                                       | PENDING |      |
| 5       | 4     | Frontend: positions page + approvals dropdown                                | PENDING |      |
| 6       | 5     | Integration + backward-compat verification + documentation                   | PENDING |      |

---

## Known Limitations (V1 — Intentionally Excluded)

1. **No auto-sync `users.position` ↔ `user_positions`** — The legacy VARCHAR field and the N:M table are independent. Syncing would touch too much code for V1.
2. **No position hierarchy** — Positions are flat, no parent/child relationships.
3. **No position-based permissions beyond approvals** — V1 only connects positions to the approval system. Other permission checks come later.
4. **No bulk position assignment** — Users are assigned one position at a time.
5. **No position history/audit** — ActivityLogger logs mutations, but no dedicated position change history.

---

## Quick Reference: File Paths

### Database (new)

| File                                           | Purpose                                                  |
| ---------------------------------------------- | -------------------------------------------------------- |
| `database/migrations/{ts}_position-catalog.ts` | position_catalog + user_positions + approval_configs ext |

### Backend (new)

| File                                                      | Purpose        |
| --------------------------------------------------------- | -------------- |
| `backend/src/nest/organigram/position-catalog.types.ts`   | Types          |
| `backend/src/nest/organigram/position-catalog.service.ts` | Catalog CRUD   |
| `backend/src/nest/organigram/user-position.service.ts`    | N:M assignment |
| `backend/src/nest/organigram/dto/upsert-position.dto.ts`  | Validation     |
| `backend/src/nest/organigram/dto/assign-position.dto.ts`  | Validation     |

### Backend (modified)

| File                                                           | Change                                           |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `backend/src/nest/organigram/organigram.module.ts`             | New providers                                    |
| `backend/src/nest/organigram/organigram.controller.ts`         | Position catalog endpoints                       |
| `backend/src/nest/organigram/organigram-settings.service.ts`   | Refactored: JSONB → position_catalog             |
| `backend/src/nest/users/users.controller.ts`                   | User position endpoints (`/users/:id/positions`) |
| `backend/src/nest/approvals/approvals-config.service.ts`       | `resolveApprovers()` 5th UNION ALL branch        |
| `backend/src/nest/approvals/approvals.service.ts`              | `createConfig()` position support                |
| `backend/src/nest/approvals/approvals.types.ts`                | `'position'` in ApprovalApproverType             |
| `backend/src/nest/approvals/dto/upsert-approval-config.dto.ts` | `approverPositionId` in Zod schema               |

### Frontend (modified)

| File                                                                          | Change                   |
| ----------------------------------------------------------------------------- | ------------------------ |
| `frontend/src/routes/(app)/(root)/settings/organigram/positions/+page.svelte` | CRUD rewrite             |
| `frontend/src/routes/(app)/(admin)/settings/approvals/+page.svelte`           | Position dropdown        |
| `frontend/src/routes/(app)/(admin)/settings/approvals/_lib/constants.ts`      | New approver type option |
| `frontend/src/routes/(app)/(admin)/settings/approvals/_lib/types.ts`          | New types                |
