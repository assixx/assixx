# ADR-036: Organizational Scope Access Control

| Metadata                | Value                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                  |
| **Date**                | 2026-03-14                                                                                                                                |
| **Decision Makers**     | SCS Technik                                                                                                                               |
| **Affected Components** | Backend (HierarchyPermissionService, ScopeService, 4 controllers, 4 services, KVP, Blackboard), frontend (routes, navigation, layout), DB |
| **Related ADRs**        | ADR-020 (per-user permissions), ADR-033 (addon model), ADR-034 (hierarchy labels), ADR-035 (organizational hierarchy & assignment)        |

---

## Context

### The problem: two gaps in the access system

```
┌─────────────────────────────────────────────────────────────────┐
│  GAP 1: Employee leads have no access to the manage pages      │
│                                                                 │
│  Team lead "Corc" (employee) cannot manage their team          │
│  → No access to /manage-teams, /manage-employees               │
│  → Has to ask an admin to make changes                         │
│                                                                 │
│  GAP 2: Scoped admins see EVERYTHING instead of just their area │
│                                                                 │
│  Admin without has_full_access still sees all employees        │
│  → No scope filter in listUsers(), listTeams() etc.            │
│  → Privacy issue in large companies with separate areas        │
└─────────────────────────────────────────────────────────────────┘
```

**Before this decision:**

- Manage pages were exclusive to root and admin
- Admins saw ALL entities in the tenant — no organizational scope filter
- Employee leads (team_lead_id, deputy_lead_id) had no management rights at all
- The existing `getAccessibleAreaIds()` / `getAccessibleDepartmentIds()` / `getAccessibleTeamIds()` methods completely ignored lead positions
- KVP had its own separate org-info query (`EXTENDED_ORG_INFO_QUERY`) with a different data model

### Requirements

1. Employee team leads should be able to manage their teams + team members (read + edit, NO create/delete)
2. Scoped admins should only see entities in their scope (area permissions + lead positions + cascade)
3. Root / has_full_access stays unchanged (sees everything)
4. Deputy lead has identical rights as the team lead (V1, per-tenant setting for V2)
5. A single filter path for ALL roles — no special code per role
6. No DB overhead for ~90% of requests (chat, calendar, etc. need no scope)
7. Fail-closed: no permission row = no access. No exceptions.

---

## Decision

### Architecture: one CTE, one service, one filter path

```
┌──────────────────────────────────────────────────────────────────────┐
│                HierarchyPermissionService.getScope()                 │
│                                                                      │
│  Root / has_full_access:                                             │
│    → type: 'full' (no filter, early return)                         │
│                                                                      │
│  Admin (scoped):                                                     │
│    → type: 'limited'                                                 │
│    → areaIds:  [admin_area_permissions + area_lead_id]              │
│    → deptIds:  [admin_dept_permissions + dept_lead_id + inherited]  │
│    → teamIds:  [team_lead_id + deputy_lead_id + inherited]          │
│                                                                      │
│  Employee team lead:                                                 │
│    → type: 'limited'                                                 │
│    → teamIds:  [team_lead_id + deputy_lead_id]                      │
│                                                                      │
│  Employee (no lead) / dummy:                                         │
│    → type: 'none' (no access to manage pages)                       │
│                                                                      │
│  Scope is resolved LAZILY (ScopeService + CLS cache).               │
│  ~90% of requests NEVER resolve scope → no DB overhead.             │
└──────────────────────────────────────────────────────────────────────┘
```

### Core components

#### 1. Unified CTE query (`UNIFIED_SCOPE_CTE`)

A single SQL query resolves ALL access paths:

```sql
WITH
perm_areas AS (/* admin area permissions — only active */),
lead_areas AS (/* area_lead_id positions */),
all_areas AS (/* UNION of both */),
perm_depts AS (/* admin dept permissions — only active */),
lead_depts AS (/* department_lead_id positions */),
inherited_depts AS (/* departments under all_areas — cascade */),
all_depts AS (/* UNION of all three */),
lead_teams AS (/* team_lead_id + deputy_lead_id */),
inherited_teams AS (/* teams under all_depts — cascade */),
all_teams AS (/* UNION of both */)
SELECT area_ids, department_ids, team_ids,
       lead_area_ids, lead_department_ids, lead_team_ids
```

**Why one CTE instead of separate queries?** Three `getAccessible*Ids()` calls (the old pattern) meant 3 DB round trips with redundant getUserInfo queries. The CTE does everything in one query.

**Why `lead_*_ids` in addition to `all_*` IDs?** KVP needs the information "am I lead of THIS team?" for confirmation logic. The boolean `isTeamLead` is not enough — it only says "any team", not which one.

#### 2. ScopeService (lazy + CLS cache)

```typescript
@Injectable()
export class ScopeService {
  async getScope(): Promise<OrganizationalScope> {
    // 1. Check the CLS cache (second+ call in the same request)
    const cached = this.cls.get('orgScope');
    if (cached !== undefined) return cached;
    // 2. DB query (first call in the request)
    const scope = await this.hierarchyPermission.getScope(userId, tenantId);
    // 3. Cache in CLS
    this.cls.set('orgScope', scope);
    return scope;
  }
}
```

**Why lazy instead of APP_GUARD?** An APP_GUARD would trigger a DB query for EVERY authenticated request. ~90% of requests (chat, calendar, blackboard read) need no scope. ScopeService only resolves when a service actually needs it.

**Why CLS (continuation-local storage)?** Scope is request-bound. CLS is the NestJS pattern for request-scoped data without explicit parameter threading.

#### 3. Permission model: `manage_hierarchy` addon

```
┌─────────────────────────────────────────────────────────────┐
│  manage_hierarchy (is_core=true, always active)              │
│                                                               │
│  Modules:                                                     │
│    manage-areas       → canRead, canWrite (no canDelete)     │
│    manage-departments → canRead, canWrite                    │
│    manage-teams       → canRead, canWrite                    │
│    manage-employees   → canRead, canWrite                    │
│                                                               │
│  Granting:                                                    │
│    Root → grants manually to admins (D5)                     │
│    System → auto-seed on lead assignment (D6)                │
│                                                               │
│  Guard:                                                       │
│    PermissionGuard (ADR-020) — NO change                     │
│    Fail-closed: no row = no access                            │
└─────────────────────────────────────────────────────────────┘
```

**Why no `canDelete`?** Employee leads may read + edit, but NOT create/delete. Create/delete stays restricted to `@Roles('admin', 'root')`.

**Why auto-seed?** When an employee is appointed as team lead, the system automatically creates the permission rows (`ON CONFLICT DO NOTHING`). On removal as lead → cleanup (only when no other team is being led). The PermissionGuard needs no special code — it simply finds the auto-seeded rows.

**ADR-020 override:** root can revoke a lead's permissions on the permission page (set can_read=false). The auto-seed does NOT overwrite this (`ON CONFLICT DO NOTHING`). Permissions are only reset on lead removal + reassignment.

#### 4. Service-level scope filtering

Unified pattern in ALL 4 services:

```typescript
const scope = await this.scopeService.getScope();
if (scope.type === 'full') return allEntities; // root/admin full
if (scope.type === 'none') return []; // employee without lead
return filterByScope(scope.teamIds); // admin scoped + employee lead
```

**Affected services:** AreasService, DepartmentsService, TeamsService, UsersService

**User scope:** since users are not directly contained in scope IDs (they are linked via junction tables), there is `getVisibleUserIds(scope, tenantId)` — a separate query that resolves users via `user_departments` + `user_teams`.

#### 5. Frontend route migration

```
(admin)/manage-areas       → (shared)/manage-areas        (admin + employee lead)
(admin)/manage-departments → (shared)/manage-departments   (admin + employee lead)
(root)/manage-teams        → (shared)/manage-teams         (admin + employee lead)
(admin)/manage-employees   → (shared)/manage-employees     (admin + employee lead)
(admin)/manage-admins      → (root)/manage-admins          (root only)
(admin)/manage-dummies     → (root)/manage-dummies         (root only, D7)
```

Every +page.server.ts has an explicit scope check (defense in depth):

- manage-teams/employees: root OK, admin with scope OK, employee with isTeamLead OK
- manage-areas/departments: root OK, admin with scope OK, employee DENIED (D1=NO)

#### 6. Navigation scope filtering

`filterMenuByScope()` in the Svelte layout pipeline:

- Root: all manage items visible
- Admin full: all manage items visible
- Admin scoped: manage items based on scope
- Employee lead: manage-teams + manage-employees injected
- Employee without lead: no manage items

---

## Alternatives Considered

### A: Two separate services (LeadScopeService + UserScopeFilteringService)

**Rejected.** Leads to duplicated CTE logic, duplicated filter paths, and route conflicts. One service with one CTE is simpler, faster, and more consistent.

### B: RLS-based filtering (PostgreSQL row-level security)

**Rejected.** RLS filters at the DB level, which means EVERY query (chat, calendar, too) would be filtered. No way to say "~90% of requests need no scope". On top of that, the CTE logic (admin permissions + lead positions + cascade) is extremely complex to implement in RLS policies.

### C: Frontend-only filter (backend returns everything, frontend filters)

**Rejected.** Security flaw — an API call would return all data, with the frontend only restricting display. Scope filtering MUST happen at the backend level (defense in depth).

### D: APP_GUARD for scope resolution

**Rejected.** Would trigger a DB query for EVERY authenticated request — including the ~90% that need no scope. ScopeService (lazy) only resolves when actually needed.

### E: Separate permission category per controller (areas-manage, teams-manage, etc.)

**Partially adopted.** The existing permission categories (`departments`, `teams`, `employees`) stay for POST/DELETE (legacy). GET/PUT use the new `manage_hierarchy` category that covers all 4 manage pages.

---

## Consequences

### Positive

1. **Employee leads can manage:** team leads see and edit their teams + members without admin intervention
2. **Scoped admins:** privacy compliant — admins only see their organizational scope
3. **One filter path:** no special code per role — same code path for admin AND employee lead
4. **No overhead:** ~90% of requests do not resolve scope (lazy + CLS cache)
5. **Fail-closed:** no permission row = no access — no accidental approvals
6. **Deputy = lead:** deputies have identical rights immediately (V1)
7. **Auto-seed:** no manual permission grant needed for leads
8. **ADR-020 override:** root retains full control — can revoke rights from leads
9. **KVP integration:** scope-based visibility + share function for targeted access

### Negative

1. **Admin migration:** existing admins need a manual `manage_hierarchy` permission grant by root
2. **KVP behaviour change:** employees without a lead only see own + implemented + shared suggestions
3. **Dropdown limitation (V1):** create forms show all entities in dropdowns, not only scoped
4. **Deputy always lead (V1):** no per-tenant setting for whether the deputy has full lead rights (planned V2)
5. **No live update:** scope changes only become visible after navigation/reload

---

## Delegated Permission Management (extension)

Leads can manage addon permissions of their subordinates — with strict hierarchy control.

### Delegation chain

```
Root → admin (full) → area lead → dept lead → team lead → team members
```

Each level can ONLY delegate to the level below. NEVER upwards, sideways, or to oneself.

### Safety rules

| #   | Rule                                                      | Enforcement                                 |
| --- | --------------------------------------------------------- | ------------------------------------------- |
| 1   | No self-grant (targetUser ≠ currentUser, exception: root) | Controller `assertNotSelf()`                |
| 2   | Only own permissions are delegable                        | Service `leaderHasPermission()`             |
| 3   | Only to users in own scope                                | Controller `assertTargetInScope()`          |
| 4   | manage-permissions itself is not delegable                | Service `isDelegatableEntry()` + DB trigger |
| 5   | Audit trail for every change                              | `assigned_by` column + activity logger      |

### New permission: `manage-permissions`

New module in the `manage_hierarchy` addon:

- `canRead`: see the permission page of subordinates
- `canWrite`: change permissions of subordinates
- Red highlight (`perm-row--danger`) in the UI as a visual warning
- DB trigger `trg_prevent_manage_permissions_self_grant`: only root/admin-full may grant this permission

### Controller architecture

`assertPermissionAccess()` replaces `assertFullAccess()`:

1. Root → always OK (incl. self-edit)
2. Admin with has_full_access → OK (self-edit blocked)
3. Lead with manage-permissions → OK (self-edit + scope check)
4. Everyone else → 403

### Service architecture

`upsertPermissions()` with optional `delegatorScope`:

- When set → pre-filter `filterDelegatedPermissions()`: rule 2 + 4
- `loadLeaderPermissions()`: batch-load as a set for O(1) lookup
- `filterByLeaderPerms()`: GET only shows modules the lead has

---

## Implementation Summary

| Phase | Description                                                  | Files             |
| ----- | ------------------------------------------------------------ | ----------------- |
| 1     | Types, CTE, ScopeService, KVP refactoring, endpoint          | 6 new + 5 changed |
| 2     | Service-level scope filtering + mutations + Blackboard       | 8 changed         |
| 3     | Permission registry, migration, controller @Roles, auto-seed | 4 new + 7 changed |
| 4     | Unit tests (77 tests)                                        | 3 test files      |
| 5     | Frontend route migration + layout data + access checks       | 1 new + 7 changed |
| 6     | Navigation config + ScopeInfoBanner + lead view              | 2 new + 3 changed |
| 7     | API integration tests (19 tests)                             | 2 test files      |

**Total: 96 tests (77 unit + 19 API)**

---

## Key Design Decisions

| #   | Question                         | Decision                   | Rationale                                            |
| --- | -------------------------------- | -------------------------- | ---------------------------------------------------- |
| D1  | Employees as area/dept lead?     | NO                         | ADR-035 compliant, validateLeader() stays admin/root |
| D2  | Where does the scope logic live? | HierarchyPermissionService | One service, one CTE, no new service                 |
| D3  | When is scope resolved?          | Lazily via ScopeService    | ~90% of requests need no scope                       |
| D4  | Deputy = lead?                   | YES (V1)                   | DEPUTY_EQUALS_LEAD flag for V2 toggle                |
| D5  | Admin manage_hierarchy grant?    | Manually by root           | Maximum control, no auto-grant                       |
| D6  | Lead manage_hierarchy grant?     | Auto-seed on assignment    | ON CONFLICT DO NOTHING respects ADR-020 override     |
| D7  | manage-dummies access?           | Root only                  | Move from (admin) to (root)                          |

---

## References

- [FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md](../../FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md) — execution plan
- [ADR-020](./ADR-020-per-user-feature-permissions.md) — Per-User Feature Permissions (basis for manage_hierarchy)
- [ADR-033](./ADR-033-addon-based-saas-model.md) — Addon model (manage_hierarchy as a core addon)
- [ADR-034](./ADR-034-hierarchy-labels-propagation.md) — Hierarchy Labels (UI naming)
- [ADR-035](./ADR-035-organizational-hierarchy-and-assignment-architecture.md) — Org Hierarchy (DB structure, validateLeader)
- [ADR-009](./ADR-009-user-role-assignment-permissions.md) — Audit logging (scope-denied events)
