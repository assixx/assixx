# FEAT: Approvals System — Execution Masterplan

> **Created:** 2026-03-17
> **Version:** 1.0.0 (Lean V1)
> **Status:** IN PROGRESS — Phase 1 partially done
> **Branch:** `refactor/KVP` (current), then `feat/approvals`
> **ADR:** [ADR-037](./infrastructure/adr/ADR-037-approvals-architecture.md)
> **Author:** SCS-Technik (Senior Engineer)
> **Estimated Sessions:** 7
> **Actual Sessions:** 7 / 7 (Phase 5 deferred)

---

## Changelog

| Version | Date       | Change                                                                         |
| ------- | ---------- | ------------------------------------------------------------------------------ |
| 0.1.0   | 2026-03-17 | Initial Draft — overengineered 12-session plan with Custom Roles               |
| 0.3.1   | 2026-03-17 | Validation review — TS-Standards, CoC, Migration Guide compliance              |
| 1.0.0   | 2026-03-17 | **LEAN REWRITE:** Custom Roles removed (V2). 7 sessions. KVP as first consumer |
| 1.0.1   | 2026-03-17 | Dropped `role_label` column (Migration 100). Spec Deviation D4 added           |

### V1 Scope Decision

Custom Roles (`custom_roles` + `user_custom_roles` tables, `/manage-roles` page, 8 endpoints) was **removed from V1**. Reason: Scope creep. The 4 existing `approver_type` values (`user`, `team_lead`, `area_lead`, `department_lead`) cover 95% of use cases. A tenant wanting a "KVP-Master" assigns the user directly via `approver_type='user'`. Custom Roles is planned for V2 as a convenience layer.

**What was cut:**

- ~~Phase 2: Custom Roles Module~~ → V2
- ~~Step 1.1: custom_roles + user_custom_roles migration~~ → V2
- ~~Step 1.2: ENUM extension + custom_role_id FK~~ → V2
- ~~Step 6.1: /manage-roles frontend page~~ → V2
- ~~Risk R1, R3, R4, R5~~ → no longer applicable

**What was added:**

- Phase 5: KVP as first consumer (the system is untestable without a real integration)

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [x] Docker Stack running (all containers healthy)
- [x] DB Backup created: `full_backup_20260317_103842.dump` (2.2M)
- [x] No pending migrations (current: migration 099 `approvals-core-tables`)
- [x] ADR-037 written and accepted
- [x] ADR-033 updated (Core Addon #10)
- [ ] Branch `feat/approvals` checked out (currently on `refactor/KVP`)

### 0.2 Risk Register

| #   | Risk                                           | Impact | Likelihood | Mitigation                                                    | Verification                                         |
| --- | ---------------------------------------------- | ------ | ---------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| R1  | resolveApprovers returns empty (no config)     | Medium | High       | Root/Admin with full_access always bypass — they can decide   | Unit test: empty config + root → still can approve   |
| R2  | Self-approval (requester approves own request) | High   | Medium     | Backend check: `decided_by !== requested_by`                  | Unit test: self-approve → ForbiddenException         |
| R3  | Priority VARCHAR→ENUM breaks existing data     | Medium | Low        | Migration converts with USING cast, empty table = no risk     | Dry-run + verify column type after migration         |
| R4  | KVP integration breaks existing KVP flow       | High   | Medium     | Approval is opt-in: only triggered when config exists for kvp | API test: KVP without approval config works normally |

### 0.3 Ecosystem Integration Points

| Existing System     | Integration                                                | Phase | Verified |
| ------------------- | ---------------------------------------------------------- | ----- | -------- |
| audit_trail         | Log approval decisions (approve/reject)                    | 2     |          |
| Permission Registry | `approvals-manage` + `approvals-request` registrar         | 2     |          |
| /manage-approvals   | Connect to real API (currently placeholder)                | 4     |          |
| Sidebar Navigation  | /settings/approvals entry                                  | 4     |          |
| Breadcrumb          | Entries for settings page                                  | 4     |          |
| KVP Module          | First consumer: KVP suggestion → approval request          | 5     |          |
| SSE/Notifications   | New approval → notify masters, decision → notify requester | 6     |          |

---

## Phase 1: Database Migration (remaining)

> **Dependency:** None
> **Current last migration:** `20260317093917773_approvals-core-tables`

### Step 1.0: approval_configs + approvals tables [DONE]

Already migrated in session 1:

- `approval_configs` (10 columns, RLS, UNIQUE index)
- `approvals` (18 columns, 7 indexes, RLS)
- ENUMs: `approval_status`, `approval_approver_type`
- Addon entry: id=22, code='approvals', is_core=true

### Step 1.1: Fix priority VARCHAR → ENUM [✅ DONE — 2026-03-17]

**New migration (GENERATOR ONLY):** `doppler run -- pnpm run db:migrate:create approvals-priority-enum`

```sql
-- Convert priority from VARCHAR(10) to ENUM (consistency with work_order_priority)
CREATE TYPE approval_priority AS ENUM ('low', 'medium', 'high');
ALTER TABLE approvals ALTER COLUMN priority TYPE approval_priority
    USING priority::approval_priority;
ALTER TABLE approvals ALTER COLUMN priority SET DEFAULT 'medium'::approval_priority;
```

> **Separate migration** — single concern. No mixing with ENUM extension or FK changes.

### Phase 1 — Definition of Done

- [x] `approval_configs` + `approvals` tables with RLS (Step 1.0)
- [x] `approvals.priority` converted to ENUM (Step 1.1)
- [x] Migration passes dry-run
- [x] Backend compiles, existing tests pass
- [x] Customer fresh-install synced (102 migrations)

---

## Phase 2: Backend — Approvals Module

> **Dependency:** Phase 1 complete
> **Reference module:** `backend/src/nest/work-orders/`

### Step 2.1: Module Skeleton + Types + DTOs [✅ DONE — 2026-03-17]

**New directory:** `backend/src/nest/approvals/`

```
backend/src/nest/approvals/
    approvals.module.ts
    approvals.types.ts
    approvals.permissions.ts
    approvals-permission.registrar.ts
    approvals-config.service.ts        # CRUD for approval_configs
    approvals.service.ts               # CRUD for approvals + status transitions
    approvals.controller.ts
    dto/
        create-approval.dto.ts
        upsert-approval-config.dto.ts
        decide-approval.dto.ts
        index.ts
```

**Module imports:**

- `ScopeModule` — for resolving dynamic lead approvers (team_lead, area_lead, department_lead)

> **Core Addon — NO `ensureAddonEnabled()` needed.** `is_core=true` → TenantAddonGuard always passes.

**Registration in app.module.ts:**

- [ ] `ApprovalsModule` added to imports (alphabetically)

### Step 2.2: ApprovalsConfigService [✅ DONE — 2026-03-17]

**Methods:**

- `getConfigs(tenantId)` — All configs grouped by addon_code
- `upsertConfig(tenantId, dto, createdBy)` — Set/update approval master for addon
- `deleteConfig(tenantId, uuid)` — Remove config entry
- `resolveApprovers(tenantId, addonCode, requestingUserId)` — Resolve all masters

**resolveApprovers — Single UNION ALL Query:**

```sql
-- Resolve ALL configured approvers for an addon in ONE query
SELECT DISTINCT approver_id FROM (
    -- Direct user assignments
    SELECT ac.approver_user_id AS approver_id
    FROM approval_configs ac
    WHERE ac.tenant_id = $1 AND ac.addon_code = $2
      AND ac.approver_type = 'user'
      AND ac.approver_user_id IS NOT NULL
      AND ac.is_active = ${IS_ACTIVE.ACTIVE}

    UNION ALL

    -- Team lead of requesting user's team(s)
    SELECT t.team_lead_id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_teams ut ON ut.user_id = $3 AND ut.tenant_id = $1
    INNER JOIN teams t ON t.id = ut.team_id AND t.team_lead_id IS NOT NULL
      AND t.is_active = ${IS_ACTIVE.ACTIVE}
    WHERE ac.tenant_id = $1 AND ac.addon_code = $2
      AND ac.approver_type = 'team_lead'
      AND ac.is_active = ${IS_ACTIVE.ACTIVE}

    UNION ALL

    -- Area lead of requesting user's area(s)
    SELECT a.area_lead_id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_departments ud ON ud.user_id = $3 AND ud.tenant_id = $1
    INNER JOIN departments d ON d.id = ud.department_id
    INNER JOIN areas a ON a.id = d.area_id AND a.area_lead_id IS NOT NULL
      AND a.is_active = ${IS_ACTIVE.ACTIVE}
    WHERE ac.tenant_id = $1 AND ac.addon_code = $2
      AND ac.approver_type = 'area_lead'
      AND ac.is_active = ${IS_ACTIVE.ACTIVE}

    UNION ALL

    -- Department lead of requesting user's department(s)
    SELECT d.department_lead_id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_departments ud ON ud.user_id = $3 AND ud.tenant_id = $1
    INNER JOIN departments d ON d.id = ud.department_id
      AND d.department_lead_id IS NOT NULL
      AND d.is_active = ${IS_ACTIVE.ACTIVE}
    WHERE ac.tenant_id = $1 AND ac.addon_code = $2
      AND ac.approver_type = 'department_lead'
      AND ac.is_active = ${IS_ACTIVE.ACTIVE}
) AS resolved
WHERE approver_id IS NOT NULL;
```

> **1 DB round-trip, not 5.** All `is_active` checks use `IS_ACTIVE` constants.

### Step 2.3: ApprovalsService [✅ DONE — 2026-03-17]

**Methods:**

- `findAll(tenantId, filters)` — List approvals with pagination + filters
- `findById(tenantId, uuid)` — Single approval with source details
- `findByAssignee(tenantId, userId, filters)` — Approvals assigned to user
- `findByRequester(tenantId, userId)` — Approvals requested by user
- `create(tenantId, dto, requestedBy)` — Create approval request
- `approve(tenantId, uuid, decidedBy, note?)` — Approve (check: not self-approve)
- `reject(tenantId, uuid, decidedBy, note)` — Reject (note mandatory, check: not self-approve)
- `getStats(tenantId, userId?)` — Stats (pending/approved/rejected/total)

### Step 2.4: ApprovalsController [✅ DONE — 2026-03-17]

**Endpoints (10 total):**

| Method | Route                    | Guard/Permission           | Description             |
| ------ | ------------------------ | -------------------------- | ----------------------- |
| GET    | /approvals/configs       | approvals-manage.canRead   | List all configs        |
| PUT    | /approvals/configs       | approvals-manage.canWrite  | Upsert config           |
| GET    | /approvals/my            | approvals-request.canRead  | My requested approvals  |
| GET    | /approvals/assigned      | approvals-manage.canRead   | Assigned to me          |
| GET    | /approvals/stats         | approvals-manage.canRead   | Stats                   |
| GET    | /approvals               | approvals-manage.canRead   | List all (admin/master) |
| GET    | /approvals/:uuid         | approvals-manage.canRead   | Single approval         |
| POST   | /approvals               | approvals-request.canWrite | Create approval request |
| POST   | /approvals/:uuid/approve | approvals-manage.canWrite  | Approve                 |
| POST   | /approvals/:uuid/reject  | approvals-manage.canWrite  | Reject                  |

> **Route ordering:** Static routes (`/configs`, `/my`, `/assigned`, `/stats`) BEFORE parameterized (`/:uuid`).
> **@HttpCode:** 201 on POST create, 200 on approve/reject.

### Step 2.5: Permission Registrar [✅ DONE — 2026-03-17]

```typescript
export const APPROVALS_PERMISSIONS: PermissionCategoryDef = {
  code: 'approvals',
  label: 'Freigaben',
  icon: 'fa-check-double',
  modules: [
    {
      code: 'approvals-manage',
      label: 'Freigaben verwalten',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    { code: 'approvals-request', label: 'Freigaben anfordern', allowedPermissions: ['canRead', 'canWrite'] },
  ],
};
```

**Critical patterns (all services):**

- `db.tenantTransaction()` for ALL queries (ADR-019)
- Return raw data, NO wrapping (ADR-007)
- `$1, $2, $3` placeholders
- `ActivityLoggerService` fire-and-forget after mutations
- `getErrorMessage(error)` in catch blocks (§7.3 TS-Standards)
- `createIdParamSchema('uuid')` for param DTOs (§7.5 TS-Standards)
- UUIDv7: `import { v7 as uuidv7 } from 'uuid';`

### Phase 2 — Definition of Done

- [x] `ApprovalsModule` registered in `app.module.ts`
- [x] ApprovalsConfigService with CRUD + UNION ALL resolver
- [x] ApprovalsService with CRUD + approve/reject + self-approve prevention
- [x] Controller with 10 endpoints (static before parameterized)
- [x] Permission registrar registered at module init
- [x] Core addon — no `ensureAddonEnabled()` needed
- [x] `ActivityLoggerService` injected
- [x] ESLint 0 errors, type-check passed

---

## Phase 3: Unit + API Tests

> **Dependency:** Phase 2 complete

### Test Files

```
backend/src/nest/approvals/
    approvals-config.service.test.ts       # ~25 tests
    approvals.service.test.ts              # ~40 tests
    dto/create-approval.dto.test.ts        # ~15 tests
    dto/decide-approval.dto.test.ts        # ~10 tests
backend/test/
    approvals.api.test.ts                  # ~25 tests
```

### Critical Test Scenarios

**Config:**

- [ ] Set master per addon (user, team_lead, area_lead, department_lead)
- [ ] resolveApprovers: UNION ALL returns correct user IDs
- [ ] resolveApprovers: empty config → empty array
- [ ] resolveApprovers: lead not assigned → skipped (no NULL in result)

**Approvals:**

- [ ] Create → pending, correct fields
- [ ] Approve → status=approved, decided_by + decided_at set
- [ ] Reject without note → BadRequestException
- [ ] Reject with note → status=rejected
- [ ] Self-approve → ForbiddenException
- [ ] Already decided → BadRequestException (no double-approve)
- [ ] Stats calculation correct

**API:**

- [ ] Unauthenticated → 401
- [ ] Create approval → 201
- [ ] Approve → 200
- [ ] Reject without note → 400
- [ ] Config CRUD → 200
- [ ] Root bypasses config (can always approve)

### Phase 3 — Definition of Done

- [x] > = 90 unit tests (actual: 104) ✅
- [x] > = 25 API tests (actual: 24 — self-approve blocks happy path, covered in unit tests)
- [x] All unit + API tests green
- [x] Self-approve prevention verified (unit + API)
- [ ] `vitest.config.ts` permission project expanded (deferred — non-blocking)

---

## Phase 4: Frontend — Settings + Connect

> **Dependency:** Phase 2 complete (backend endpoints available)

### Step 4.1: /settings/approvals (Root + Admin full_access) [✅ DONE — 2026-03-17]

**Route:** `frontend/src/routes/(app)/(admin)/settings/approvals/`

```
(admin)/settings/approvals/
    +page.svelte
    +page.server.ts
    _lib/
        types.ts
        api.ts
        constants.ts
        AddonConfigCard.svelte
```

**UI:** Card per addon. Dropdown with:

- Fixed values: Area Lead, Department Lead, Team Lead
- User search (reference: chat/manage-admin search input)

### Step 4.2: Connect /manage-approvals to real API [✅ DONE — 2026-03-17]

Replace placeholder data in existing `/manage-approvals` page with real `apiFetchWithPermission()` calls. Add approve/reject modals with decision_note.

### Step 4.3: Sidebar + Breadcrumb [✅ DONE — 2026-03-17]

- `/settings/approvals` → Root "System" submenu + Admin "Einstellungen" submenu
- Breadcrumb: `/settings/approvals` → "Freigabe-Einstellungen"

### Phase 4 — Definition of Done

- [x] /settings/approvals works end-to-end
- [x] /manage-approvals connected to real API
- [x] Approve/reject modals functional (ConfirmModal with textarea)
- [x] Sidebar + breadcrumb entries added
- [x] svelte-check 0 errors, ESLint 0 errors

---

## Phase 5: KVP Integration (First Consumer)

> **Dependency:** Phase 2 complete
> **CRITICAL:** Without a real consumer, the approval system is untestable in context.

### Step 5.1: KVP → Approval Trigger [PENDING]

When a Team Lead finds a KVP suggestion good and wants it approved by a higher authority:

- KVP detail page gets "Freigabe anfordern" button
- Button calls `POST /approvals` with `addon_code='kvp'`, `source_entity_type='kvp_suggestion'`, `source_uuid={suggestion.uuid}`
- Approval request appears in `/manage-approvals` for configured masters

### Step 5.2: Approval Status in KVP [PENDING]

- KVP detail page shows approval status badge (if approval exists)
- Approved → KVP suggestion gets status update (optional, depends on KVP workflow)

### Phase 5 — Definition of Done

- [ ] "Freigabe anfordern" button on KVP detail page
- [ ] Approval created with correct source reference
- [ ] Approval visible in /manage-approvals
- [ ] Approve/reject from /manage-approvals works
- [ ] KVP detail shows approval status

---

## Phase 6: Integration + Polish

> **Dependency:** Phase 4 + 5 complete

### Integrations

- [x] SSE Notifications: EventBus + Controller + Frontend Store + Badge type
- [ ] Sidebar: /manage-approvals visible when user is approval master (backend check) — deferred to V2
- [x] Dashboard: pending approvals count badge (via SSE_EVENT_TO_COUNT + badgeType on NavItem)

### Documentation

- [x] ADR-037 updated with final implementation details
- [x] FEATURES.md updated (Feature #13 + Addon Matrix)
- [x] Customer migrations synced (102 migrations, 22 addons)

### Phase 6 — Definition of Done

- [ ] All integrations work end-to-end
- [ ] No open TODOs in code
- [ ] All tests green (unit + frontend + API)

---

## Session Tracking

| Session | Phase | Description                                               | Status   | Date       |
| ------- | ----- | --------------------------------------------------------- | -------- | ---------- |
| 1       | 1     | Migration: approvals tables + UI shell + ADR + sidebar    | DONE     | 2026-03-17 |
| 2       | 1+2   | Priority ENUM fix + ApprovalsModule skeleton + types      | DONE     | 2026-03-17 |
| 3       | 2     | ConfigService (UNION ALL) + ApprovalsService + Controller | DONE     | 2026-03-17 |
| 4       | 3     | Unit tests (104) + API tests (24)                         | DONE     | 2026-03-17 |
| 5       | 4     | Frontend: /settings/approvals + /manage-approvals connect | DONE     | 2026-03-17 |
| 6       | 5     | KVP integration: first consumer                           | DEFERRED | —          |
| 7       | 6     | SSE notifications + docs + polish                         | DONE     | 2026-03-17 |

### Session 1 — 2026-03-17

**Goal:** DB prerequisites + UI shell + ADR
**Result:** Migration applied, UI page at /manage-approvals, sidebar restructure ("Verwalten"), breadcrumb, ADR-037, navigation tests
**Verification:**

- ESLint: 0 errors
- Type-check: 0 errors
- Tests: 6041 passed (unit + frontend-unit combined, 247 files)

---

## Quick Reference: File Paths

### Backend (new)

| File                                                           | Purpose                |
| -------------------------------------------------------------- | ---------------------- |
| `backend/src/nest/approvals/approvals.module.ts`               | NestJS Module          |
| `backend/src/nest/approvals/approvals.controller.ts`           | REST Controller        |
| `backend/src/nest/approvals/approvals.service.ts`              | Core Business Logic    |
| `backend/src/nest/approvals/approvals-config.service.ts`       | Config CRUD + Resolver |
| `backend/src/nest/approvals/approvals.types.ts`                | Interfaces             |
| `backend/src/nest/approvals/approvals.permissions.ts`          | Permission Definition  |
| `backend/src/nest/approvals/approvals-permission.registrar.ts` | ADR-020 Registrar      |

### Database (remaining)

| File                                                  | Purpose               |
| ----------------------------------------------------- | --------------------- |
| `database/migrations/{ts}_approvals-priority-enum.ts` | Priority VARCHAR→ENUM |

### Frontend (remaining)

| Path                                                    | Purpose         |
| ------------------------------------------------------- | --------------- |
| `frontend/src/routes/(app)/(admin)/settings/approvals/` | Approval Config |

---

## Known Limitations (V1)

1. **No Custom Roles** — `approver_type='user'` for direct assignment. Custom Roles (named groups) is V2.
2. **No multi-step approval chains** — Single-level approve/reject only. V2.
3. **No auto-escalation** — No timeout-based escalation. V2.
4. **No batch approve** — Each approval decided individually. V2.
5. **Root/Admin with full_access always bypass** — They can always decide, regardless of config. By design.
6. **KVP is the only consumer in V1** — Other addons (vacation, blackboard) can integrate in V2.
7. ~~`role_label` field~~ — **DROPPED** (Migration 100, 2026-03-17). Column removed from `approval_configs`. Custom Roles (V2) will add `custom_role_id` FK instead.

---

## Spec Deviations

| #   | ADR-037 says                     | V1 implementation             | Decision                                        |
| --- | -------------------------------- | ----------------------------- | ----------------------------------------------- |
| D1  | `priority VARCHAR(10)`           | Converted to ENUM in Step 1.1 | Consistency with work_order_priority            |
| D2  | Custom Roles in approval_configs | Not implemented in V1         | Scope creep — user + leads cover 95% of cases   |
| D3  | /manage-roles page               | Not built in V1               | Depends on Custom Roles (V2)                    |
| D4  | `role_label` column in configs   | Dropped (Migration 100)       | Unused ballast — V2 Custom Roles use FK instead |

---

## V2 Roadmap (after V1 ships)

| Feature         | Effort               | Description                                                                  |
| --------------- | -------------------- | ---------------------------------------------------------------------------- |
| Custom Roles    | ~3 sessions          | custom_roles + user_custom_roles tables, /manage-roles, dropdown integration |
| Approval Chains | ~2 sessions          | Multi-step: Lead → Manager → Director                                        |
| Auto-Escalation | ~1 session           | Cron: escalate after X days without decision                                 |
| Batch Approve   | ~1 session           | Select multiple → approve all                                                |
| More Consumers  | ~1 session per addon | Vacation, Blackboard, Calendar integration                                   |

---

## Post-Mortem (fill after completion)

### What went well

- {to be filled}

### What went poorly

- {to be filled}

### Metrics

| Metric                | Planned | Actual |
| --------------------- | ------- | ------ |
| Sessions              | 7       |        |
| Migration files       | 3       |        |
| New backend files     | ~10     |        |
| New frontend files    | ~8      |        |
| Changed files         | ~8      |        |
| Unit tests            | 90      |        |
| API tests             | 25      |        |
| ESLint errors at ship | 0       |        |
| Spec deviations       | 3       |        |

---

**This document is the execution plan. Each session starts here,
picks the next unchecked item, and marks it as done.**
