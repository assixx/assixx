# ADR-020: Per-User Feature Permission Control

| Metadata                | Value                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                         |
| **Date**                | 2026-02-07                                                                       |
| **Decision Makers**     | SCS-Technik Team                                                                 |
| **Affected Components** | PostgreSQL, Backend (NestJS modules, DatabaseService), Frontend (SvelteKit)      |
| **Supersedes**          | —                                                                                |
| **Related ADRs**        | ADR-005 (Auth), ADR-006 (CLS), ADR-007 (Response), ADR-012 (RBAC), ADR-019 (RLS) |

---

## Context

Assixx is a Multi-Tenant SaaS for industrial companies (50-500 employees). Tenant admins (IT administrators) need **granular control** over what each employee can see and do within the platform — comparable to Microsoft Entra ID / Active Directory permission management, scoped to the application's feature set.

### The Problem

Currently, access control operates at two levels:

1. **Tenant-Feature level** — a tenant subscribes to features (Blackboard, Chat, KVP, etc.) via the `tenant_features` table
2. **Role level** — users have one of three roles: `root`, `admin`, `employee`

This is insufficient for real-world industrial operations:

| Scenario                         | Current System                       | Required                                                    |
| -------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| New hire in Assembly (probation) | Sees everything their role allows    | Only Blackboard + Calendar (read)                           |
| Quality Manager                  | Same as any employee                 | KVP (read+write+export), Documents (all), no Shift Planning |
| Temporary worker                 | Full employee access                 | Blackboard (read-only), nothing else                        |
| Department Lead                  | Same as employee                     | Shift Planning (read+write), Team management                |
| Employee changes department      | Must manually track what was granted | IT Admin reassigns per-user permissions                     |

**Without per-user permissions, the IT admin has no tool to differentiate access within the same role.** Every employee sees the same modules — a security and compliance gap in regulated industries (automotive, chemical, manufacturing).

### Requirements

- Per-user, per-module, per-action (read/write/delete) permission control
- Only admins can assign permissions
- Permissions scoped to features the tenant has subscribed to (no UI for unsubscribed features)
- RLS-conformant (ADR-019): all DB access via `tenantTransaction()`
- Extensible: adding permissions for a new feature module must not require changes to central code
- Audit trail: track who assigned which permission and when

---

## Decision

**Decentralized Registry Pattern** with a single `user_feature_permissions` table, protected by RLS (ADR-019).

Each feature module **owns** its permission definitions. A global singleton registry collects them at application startup via NestJS `OnModuleInit`. The permission service and controller are generic — they have no knowledge of specific features.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Application Startup (NestJS Bootstrap)                          │
│                                                                  │
│  BlackboardModule.onModuleInit()                                │
│    → registry.register({ code:'blackboard', modules:[...] })    │
│                                                                  │
│  CalendarModule.onModuleInit()                                  │
│    → registry.register({ code:'calendar', modules:[...] })      │
│                                                                  │
│  KvpModule.onModuleInit()                                       │
│    → registry.register({ code:'kvp', modules:[...] })           │
│                                                                  │
│  [... all feature modules self-register ...]                    │
│                                                                  │
│      ▼                                                           │
│  PermissionRegistryService (Global Singleton)                   │
│  ├─ Map<string, PermissionCategoryDef>                          │
│  ├─ getAll() → all registered categories                        │
│  ├─ isValidModule(feature, module) → boolean                    │
│  └─ getAllowedPermissions(feature, module) → string[]           │
│                                                                  │
│      ▼                                                           │
│  UserPermissionsController                                      │
│  ├─ GET  /user-permissions/:uuid → permission tree              │
│  └─ PUT  /user-permissions/:uuid → batch upsert                │
│                                                                  │
│      ▼                                                           │
│  UserPermissionsService                                         │
│  ├─ getPermissions()    → tenantTransaction()                   │
│  │   ├─ Resolve UUID → user_id                                  │
│  │   ├─ Get tenant's active features                            │
│  │   ├─ Filter registry categories by active features           │
│  │   ├─ SELECT from user_feature_permissions (RLS filters)      │
│  │   └─ Merge DB rows with category tree                        │
│  │                                                               │
│  └─ upsertPermissions() → tenantTransaction()                   │
│      ├─ Resolve UUID → user_id                                  │
│      ├─ Validate against registry                               │
│      ├─ Force non-allowed permissions to false                  │
│      └─ INSERT ... ON CONFLICT DO UPDATE (RLS protects)         │
│                                                                  │
│      ▼                                                           │
│  PostgreSQL (user_feature_permissions)                           │
│  ├─ RLS: tenant_isolation policy (ADR-019)                      │
│  ├─ UNIQUE(tenant_id, user_id, feature_code, module_code)       │
│  └─ Columns: can_read, can_write, can_delete                    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Admin assigns permissions

```
Admin UI (SvelteKit)
  │
  │  PUT /api/v2/user-permissions/019…uuid
  │  Body: [{ featureCode, moduleCode, canRead, canWrite, canDelete }, ...]
  │
  ▼
UserPermissionsController
  │  @Roles('admin') — only admins (ADR-012)
  │  @CurrentUser() → assignedBy
  │  @TenantId() → tenantId from CLS (ADR-006)
  │
  ▼
UserPermissionsService.upsertPermissions()
  │  1. tenantTransaction() → set_config('app.tenant_id', ...) (ADR-019)
  │  2. Resolve UUID → integer user_id (within same transaction, RLS-safe)
  │  3. Validate each {featureCode, moduleCode} against PermissionRegistryService
  │  4. Force non-allowed permissions to false (safety net)
  │  5. INSERT ... ON CONFLICT (tenant_id, user_id, feature_code, module_code)
  │     DO UPDATE SET can_read=$X, can_write=$Y, can_delete=$Z, assigned_by=$W
  │
  ▼
PostgreSQL RLS
  │  tenant_isolation policy ensures:
  │  - INSERT: tenant_id matches current setting
  │  - UPDATE: only own tenant's rows visible
  │  - No cross-tenant writes possible
  │
  ▼
Response: 200 OK (ResponseInterceptor wraps — ADR-007)
```

---

## Implementation Details

### 1. Database Schema

```sql
CREATE TABLE user_feature_permissions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_code VARCHAR(50) NOT NULL,
    module_code VARCHAR(50) NOT NULL,
    can_read BOOLEAN NOT NULL DEFAULT FALSE,
    can_write BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_feature_module
        UNIQUE (tenant_id, user_id, feature_code, module_code)
);
```

**Design choices:**

- `feature_code` / `module_code` are VARCHAR strings — no FK to a permission definition table. New codes = new rows, no schema changes.
- `assigned_by ON DELETE RESTRICT` — safe because Assixx uses soft-delete (`is_active = 4`), never hard-delete for users. Only fires on tenant deletion, which cascades via `tenant_id ON DELETE CASCADE` first.
- `UNIQUE(tenant_id, user_id, feature_code, module_code)` — enables `INSERT ... ON CONFLICT DO UPDATE` (UPSERT) pattern.
- RLS policy: standard `tenant_isolation` pattern (ADR-019).

### 2. Permission Registry Pattern

Each feature module owns two files:

**Definition** (`feature.permissions.ts`):

```typescript
export const BLACKBOARD_PERMISSIONS: PermissionCategoryDef = {
  code: 'blackboard', // Must match features.code in DB
  label: 'Schwarzes Brett',
  icon: 'fa-clipboard',
  modules: [
    {
      code: 'blackboard-posts',
      label: 'Beitraege',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};
```

**Registrar** (`feature-permission.registrar.ts`):

```typescript
@Injectable()
export class BlackboardPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(BLACKBOARD_PERMISSIONS);
  }
}
```

**Why this pattern?**

| Property                      | Centralized                        | Decentralized Registry                |
| ----------------------------- | ---------------------------------- | ------------------------------------- |
| Add new feature permissions   | Edit central file + feature module | Add 2 files in feature module only    |
| Remove feature                | Edit central file + delete module  | Delete module (permissions disappear) |
| Single point of failure       | Yes (central file)                 | No                                    |
| Feature module self-contained | No                                 | Yes                                   |
| Circular dependencies         | Risk (central imports all modules) | None (modules import registry)        |

### 3. Tenant-Feature Gating

The GET endpoint filters the registry against the tenant's subscribed features:

```
Registry has:    [blackboard, calendar, chat, kvp, shifts, surveys, documents]
Tenant subscribed: [blackboard, calendar, documents]
→ Response contains: [blackboard, calendar, documents] only
```

Query: `SELECT feature_code FROM tenant_features WHERE is_active = 1` (RLS filters by tenant automatically).

Unsubscribed features produce **no UI** — the admin cannot even see permission toggles for features they haven't purchased.

### 4. Module-Level Permission Types

Each module declares which permission actions it supports:

| Module           | canRead | canWrite | canDelete |
| ---------------- | ------- | -------- | --------- |
| Dashboard        | Yes     | —        | —         |
| Blackboard Posts | Yes     | Yes      | Yes       |
| Shift Rotation   | Yes     | —        | —         |
| KVP Suggestions  | Yes     | Yes      | Yes       |

The backend **enforces** this: if a PUT request sends `canDelete: true` for a module that only supports `['canRead']`, the service forces it to `false` before writing to the DB. The frontend renders only the allowed checkboxes.

### 5. UUID Resolution

The controller receives a UUIDv7 (`/user-permissions/:uuid`). The service resolves this to an integer `user_id` inside the same `tenantTransaction()`:

```sql
SELECT id FROM users WHERE uuid = $1
```

RLS ensures only users within the current tenant are resolvable. A UUID from another tenant returns 0 rows → `NotFoundException`.

---

## Alternatives Considered

### 1. Centralized Permission Definition (God-Object)

```typescript
// ONE file with ALL permission definitions
export const ALL_PERMISSIONS = {
  blackboard: { ... },
  calendar: { ... },
  kvp: { ... },
  // ... every feature here
};
```

**Rejected:**

- Single point of change for every feature addition
- Feature modules are not self-contained
- Risk of merge conflicts when multiple features developed in parallel
- Violates Open-Closed Principle

### 2. Database-Driven Permission Definitions

Store permission categories and modules in DB tables (`permission_categories`, `permission_modules`), managed via admin UI or migrations.

**Rejected:**

- Over-engineering for current scope (7 features, 18 modules)
- Permission structure rarely changes — code-defined is sufficient
- Adds migration complexity for definition changes
- No compile-time type safety for permission codes
- YAGNI — can migrate to DB-driven later if needed without breaking the service layer

### 3. Role-Based Permission Templates Only

Define permission templates per role (e.g., "Standard Employee", "Department Lead") and assign templates to users.

**Rejected as Phase 1 approach:**

- Templates are a convenience layer, not a replacement for per-user permissions
- Per-user is the atomic building block — templates compose from it
- Templates will be added in a future phase as an enhancement on top of the per-user foundation
- Starting with per-user is simpler (KISS) and immediately useful

### 4. RBAC with Fine-Grained Roles

Create many roles (e.g., "blackboard-reader", "kvp-writer", "document-admin") and assign multiple roles per user.

**Rejected:**

- Role explosion: 18 modules x 3 actions = 54 potential roles
- Hard for IT admins to understand and manage
- Not intuitive for industrial companies (checkbox UI is clearer than role assignment)
- Microsoft Entra moved away from pure role-based toward direct permission assignment for this reason

### 5. Attribute-Based Access Control (ABAC)

Evaluate permissions based on attributes (user department, time of day, location, etc.).

**Rejected:**

- Massive over-engineering for current requirements
- Complexity far beyond what industrial IT admins need
- Can be added as a future layer if needed
- YAGNI — no customer has requested conditional access

---

## Consequences

### Positive

1. **IT admins can control access per user, per module, per action** — matches real-world industrial requirements
2. **Decentralized ownership** — each feature module is self-contained with its permission definitions
3. **RLS-protected** (ADR-019) — cross-tenant permission leaks impossible
4. **Tenant-feature gating** — no UI for unsubscribed features, preventing confusion
5. **Extensible foundation** — permission templates, groups, time-based access can all be built on top of this table
6. **Audit-ready** — `assigned_by` + `updated_at` track who changed permissions and when
7. **Type-safe** — registry validates feature/module codes at runtime, TypeScript catches structural errors at compile time
8. **KISS** — single table, single UPSERT pattern, no complex inheritance trees

### Negative

1. **No bulk assignment** — admins must configure permissions per user (mitigated by future permission templates)
2. **No permission inheritance** — department permissions don't cascade to team members (explicit assignment per user)
3. **VARCHAR codes instead of FK** — `feature_code` and `module_code` are not foreign-keyed to a definition table. Invalid codes are caught by the registry validation, not by the DB
4. **Full state replacement on PUT** — the API sends all permissions for a user, not a diff. At current scale (max ~20 modules per user) this is negligible

### Risks & Mitigations

| Risk                                           | Mitigation                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Feature module forgets to register permissions | App startup fails (no silent degradation) — `register()` is in `OnModuleInit`                            |
| Duplicate feature code registration            | `register()` throws immediately on duplicate (fail-fast)                                                 |
| Permission codes drift from `features.code`    | Code review + integration tests validate `feature_code` against `features` table                         |
| Admin locks themselves out                     | Admin role check is at controller level (`@Roles('admin')`) — permissions apply to employees, not admins |
| Cross-tenant permission visibility             | RLS `tenant_isolation` policy on `user_feature_permissions` (ADR-019)                                    |

---

## Long-Term Vision

This ADR establishes the **atomic foundation** for a comprehensive access control system, analogous to Microsoft Entra ID scoped to application features:

| Phase                  | Capability                                                    | Status  |
| ---------------------- | ------------------------------------------------------------- | ------- |
| **Phase 1** (this ADR) | Per-user, per-module, per-action permissions                  | Current |
| Phase 2                | Permission templates ("Standard Employee", "Quality Manager") | Future  |
| Phase 3                | Group-based assignment (department/team → template)           | Future  |
| Phase 4                | `valid_from` / `valid_until` for time-limited access          | Future  |
| Phase 5                | Self-service access requests with admin approval workflow     | Future  |
| Phase 6                | Compliance dashboard ("Who has delete access to Documents?")  | Future  |

Each future phase builds on the `user_feature_permissions` table without schema redesign. The decentralized registry pattern scales with new features. The RLS isolation protects all phases equally.

---

## References

- [USER-PERMISSIONS-PLAN.md](../../USER-PERMISSIONS-PLAN.md) — Full 8-phase implementation plan
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — JWT Guard, `@CurrentUser()`, `@TenantId()`
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) — ClsService, `tenantTransaction()`
- [ADR-007: API Response Standardization](./ADR-007-api-response-standardization.md) — ResponseInterceptor, no double-wrapping
- [ADR-012: Frontend Route Security Groups](./ADR-012-frontend-route-security-groups.md) — `@Roles('admin')`, fail-closed RBAC
- [ADR-019: Multi-Tenant RLS Data Isolation](./ADR-019-multi-tenant-rls-isolation.md) — RLS policies, `tenantTransaction()`, dual-user model
- [DATABASE-MIGRATION-GUIDE.md](../../DATABASE-MIGRATION-GUIDE.md) — Migration format, RLS template
- [ZOD-INTEGRATION-GUIDE.md](../../../backend/docs/ZOD-INTEGRATION-GUIDE.md) — DTO validation pattern
- [Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/) — Inspiration for long-term vision
- [ADR GitHub](https://adr.github.io/) — ADR best practices and Y-statement format
